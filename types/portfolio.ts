export interface RawHolding {
  계좌: string; // ISA | 연금저축A | 연금저축B | CMA | IRP
  종목명: string;
  종목번호: string; // 국내: 6자리 코드, 미국: 티커
  수량: number;
  평균단가: number;
  단위: 'KRW' | 'USD';
}

// 커스텀 섹터 추가를 지원하기 위해 string으로 확장
export type SectorKey = string;

export interface SectorDef {
  name: string;
  color: string;
}

export interface SectorConfigStore {
  sectors: SectorDef[];
  overrides: Record<string, string>; // 종목번호 → 섹터명
}

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

// 미래 자산 예측 관련 타입

export interface OneTimeEvent {
  type: 'one-time';
  year: number;
  amount: number;   // 만원, 음수 허용
  label: string;
}

export interface RecurringEvent {
  type: 'recurring';
  startAge: number;
  endAge?: number;          // 없으면 예측 기간 끝까지
  monthlyAmount: number;    // 만원/월, 음수 허용
  label: string;
}

export type CashFlowEvent = OneTimeEvent | RecurringEvent;

export interface ProjectionParams {
  totalEval: number;          // 현재 자산 (원)
  currentAge: number;
  annualReturn: number;       // 0.07 = 7%
  events: CashFlowEvent[];
}

export interface MiscAsset {
  name: string;
  amount: number; // KRW
}

export interface ProjectionYear {
  year: number;
  age: number;
  beginAssets: number;        // 기초 (만원)
  inOut: number;              // 입/출금 합계 (만원)
  endAssets: number;          // 기말 (만원)
  gain: number;               // 증감 (만원)
  monthlyGain: number;        // 증감(월) (만원)
  hasEvent: boolean;          // 이벤트 있는 행 하이라이트용
}
