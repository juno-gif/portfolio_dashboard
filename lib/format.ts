// 금액 포맷 헬퍼
export function formatKRW(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_0000_0000) {
    return `${(amount / 1_0000_0000).toFixed(1)}억`;
  }
  if (abs >= 10000) {
    return `${Math.round(amount / 10000).toLocaleString('ko-KR')}만`;
  }
  return amount.toLocaleString('ko-KR');
}

export function formatRate(rate: number): string {
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${rate.toFixed(2)}%`;
}

export function formatAmount(amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  return `${sign}₩${Math.abs(amount).toLocaleString('ko-KR')}`;
}
