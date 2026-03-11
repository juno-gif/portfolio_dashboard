import {
  CashFlowEvent,
  ProjectionParams,
  ProjectionYear,
} from '@/types/portfolio';

const PROJECTION_YEARS = 50;

/**
 * 특정 연도에 발생하는 이벤트 현금흐름 합계 계산 (만원)
 */
function getEventCashFlow(
  events: CashFlowEvent[],
  year: number,
  age: number
): { total: number; hasEvent: boolean } {
  let total = 0;
  let hasEvent = false;

  for (const event of events) {
    if (event.type === 'one-time' && event.year === year) {
      total += event.amount;
      hasEvent = true;
    } else if (event.type === 'recurring') {
      const inRange =
        age >= event.startAge &&
        (event.endAge === undefined || age <= event.endAge);
      if (inRange) {
        total += event.monthlyAmount * 12;
        hasEvent = true;
      }
    }
  }

  return { total, hasEvent };
}

/**
 * 올해 남은 기간 비율 계산 (오늘 ~ 12/31)
 */
function getRemainingYearFraction(): number {
  const today = new Date();
  const year = today.getFullYear();
  const startOfNextYear = new Date(year + 1, 0, 1).getTime();
  const startOfYear = new Date(year, 0, 1).getTime();
  const now = today.getTime();
  return (startOfNextYear - now) / (startOfNextYear - startOfYear);
}

/**
 * 50년치 연도별 자산 예측 계산
 *
 * 공식:
 *   첫 해(i=0): 기초 = 현재 자산, 수익률 = r * 잔여기간비율 (당해 부분 반영)
 *   이후 연도:  기초 = 기말[yr-1] * (1 + r)   ← 전년 기말에 연 수익률 적용
 *   기말[yr]  = 기초[yr] + inOut * (1 + effectiveR * 0.5)
 *   증감      = 기말[yr] - 기말[yr-1]
 */
export function calcProjection(params: ProjectionParams): ProjectionYear[] {
  const { totalEval, currentAge, annualReturn: r, events } = params;

  const currentYear = new Date().getFullYear();
  const remainingFraction = getRemainingYearFraction();
  // 현재 자산을 만원 단위로 변환
  const initialAssetsMan = totalEval / 10000;

  const rows: ProjectionYear[] = [];
  let prevEndAssets = initialAssetsMan;

  for (let i = 0; i < PROJECTION_YEARS; i++) {
    const year = currentYear + i;
    const age = currentAge + i;

    // 첫 해는 잔여기간 비율, 이후는 전체 연도 수익률
    const effectiveR = i === 0 ? r * remainingFraction : r;
    const beginAssets = i === 0 ? prevEndAssets : prevEndAssets * (1 + r);
    const { total: eventCashFlow, hasEvent } = getEventCashFlow(events, year, age);
    const inOut = eventCashFlow;
    const endAssets = beginAssets * (i === 0 ? 1 + effectiveR : 1) + inOut * (1 + effectiveR * 0.5);
    const gain = endAssets - prevEndAssets;
    const monthlyGain = gain / 12;

    rows.push({
      year,
      age,
      beginAssets: Math.round(beginAssets),
      inOut: Math.round(inOut),
      endAssets: Math.round(endAssets),
      gain: Math.round(gain),
      monthlyGain: Math.round(monthlyGain),
      hasEvent,
    });

    prevEndAssets = endAssets;
  }

  return rows;
}
