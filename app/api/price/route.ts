import { NextRequest, NextResponse } from 'next/server';

interface OverMarketInfo {
  overMarketStatus?: string;    // 'OPEN' | 'CLOSE'
  tradingSessionType?: string;  // 'PRE_MARKET' | 'AFTER_MARKET'
  overPrice?: string;           // 쉼표 포함 문자열 e.g. "120,400"
  compareToPreviousClosePrice?: string; // e.g. "900"
  localTradedAt?: string;       // ISO 8601 with KST offset
}

interface NaverStockData {
  closePriceRaw?: string;
  compareToPreviousClosePriceRaw?: string;
  marketStatus?: string; // 'OPEN' | 'CLOSE'
  overMarketPriceInfo?: OverMarketInfo;
  localTradedAt?: string;
  [key: string]: unknown;
}

const parseNum = (s?: string) => (s ? Number(s.replace(/,/g, '')) : NaN);

function fmtKstTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul',
    });
  } catch { return ''; }
}

async function fetchNaverPrice(
  code: string
): Promise<{ currentPrice: number; prevClose: number; priceLabel?: string } | null> {
  try {
    const res = await fetch(
      `https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const stockData: NaverStockData = data?.datas?.[0] ?? data;

    const krxPrice = Number(stockData.closePriceRaw);
    const krxDiff = Number(stockData.compareToPreviousClosePriceRaw ?? '0');
    if (!krxPrice || isNaN(krxPrice)) return null;
    const prevClose = krxPrice - krxDiff;

    // KRX 정규장 마감 or 시작 전이고 NXT가 열려 있으면 NXT 시세 우선
    const nxt = stockData.overMarketPriceInfo;
    const krxOpen = stockData.marketStatus === 'OPEN';
    if (!krxOpen && nxt?.overMarketStatus === 'OPEN' && nxt.overPrice) {
      const nxtPrice = parseNum(nxt.overPrice);
      const nxtDiff = parseNum(nxt.compareToPreviousClosePrice ?? '0');
      if (!isNaN(nxtPrice) && nxtPrice > 0) {
        const sessionLabel = nxt.tradingSessionType === 'PRE_MARKET' ? '프리마켓' : '애프터마켓';
        const timeStr = nxt.localTradedAt ? fmtKstTime(nxt.localTradedAt) : '';
        const priceLabel = timeStr ? `NXT ${sessionLabel} ${timeStr}` : `NXT ${sessionLabel}`;
        return { currentPrice: nxtPrice, prevClose: nxtPrice - nxtDiff, priceLabel };
      }
    }

    const krxStatus = stockData.marketStatus === 'OPEN' ? '장중' : '종가';
    const krxTime = stockData.localTradedAt ? fmtKstTime(stockData.localTradedAt) : '';
    const krxLabel = krxTime ? `KRX ${krxStatus} ${krxTime}` : `KRX ${krxStatus}`;
    return { currentPrice: krxPrice, prevClose, priceLabel: krxLabel };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const codesParam = searchParams.get('codes');
  if (!codesParam) {
    return NextResponse.json({ error: 'codes 파라미터가 필요합니다' }, { status: 400 });
  }

  const codes = codesParam.split(',').filter(Boolean);
  const results = await Promise.allSettled(codes.map(fetchNaverPrice));

  const priceMap: Record<string, { currentPrice: number; prevClose: number } | null> = {};
  codes.forEach((code, i) => {
    const result = results[i];
    priceMap[code] = result.status === 'fulfilled' ? result.value : null;
  });

  return NextResponse.json(priceMap);
}
