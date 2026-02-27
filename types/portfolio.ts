export interface RawHolding {
  계좌: string; // ISA | 연금저축A | 연금저축B | CMA | IRP
  종목명: string;
  종목번호: string; // 국내: 6자리 코드, 미국: 티커
  수량: number;
  평균단가: number;
  단위: 'KRW' | 'USD';
}

export type SectorKey =
  | '미국지수'
  | '국내지수'
  | '금'
  | '방산/테마'
  | '채권/혼합'
  | '해외기타'
  | '개별주'
  | '기타';

export interface HoldingWithMeta extends RawHolding {
  sector: SectorKey;
  currentPrice: number; // 현재가 (원화 또는 달러, 단위 기준)
  currentPriceKRW: number; // KRW 환산 현재가
  evalAmount: number; // 평가금액 KRW
  gainAmount: number; // 평가손익 KRW
  gainRate: number; // 수익률 %
  todayGainAmount: number; // 오늘 손익 KRW (전일종가 대비)
  todayGainRate: number; // 오늘 수익률 %
  prevClose: number; // 전일종가 (단위 기준)
  priceUnavailable?: boolean; // 현재가 조회 실패 여부
}

export interface ConsolidatedHolding {
  종목번호: string;
  종목명: string;
  단위: 'KRW' | 'USD';
  sector: SectorKey;
  totalQty: number;
  avgCost: number; // 가중평균 단가 KRW
  currentPrice: number;
  evalAmount: number; // KRW
  gainAmount: number; // KRW
  gainRate: number; // %
  todayGainAmount: number; // KRW
  todayGainRate: number; // %
  priceUnavailable?: boolean;
  byAccount: {
    account: string;
    qty: number;
    evalAmount: number;
    ratio: number; // 이 종목 내 계좌 비중 %
  }[];
}

export interface AccountSummary {
  account: string;
  evalAmount: number; // KRW
  todayGainAmount: number; // KRW
  todayGainRate: number; // %
}

export interface SectorAllocation {
  sector: SectorKey;
  amount: number; // KRW
  ratio: number; // %
  color: string; // 파이차트 색상
}

export interface PortfolioSummary {
  totalEval: number; // 총 평가금액 KRW
  totalCost: number; // 총 투자원금 KRW
  totalGainAmount: number; // 전체기간 손익 KRW
  totalGainRate: number; // 전체기간 수익률 %
  todayGainAmount: number; // 오늘 손익 KRW
  todayGainRate: number; // 오늘 수익률 %
  exchangeRate: number; // 당일 USD/KRW
  updatedAt: string; // 업데이트 시각
}

export type PriceMap = Record<
  string,
  { currentPrice: number; prevClose: number } | null
>;
