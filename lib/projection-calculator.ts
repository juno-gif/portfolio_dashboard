import {
  CashFlowEvent,
  ProjectionParams,
  ProjectionYear,
} from '@/types/portfolio';

const PROJECTION_YEARS = 50;

function getEventCashFlow(
  events: CashFlowEvent[],
  year: number,
): { total: number; hasEvent: boolean } {
  let total = 0;
  let hasEvent = false;

  for (const event of events) {
    if (event.type === 'one-time' && event.year === year) {
      total += event.amount;
      hasEvent = true;
    } else if (event.type === 'recurring') {
      const inRange =
        year >= event.startYear &&
        (event.endYear === undefined || year <= event.endYear);
      if (inRange) {
        total += event.monthlyAmount * 12;
        hasEvent = true;
      }
    }
  }

  return { total, hasEvent };
}

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
  const { totalEval, birthYear, annualReturn: r, events } = params;

  const currentYear = new Date().getFullYear();
  const remainingFraction = getRemainingYearFraction();
  const initialAssetsMan = totalEval / 10000;

  const rows: ProjectionYear[] = [];
  let prevEndAssets = initialAssetsMan;

  for (let i = 0; i < PROJECTION_YEARS; i++) {
    const year = currentYear + i;
    const age = year - birthYear;

    const effectiveR = i === 0 ? r * remainingFraction : r;
    const beginAssets = i === 0 ? prevEndAssets : prevEndAssets * (1 + r);
    const { total: eventCashFlow, hasEvent } = getEventCashFlow(events, year);
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
