import { NextRequest, NextResponse } from 'next/server';

// 네이버 금융 polling API 응답 구조 (확인된 필드명)
// closePriceRaw: "93020" (숫자형 string, 쉼표 없음)
// compareToPreviousClosePriceRaw: "-1950" (전일 대비 변동폭, 숫자형 string)

interface NaverStockData {
  closePriceRaw?: string;
  compareToPreviousClosePriceRaw?: string;
  [key: string]: unknown;
}

async function fetchNaverPrice(
  code: string
): Promise<{ currentPrice: number; prevClose: number } | null> {
  try {
    const res = await fetch(
      `https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const stockData: NaverStockData = data?.datas?.[0] ?? data;

    const currentPrice = stockData.closePriceRaw != null ? Number(stockData.closePriceRaw) : null;
    const diff = stockData.compareToPreviousClosePriceRaw != null ? Number(stockData.compareToPreviousClosePriceRaw) : 0;

    if (currentPrice == null || isNaN(currentPrice)) return null;

    return {
      currentPrice,
      prevClose: currentPrice - diff,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const codesParam = searchParams.get('codes');

  if (!codesParam) {
    return NextResponse.json({ error: 'codes 파라미터가 필요합니다' }, { status: 400 });
  }

  const codes = codesParam.split(',').filter(Boolean);
  const results = await Promise.allSettled(codes.map(fetchNaverPrice));

  const priceMap: Record<string, { currentPrice: number; prevClose: number } | null> = {};
  codes.forEach((code, i) => {
    const result = results[i];
    priceMap[code] = result.status === 'fulfilled' ? result.value : null;
  });

  return NextResponse.json(priceMap);
}
