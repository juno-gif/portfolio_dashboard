import { NextRequest, NextResponse } from 'next/server';

async function fetchYahooPrice(
  ticker: string
): Promise<{ currentPrice: number; prevClose: number } | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=2d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (!meta) return null;

    const currentPrice = meta.regularMarketPrice ?? meta.chartPreviousClose ?? null;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? currentPrice;

    if (currentPrice == null) return null;

    return {
      currentPrice: Number(currentPrice),
      prevClose: Number(prevClose),
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get('tickers');

  if (!tickersParam) {
    return NextResponse.json({ error: 'tickers 파라미터가 필요합니다' }, { status: 400 });
  }

  const tickers = tickersParam.split(',').filter(Boolean);
  const results = await Promise.allSettled(tickers.map(fetchYahooPrice));

  const priceMap: Record<string, { currentPrice: number; prevClose: number } | null> = {};
  tickers.forEach((ticker, i) => {
    const result = results[i];
    priceMap[ticker] = result.status === 'fulfilled' ? result.value : null;
  });

  return NextResponse.json(priceMap);
}
