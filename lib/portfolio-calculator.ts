import {
  RawHolding,
  HoldingWithMeta,
  ConsolidatedHolding,
  AccountSummary,
  SectorAllocation,
  SectorKey,
  PortfolioSummary,
  PriceMap,
} from '@/types/portfolio';
import { tagSector } from '@/lib/sector-tagger';

const SECTOR_COLORS: Record<SectorKey, string> = {
  '미국지수': '#3B82F6',
  '국내지수': '#10B981',
  '금': '#F59E0B',
  '방산/테마': '#EF4444',
  '채권/혼합': '#8B5CF6',
  '해외기타': '#06B6D4',
  '개별주': '#F97316',
  '기타': '#6B7280',
};

// 원시 보유종목 + 가격맵 → HoldingWithMeta 계산
export function enrichHoldings(
  holdings: RawHolding[],
  priceMap: PriceMap,
  exchangeRate: number
): HoldingWithMeta[] {
  return holdings.map((h) => {
    const sector = tagSector(h);
    const priceData = priceMap[h.종목번호];
    const priceUnavailable = priceData === null || priceData === undefined;

    // 현재가 조회 실패 시 평균단가로 fallback
    const currentPrice = priceUnavailable ? h.평균단가 : priceData.currentPrice;
    const prevClose = priceUnavailable ? h.평균단가 : priceData.prevClose;

    const isUSD = h.단위 === 'USD';
    const currentPriceKRW = isUSD ? currentPrice * exchangeRate : currentPrice;
    const avgCostKRW = isUSD ? h.평균단가 * exchangeRate : h.평균단가;
    const prevCloseKRW = isUSD ? prevClose * exchangeRate : prevClose;

    const evalAmount = currentPriceKRW * h.수량;
    const gainAmount = (currentPriceKRW - avgCostKRW) * h.수량;
    const gainRate = avgCostKRW > 0 ? ((currentPriceKRW - avgCostKRW) / avgCostKRW) * 100 : 0;

    const todayGainAmount = (currentPriceKRW - prevCloseKRW) * h.수량;
    const todayGainRate = prevCloseKRW > 0 ? ((currentPriceKRW - prevCloseKRW) / prevCloseKRW) * 100 : 0;

    return {
      ...h,
      sector,
      currentPrice,
      currentPriceKRW,
      evalAmount,
      gainAmount,
      gainRate,
      todayGainAmount,
      todayGainRate,
      prevClose,
      priceUnavailable,
    };
  });
}

// 동일 종목번호 기준 계좌 통합
export function consolidateHoldings(
  holdings: HoldingWithMeta[]
): ConsolidatedHolding[] {
  const grouped = new Map<string, HoldingWithMeta[]>();

  for (const h of holdings) {
    const key = h.종목번호;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(h);
  }

  return Array.from(grouped.values()).map((group) => {
    const first = group[0];
    const totalQty = group.reduce((sum, h) => sum + h.수량, 0);
    const totalEval = group.reduce((sum, h) => sum + h.evalAmount, 0);
    const totalGain = group.reduce((sum, h) => sum + h.gainAmount, 0);
    const totalTodayGain = group.reduce((sum, h) => sum + h.todayGainAmount, 0);

    // 가중평균 단가 (KRW 기준)
    const totalCost = group.reduce((sum, h) => {
      const avgCostKRW = h.단위 === 'USD' ? h.평균단가 * first.currentPriceKRW / first.currentPrice : h.평균단가;
      return sum + avgCostKRW * h.수량;
    }, 0);
    const avgCost = totalQty > 0 ? totalCost / totalQty : 0;

    const gainRate = avgCost > 0 ? (totalGain / (avgCost * totalQty)) * 100 : 0;
    const prevEval = group.reduce((sum, h) => {
      const isUSD = h.단위 === 'USD';
      const prevCloseKRW = isUSD ? h.prevClose * (first.currentPriceKRW / first.currentPrice) : h.prevClose;
      return sum + prevCloseKRW * h.수량;
    }, 0);
    const todayGainRate = prevEval > 0 ? (totalTodayGain / prevEval) * 100 : 0;

    const byAccount = group.map((h) => ({
      account: h.계좌,
      qty: h.수량,
      evalAmount: h.evalAmount,
      ratio: totalEval > 0 ? (h.evalAmount / totalEval) * 100 : 0,
    }));

    return {
      종목번호: first.종목번호,
      종목명: first.종목명,
      단위: first.단위,
      sector: first.sector,
      totalQty,
      avgCost,
      currentPrice: first.currentPrice,
      evalAmount: totalEval,
      gainAmount: totalGain,
      gainRate,
      todayGainAmount: totalTodayGain,
      todayGainRate,
      priceUnavailable: first.priceUnavailable,
      byAccount,
    };
  });
}

