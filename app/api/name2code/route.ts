import { NextRequest, NextResponse } from 'next/server';

const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET' } });
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');
  if (!name) return NextResponse.json({ code: null }, { headers: CORS });

  try {
    const res = await fetch(
      `https://ac.stock.naver.com/ac?q=${encodeURIComponent(name)}&target=stock,etf,index`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.naver.com/' }, signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return NextResponse.json({ code: null }, { headers: CORS });

    const data = await res.json();
    // items[0] = [[code, name, type, ...], ...]
    const first = data?.items?.[0]?.[0];
    const code = first?.[0] ?? null;
    return NextResponse.json({ code, name: first?.[1] ?? null }, { headers: CORS });
  } catch {
    return NextResponse.json({ code: null }, { headers: CORS });
  }
}
