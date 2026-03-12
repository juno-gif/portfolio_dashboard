import { NextResponse } from 'next/server';

export interface MarketItem {
  symbol: string;
  name: string;
  unit: string;
  currentPrice: number;
  prevClose: number;
  dates: string[];   // 'MM/DD' 형식
  prices: number[];  // 종가 배열
}

const SYMBOLS: { symbol: string; name: string; unit: string }[] = [
  { symbol: '^KS11',  name: '코스피',      unit: 'pt' },
  { symbol: '^GSPC',  name: 'S&P 500',    unit: 'pt' },
  { symbol: '^IXIC',  name: '나스닥',      unit: 'pt' },
  { symbol: 'KRW=X',  name: '달러/원',     unit: '원' },
  { symbol: 'CL=F',   name: 'WTI 유가',   unit: '$' },
  { symbol: 'GC=F',   name: '금 선물',    unit: '$' },
];

async function fetchChart(symbol: string): Promise<{ dates: string[]; prices: number[]; currentPrice: number; prevClose: number } | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

    const dates: string[] = [];
    const prices: number[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const price = closes[i];
      if (price == null) continue;
      const d = new Date(timestamps[i] * 1000);
      dates.push(`${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`);
      prices.push(price);
    }

    const currentPrice = meta.regularMarketPrice ?? prices[prices.length - 1] ?? 0;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? currentPrice;

    return { dates, prices, currentPrice, prevClose };
  } catch {
    return null;
  }
}

// 5분 캐시
export const revalidate = 300;

export async function GET() {
  const results = await Promise.allSettled(SYMBOLS.map((s) => fetchChart(s.symbol)));

  const items: (MarketItem | null)[] = SYMBOLS.map((s, i) => {
    const r = results[i];
    if (r.status !== 'fulfilled' || !r.value) return null;
    const { dates, prices, currentPrice, prevClose } = r.value;
    return { symbol: s.symbol, name: s.name, unit: s.unit, currentPrice, prevClose, dates, prices };
  });

  return NextResponse.json(items, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  });
}
