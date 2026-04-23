import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const unit = searchParams.get('unit') ?? 'KRW';
  const range = searchParams.get('range') ?? '3mo';

  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const yahooTicker = unit === 'USD' ? ticker : `${ticker}.KS`;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1d&range=${range}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return NextResponse.json(null);

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return NextResponse.json(null);

    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

    const dates: string[] = [];
    const prices: number[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const price = closes[i];
      if (price == null) continue;
      dates.push(new Date(timestamps[i] * 1000).toISOString().split('T')[0]);
      prices.push(price);
    }

    return NextResponse.json({ dates, prices, currency: result.meta.currency ?? 'KRW' });
  } catch {
    return NextResponse.json(null);
  }
}
