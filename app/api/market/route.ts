import { NextResponse } from 'next/server';

export interface MarketItem {
  symbol: string;
  name: string;
  unit: string;
  currentPrice: number;
  prevClose: number;
  dates: string[];
  prices: number[];
}

export interface MarketGroup {
  group: string;
  items: (MarketItem | null)[];
}

const SYMBOL_GROUPS: { group: string; items: { symbol: string; name: string; unit: string }[] }[] = [
  {
    group: '국내 증시',
    items: [
      { symbol: '^KS11',    name: '코스피',          unit: 'pt' },
      { symbol: '^KQ11',    name: '코스닥',          unit: 'pt' },
    ],
  },
  {
    group: '미국 증시',
    items: [
      { symbol: '^GSPC',    name: 'S&P 500',        unit: 'pt' },
      { symbol: '^IXIC',    name: '나스닥',          unit: 'pt' },
      { symbol: '^VIX',     name: '공포지수 (VIX)',  unit: 'pt' },
    ],
  },
  {
    group: '환율 / 금리',
    items: [
      { symbol: 'KRW=X',     name: '달러/원',             unit: '원' },
      { symbol: 'DX-Y.NYB',  name: '달러 인덱스 (DXY)',   unit: 'pt' },
      { symbol: '^TNX',      name: '미국 10년물 금리',     unit: '%' },
      { symbol: '^IRX',      name: '미국 단기금리 (3M)',   unit: '%' },
    ],
  },
  {
    group: '원자재 / 대안자산',
    items: [
      { symbol: 'CL=F',      name: 'WTI 유가',   unit: '$' },
      { symbol: 'GC=F',      name: '금 선물',    unit: '$' },
      { symbol: 'HG=F',      name: '구리 선물',  unit: '$' },
      { symbol: 'BTC-USD',   name: '비트코인',   unit: '$' },
    ],
  },
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

export const revalidate = 300;

export async function GET() {
  // 모든 심볼 병렬 조회
  const allItems = SYMBOL_GROUPS.flatMap((g) => g.items);
  const results = await Promise.allSettled(allItems.map((s) => fetchChart(s.symbol)));

  let idx = 0;
  const groups: MarketGroup[] = SYMBOL_GROUPS.map((g) => ({
    group: g.group,
    items: g.items.map((s) => {
      const r = results[idx++];
      if (r.status !== 'fulfilled' || !r.value) return null;
      const { dates, prices, currentPrice, prevClose } = r.value;
      return { symbol: s.symbol, name: s.name, unit: s.unit, currentPrice, prevClose, dates, prices };
    }),
  }));

  return NextResponse.json(groups, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  });
}
