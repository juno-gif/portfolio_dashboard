import { NextRequest, NextResponse } from 'next/server';

async function fetchYahooPrice(
  ticker: string
): Promise<{ currentPrice: number; prevClose: number } | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    // 실제 종가 배열에서 마지막 두 거래일 값을 직접 사용
    // (meta.previousClose/chartPreviousClose는 주말 낀 경우 오일치 발생)
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
    const validCloses = closes.filter((v) => v != null && !isNaN(v));

    const currentPrice = result.meta?.regularMarketPrice ?? validCloses.at(-1) ?? null;
    const prevClose = validCloses.length >= 2 ? validCloses.at(-2)! : currentPrice;

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
