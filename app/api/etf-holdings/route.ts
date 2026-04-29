import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.PORTFOLIO_KV_REST_API_URL,
  token: process.env.PORTFOLIO_KV_REST_API_TOKEN,
});

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export type ETFHolding = { symbol: string; name: string; pct: number | null };

// 국내 ETF: Naver Finance mobile API
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
    // '-' 는 네이버가 비중 데이터를 제공하지 않는 경우 (해외주식 편입 ETF 등)
    pct: h.etfWeight !== '-' ? (parseFloat(h.etfWeight) || 0) : null,
  }));
}

// 해외 ETF: stockanalysis.com HTML 파싱
async function fetchUsdEtfHoldings(ticker: string): Promise<ETFHolding[] | null> {
  const res = await fetch(
    `https://stockanalysis.com/etf/${ticker.toLowerCase()}/holdings/`,
    {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) return null;

  const html = await res.text();

  // <table> → <tr> → <td> 파싱: [순번, symbol, name, "11.74%", shares]
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) return null;

  const rowMatches = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
  const holdings: ETFHolding[] = [];

  for (const rowMatch of rowMatches.slice(1)) { // 헤더 행 제외
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    if (cells.length < 4) continue;
    const symbol = cells[1];
    const name = cells[2];
    const pct = parseFloat(cells[3]);
    if (!symbol || isNaN(pct)) continue;
    holdings.push({ symbol, name, pct });
    if (holdings.length >= 10) break;
  }

  return holdings.length > 0 ? holdings : null;
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const unit = request.nextUrl.searchParams.get('unit') ?? 'USD';
  if (!ticker) return NextResponse.json(null);

  // Redis 캐시 (하루)
  const cacheKey = `etf:holdings:v2:${unit}:${ticker.toUpperCase()}`;
  const cached = await redis.get<string>(cacheKey);
  if (cached) {
    try { return NextResponse.json(JSON.parse(cached)); } catch { /* ignore */ }
  }

  try {
    const holdings = unit === 'KRW'
      ? await fetchKrwEtfHoldings(ticker)
      : await fetchUsdEtfHoldings(ticker);

    if (!holdings) return NextResponse.json(null);

    const result = { holdings, updatedAt: new Date().toISOString().slice(0, 10) };
    await redis.set(cacheKey, JSON.stringify(result), { ex: 60 * 60 * 24 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(null);
  }
}
