import { NextRequest, NextResponse } from 'next/server';

const CORS = { 'Access-Control-Allow-Origin': '*' };


async function queryNaver(q: string): Promise<{ code: string; name: string } | null> {
  try {
    const res = await fetch(
      `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock,etf,etn,index`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.naver.com/' }, signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    // items는 카테고리별 슬롯 배열 (stock/etf/etn/index가 각각 다른 슬롯에 올 수 있음)
    for (const group of (data?.items ?? [])) {
      const first = group?.[0];
      if (first?.[0]) return { code: first[0], name: first[1] ?? q };
    }
    return null;
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

  const result = await queryNaver(name);
  return NextResponse.json(result ?? { code: null }, { headers: CORS });
}
