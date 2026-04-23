import { NextRequest, NextResponse } from 'next/server';

async function fetchYahooPrice(
  ticker: string
): Promise<{ currentPrice: number; prevClose: number; priceLabel?: string } | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d&includePrePost=true`,
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

    const regularPrice: number = meta.regularMarketPrice ?? validCloses[validCloses.length - 1];
    const regularTime: number = meta.regularMarketTime ?? 0;
    const postPrice: number | undefined = meta.postMarketPrice;
    const postTime: number = meta.postMarketTime ?? 0;
    const prePrice: number | undefined = meta.preMarketPrice;
    const preTime: number = meta.preMarketTime ?? 0;

    // 타임스탬프 기준으로 가장 최신 가격 선택 (프리/애프터마켓 반영)
    let currentPrice = regularPrice;
    let priceLabel: string | undefined;
    if (postPrice && postTime > regularTime && postTime > preTime) {
      currentPrice = postPrice;
      priceLabel = '애프터마켓';
    } else if (prePrice && preTime > regularTime) {
      currentPrice = prePrice;
      priceLabel = '프리마켓';
    }

    // prevClose = 어제 종가 기준 (하루 전체 등락 반영)
    const prevClose = validCloses[validCloses.length - 2];

    if (!currentPrice || !prevClose) return null;
    return { currentPrice, prevClose, priceLabel };
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