// 계좌별 요약
export function calcAccountSummaries(
  holdings: HoldingWithMeta[]
): AccountSummary[] {
  const grouped = new Map<string, HoldingWithMeta[]>();

  for (const h of holdings) {
    if (!grouped.has(h.계좌)) grouped.set(h.계좌, []);
    grouped.get(h.계좌)!.push(h);
  }

  const ACCOUNT_ORDER = ['ISA', '연금저축A', '연금저축B', 'CMA', 'IRP'];

  return ACCOUNT_ORDER.filter((a) => grouped.has(a)).map((account) => {
    const group = grouped.get(account)!;
    const evalAmount = group.reduce((sum, h) => sum + h.evalAmount, 0);
    const todayGainAmount = group.reduce((sum, h) => sum + h.todayGainAmount, 0);
    const prevEval = group.reduce((sum, h) => {
      const isUSD = h.단위 === 'USD';
      const prevCloseKRW = isUSD ? h.prevClose * (h.currentPriceKRW / h.currentPrice) : h.prevClose;
      return sum + prevCloseKRW * h.수량;
    }, 0);
    const todayGainRate = prevEval > 0 ? (todayGainAmount / prevEval) * 100 : 0;

    return { account, evalAmount, todayGainAmount, todayGainRate };
  });
}

// 섹터별 비중
export function calcSectorAllocations(
  holdings: HoldingWithMeta[]
): SectorAllocation[] {
  const sectorMap = new Map<SectorKey, number>();

  for (const h of holdings) {
    const current = sectorMap.get(h.sector) ?? 0;
    sectorMap.set(h.sector, current + h.evalAmount);
  }

  const totalEval = Array.from(sectorMap.values()).reduce((a, b) => a + b, 0);

  return Array.from(sectorMap.entries())
    .map(([sector, amount]) => ({
      sector,
      amount,
      ratio: totalEval > 0 ? (amount / totalEval) * 100 : 0,
      color: SECTOR_COLORS[sector],
    }))
    .sort((a, b) => b.amount - a.amount);
}

// 전체 포트폴리오 요약
export function calcPortfolioSummary(
  holdings: HoldingWithMeta[],
  exchangeRate: number
): PortfolioSummary {
  const totalEval = holdings.reduce((sum, h) => sum + h.evalAmount, 0);
  const totalCost = holdings.reduce((sum, h) => {
    const avgCostKRW = h.단위 === 'USD' ? h.평균단가 * exchangeRate : h.평균단가;
    return sum + avgCostKRW * h.수량;
  }, 0);
  const totalGainAmount = totalEval - totalCost;
  const totalGainRate = totalCost > 0 ? (totalGainAmount / totalCost) * 100 : 0;
  const todayGainAmount = holdings.reduce((sum, h) => sum + h.todayGainAmount, 0);
  const prevEval = holdings.reduce((sum, h) => {
    const isUSD = h.단위 === 'USD';
    const prevCloseKRW = isUSD ? h.prevClose * exchangeRate : h.prevClose;
    return sum + prevCloseKRW * h.수량;
  }, 0);
  const todayGainRate = prevEval > 0 ? (todayGainAmount / prevEval) * 100 : 0;

  return {
    totalEval,
    totalCost,
    totalGainAmount,
    totalGainRate,
    todayGainAmount,
    todayGainRate,
    exchangeRate,
    updatedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
  };
}
