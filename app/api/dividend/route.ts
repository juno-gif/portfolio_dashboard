import { NextRequest, NextResponse } from 'next/server';

interface DivHoldingInput {
  종목번호: string;
  종목명: string;
  단위: 'KRW' | 'USD';
  qty: number;
}

export interface DividendEvent {
  date: string;       // YYYY-MM-DD
  perShare: number;   // native currency (원 or $)
  totalKRW: number;
  status: 'confirmed' | 'projected';
}

export interface HoldingDividend {
  종목번호: string;
  종목명: string;
  단위: 'KRW' | 'USD';
  qty: number;
  dividends: DividendEvent[];
}

async function fetchYahooDiv(ticker: string): Promise<{ amount: number; date: number }[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2y&events=div`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const rawDivs = data?.chart?.result?.[0]?.events?.dividends ?? {};
    return Object.values(rawDivs) as { amount: number; date: number }[];
  } catch {
    return [];
  }
}

async function getHoldingDividends(
  holding: DivHoldingInput,
  exchangeRate: number,
  nowMs: number,
): Promise<HoldingDividend> {
  const { 종목번호, 종목명, 단위, qty } = holding;

  // Yahoo Finance ticker: USD는 그대로, KRW는 .KS (코스피) 시도 후 .KQ
  let rawEvents: { amount: number; date: number }[] = [];
  if (단위 === 'USD') {
    rawEvents = await fetchYahooDiv(종목번호);
  } else {
    rawEvents = await fetchYahooDiv(`${종목번호}.KS`);
    if (rawEvents.length === 0) {
      rawEvents = await fetchYahooDiv(`${종목번호}.KQ`);
    }
  }

  rawEvents.sort((a, b) => a.date - b.date);

  const now = new Date(nowMs);
  const dividends: DividendEvent[] = [];

  // Yahoo Finance 데이터 (과거 + 공식 발표된 미래) → 모두 confirmed
  for (const ev of rawEvents) {
    const date = new Date(ev.date * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const perShareKRW = 단위 === 'USD' ? ev.amount * exchangeRate : ev.amount;
    dividends.push({
      date: dateStr,
      perShare: ev.amount,
      totalKRW: Math.round(perShareKRW * qty),
      status: 'confirmed',
    });
  }

  // 향후 12개월 중 데이터 없는 월 → 1년 전 같은 달 기준 예상
  for (let i = 1; i <= 12; i++) {
    const target = new Date(now);
    target.setMonth(target.getMonth() + i);
    const targetYear = target.getFullYear();
    const targetMonth = target.getMonth();
    const targetYM = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;

    const alreadyHas = dividends.some((d) => d.date.startsWith(targetYM));
    if (alreadyHas) continue;

    // 1년 전 같은 달
    const lastYearEv = rawEvents.find((ev) => {
      const d = new Date(ev.date * 1000);
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear - 1;
    });

    if (lastYearEv) {
      const projBase = new Date(lastYearEv.date * 1000);
      projBase.setFullYear(targetYear);
      const projDateStr = projBase.toISOString().split('T')[0];
      if (dividends.some((d) => d.date === projDateStr)) continue;
      const perShareKRW = 단위 === 'USD' ? lastYearEv.amount * exchangeRate : lastYearEv.amount;
      dividends.push({
        date: projDateStr,
        perShare: lastYearEv.amount,
        totalKRW: Math.round(perShareKRW * qty),
        status: 'projected',
      });
    }
  }

  dividends.sort((a, b) => a.date.localeCompare(b.date));
  return { 종목번호, 종목명, 단위, qty, dividends };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const holdings: DivHoldingInput[] = body.holdings ?? [];
    const exchangeRate: number = body.exchangeRate ?? 1400;
    const nowMs = Date.now();

    const results = await Promise.allSettled(
      holdings.map((h) => getHoldingDividends(h, exchangeRate, nowMs))
    );

    const data = results
      .filter((r): r is PromiseFulfilledResult<HoldingDividend> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((h) => h.dividends.length > 0);

    return NextResponse.json(data);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
