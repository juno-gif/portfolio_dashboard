import { RawHolding, PriceMap } from '@/types/portfolio';

// 가격 조회만 담당 (계산은 portfolio-calculator.ts에서 처리)
export async function fetchPrices(holdings: RawHolding[]): Promise<PriceMap> {
  const krwCodes = [...new Set(
    holdings.filter((h) => h.단위 === 'KRW').map((h) => h.종목번호)
  )];
  const usdTickers = [...new Set(
    holdings.filter((h) => h.단위 === 'USD').map((h) => h.종목번호)
  )];

  const [krwResult, usdResult] = await Promise.all([
    krwCodes.length > 0
      ? fetch(`/api/price?codes=${krwCodes.join(',')}`)
          .then((r) => r.json())
          .catch(() => ({}))
      : Promise.resolve({}),
    usdTickers.length > 0
      ? fetch(`/api/price-us?tickers=${usdTickers.join(',')}`)
          .then((r) => r.json())
          .catch(() => ({}))
      : Promise.resolve({}),
  ]);

  return { ...krwResult, ...usdResult } as PriceMap;
}

export async function fetchExchangeRate(): Promise<number> {
  try {
    const res = await fetch('/api/exchange-rate');
    const data = await res.json();
    return data.rate ?? 1370;
  } catch {
    return 1370;
  }
}
