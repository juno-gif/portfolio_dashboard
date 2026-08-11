import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function fetchKrwName(code: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://ac.stock.naver.com/ac?q=${encodeURIComponent(code)}&target=stock,etf,index`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.naver.com/' },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items: string[][] = data?.items?.[0] ?? [];
    const exact = items.find((item) => item[0] === code);
    return exact?.[1] ?? items[0]?.[1] ?? null;
  } catch {
    return null;
  }
}

async function fetchUsdName(ticker: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.shortName ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim();
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  const isKrw = /^\d{1,6}$/.test(code);
  const paddedCode = isKrw ? code.padStart(6, '0') : code.toUpperCase();
  const unit = isKrw ? 'KRW' : 'USD';

  const name = isKrw ? await fetchKrwName(paddedCode) : await fetchUsdName(paddedCode);
  if (!name) return NextResponse.json({ error: '종목을 찾을 수 없습니다' }, { status: 404 });

  return NextResponse.json({ name, unit, code: paddedCode });
}
