import { NextRequest, NextResponse } from 'next/server';

const CORS = { 'Access-Control-Allow-Origin': '*' };

// 국내 ETF 브랜드 접두어 (Naver에 다른 이름으로 등록된 경우 제거 후 재시도)
const ETF_BRAND_PREFIXES = ['1Q', 'TIGER', 'KODEX', 'ACE', 'ARIRANG', 'HANARO', 'KINDEX', 'SOL', 'KOSEF', 'TIMEFOLIO', 'FOCUS', 'KTOP', 'TREX'];

async function queryNaver(q: string): Promise<{ code: string; name: string } | null> {
  try {
    const res = await fetch(
      `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock,etf,etn,index`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.naver.com/' }, signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const first = data?.items?.[0]?.[0];
    if (!first?.[0]) return null;
    return { code: first[0], name: first[1] ?? q };
  } catch {
    return null;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET' } });
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');
  if (!name) return NextResponse.json({ code: null }, { headers: CORS });

  // 1차: 전체 이름으로 검색
  const exact = await queryNaver(name);
  if (exact) return NextResponse.json(exact, { headers: CORS });

  // 2차: ETF 브랜드 접두어 제거 후 검색 (e.g. "1Q 미국S&P500" → "미국S&P500")
  for (const prefix of ETF_BRAND_PREFIXES) {
    if (name.toUpperCase().startsWith(prefix + ' ')) {
      const stripped = name.slice(prefix.length + 1).trim();
      if (stripped.length >= 2) {
        const result = await queryNaver(stripped);
        if (result) return NextResponse.json(result, { headers: CORS });
      }
      break;
    }
  }

  return NextResponse.json({ code: null }, { headers: CORS });
}
