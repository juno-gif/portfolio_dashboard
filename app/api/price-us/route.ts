import { NextRequest, NextResponse } from 'next/server';

// market route와 동일한 Yahoo Finance v8 chart API 사용 (crumb 불필요)
async function fetchYahooPrice(
  ticker: string
): Promise<{ currentPrice: number; prevClose: number } | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
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
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const validCloses = closes.filter((c): c is number => c != null);

    if (validCloses.length < 2) return null;

    const currentPrice = meta.regularMarketPrice ?? validCloses[validCloses.length - 1];
    const prevClose = validCloses[validCloses.length - 2];

    if (!currentPrice || !prevClose) return null;

    return { currentPrice, prevClose };
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
