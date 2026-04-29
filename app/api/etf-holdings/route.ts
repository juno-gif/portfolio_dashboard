import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.PORTFOLIO_KV_REST_API_URL,
  token: process.env.PORTFOLIO_KV_REST_API_TOKEN,
});

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function getYFCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  const cached = await redis.get<string>('yf:crumb:v1');
  if (cached) {
    try { return JSON.parse(cached); } catch { /* ignore */ }
  }

  // Step 1: Get cookies
  const pageRes = await fetch('https://finance.yahoo.com/', {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    signal: AbortSignal.timeout(8000),
  });
  // Extract cookies from Set-Cookie headers
  const setCookies: string[] = [];
  pageRes.headers.forEach((val, key) => {
    if (key.toLowerCase() === 'set-cookie') setCookies.push(val.split(';')[0]);
  });
  const cookie = setCookies.join('; ');

  // Step 2: Get crumb
  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie, Referer: 'https://finance.yahoo.com/' },
    signal: AbortSignal.timeout(8000),
  });
  const crumb = await crumbRes.text();
  if (!crumb || crumb.includes('{') || crumb.length > 20) return null;

  const result = { crumb, cookie };
  await redis.set('yf:crumb:v1', JSON.stringify(result), { ex: 3600 });
  return result;
}

export type ETFHolding = { symbol: string; name: string; pct: number };

async function fetchKrwEtfHoldings(ticker: string): Promise<ETFHolding[] | null> {
  const res = await fetch(
    `https://m.stock.naver.com/api/stock/${encodeURIComponent(ticker)}/etfAnalysis`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!res.ok) return null;

  const data = await res.json();
  const raw: Array<{ itemCode: string; itemName: string; etfWeight: string }> =
    data?.etfTop10MajorConstituentAssets;
  if (!raw?.length) return null;

  return raw.map((h) => ({
    symbol: h.itemCode,
    name: h.itemName,
    pct: parseFloat(h.etfWeight) || 0,
  }));
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const unit = request.nextUrl.searchParams.get('unit') ?? 'USD';
  if (!ticker) return NextResponse.json(null);

  // Redis 캐시 확인 (하루 캐시 — ETF 구성은 자주 안 바뀜)
  const cacheKey = `etf:holdings:${unit}:${ticker.toUpperCase()}`;
  const cached = await redis.get<string>(cacheKey);
  if (cached) {
    try { return NextResponse.json(JSON.parse(cached)); } catch { /* ignore */ }
  }

  try {
    // 국내 ETF: Naver Finance mobile API
    if (unit === 'KRW') {
      const holdings = await fetchKrwEtfHoldings(ticker);
      if (!holdings) return NextResponse.json(null);
      const result = { holdings, updatedAt: new Date().toISOString().slice(0, 10) };
      await redis.set(cacheKey, JSON.stringify(result), { ex: 60 * 60 * 24 });
      return NextResponse.json(result);
    }

    // 해외 ETF: Yahoo Finance
    const auth = await getYFCrumb();
    if (!auth) return NextResponse.json(null);

    const res = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=topHoldings&crumb=${encodeURIComponent(auth.crumb)}`,
      {
        headers: { 'User-Agent': UA, Cookie: auth.cookie, Referer: 'https://finance.yahoo.com/' },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      // crumb 만료 가능성 — 캐시 삭제 후 재시도 안 함 (다음 요청에서 갱신)
      await redis.del('yf:crumb:v1');
      return NextResponse.json(null);
    }

    const data = await res.json();
    const topHoldings = data?.quoteSummary?.result?.[0]?.topHoldings;
    if (!topHoldings?.holdings?.length) return NextResponse.json(null);

    const holdings: ETFHolding[] = topHoldings.holdings.map((h: {
      symbol?: string; holdingName?: string; holdingPercent?: { raw?: number };
    }) => ({
      symbol: h.symbol ?? '',
      name: h.holdingName ?? '',
      pct: Math.round((h.holdingPercent?.raw ?? 0) * 1000) / 10,
    }));

    const result = { holdings, updatedAt: new Date().toISOString().slice(0, 10) };
    await redis.set(cacheKey, JSON.stringify(result), { ex: 60 * 60 * 24 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(null);
  }
}
