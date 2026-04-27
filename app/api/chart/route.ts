import { NextRequest, NextResponse } from 'next/server';

const INTERVAL_MAP: Record<string, string> = {
  '1d':  '5m',
  '5d':  '60m',
  '3mo': '1d',
  '1y':  '1d',
};

function toLocalTime(ts: number, unit: string): string {
  const tz = unit === 'USD' ? 'America/New_York' : 'Asia/Seoul';
  return new Date(ts * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  });
}

// Naver Finance fchart API: KRW 1일 뷰 (NXT 장전/장후 포함)
async function fetchNaverIntraday(symbol: string): Promise<{
  dates: string[];
  prices: number[];
  sessionTypes: string[];
} | null> {
  const res = await fetch(
    `https://fchart.stock.naver.com/sise.nhn?symbol=${symbol}&timeframe=minute&count=600&requestType=0`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return null;

  const xml = await res.text();

  // Parse: YYYYMMDDHHMI|open|high|low|close|volume (open/high/low may be "null")
  const items = [...xml.matchAll(/data="(\d{12})\|[^|]*\|[^|]*\|[^|]*\|(\d+)\|/g)];
  if (!items.length) return null;

  // Find most recent day with data
  const days = new Set(items.map((m) => m[1].slice(0, 8)));
  const latestDay = [...days].sort().at(-1)!;

  const dates: string[] = [];
  const prices: number[] = [];
  const sessionTypes: string[] = [];

  for (const match of items) {
    const ts = match[1]; // YYYYMMDDHHMI
    if (ts.slice(0, 8) !== latestDay) continue;

    const hh = parseInt(ts.slice(8, 10));
    const mi = parseInt(ts.slice(10, 12));
    const totalMin = hh * 60 + mi;
    // KRX: 09:00(540) ~ 15:30(930) 포함, 그 외 NXT
    const session = totalMin >= 540 && totalMin <= 930 ? 'KRX' : 'NXT';

    dates.push(`${ts.slice(8, 10)}:${ts.slice(10, 12)}`);
    prices.push(parseInt(match[2]));
    sessionTypes.push(session);
  }

  return { dates, prices, sessionTypes };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const unit = searchParams.get('unit') ?? 'KRW';
  const range = searchParams.get('range') ?? '3mo';

  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  const isKrwIntraday = range === '1d' && unit === 'KRW';
  const isIntraday = range === '1d';

  // KRW 1일 뷰: Naver Finance fchart (NXT 장전/장후 포함)
  if (isKrwIntraday) {
    try {
      const result = await fetchNaverIntraday(ticker);
      if (!result) return NextResponse.json(null);
      return NextResponse.json({ ...result, currency: 'KRW', isIntraday: true });
    } catch {
      return NextResponse.json(null);
    }
  }

  // 그 외: Yahoo Finance
  const yahooTicker = unit === 'USD' ? ticker : `${ticker}.KS`;
  const interval = INTERVAL_MAP[range] ?? '1d';

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=${interval}&range=${range}`,
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
    const sessionTypes: string[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const price = closes[i];
      if (price == null) continue;
      const label = isIntraday
        ? toLocalTime(timestamps[i], unit)
        : new Date(timestamps[i] * 1000).toISOString().split('T')[0];
      dates.push(label);
      prices.push(price);
      sessionTypes.push('KRX');
    }

    return NextResponse.json({ dates, prices, currency: result.meta.currency ?? 'KRW', isIntraday, sessionTypes });
  } catch {
    return NextResponse.json(null);
  }
}
