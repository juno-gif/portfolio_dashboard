import { NextRequest, NextResponse } from 'next/server';

// Stooq API: 인증 불필요, 서버사이드 친화적
// US 종목: {TICKER}.US 형식
async function fetchStooqPrice(
  ticker: string
): Promise<{ currentPrice: number; prevClose: number } | null> {
  const symbol = `${ticker}.US`;

  try {
    const res = await fetch(
      `https://stooq.com/q/d/l/?s=${symbol}&i=d`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return null;

    const text = await res.text();
    // CSV 형식: Date,Open,High,Low,Close,Volume (첫 줄 헤더)
    const lines = text
      .trim()
      .split('\n')
      .slice(1) // 헤더 제거
      .filter((l) => l.trim() && !l.toLowerCase().startsWith('no data'));

    if (lines.length < 2) return null;

    const parseClose = (line: string) => parseFloat(line.split(',')[4]);

    const currentPrice = parseClose(lines[lines.length - 1]);
    const prevClose = parseClose(lines[lines.length - 2]);

    if (isNaN(currentPrice) || isNaN(prevClose) || currentPrice <= 0) return null;

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
  const results = await Promise.allSettled(tickers.map(fetchStooqPrice));

  const priceMap: Record<string, { currentPrice: number; prevClose: number } | null> = {};
  tickers.forEach((ticker, i) => {
    const result = results[i];
    priceMap[ticker] = result.status === 'fulfilled' ? result.value : null;
  });

  return NextResponse.json(priceMap);
}
