'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { ConsolidatedHolding } from '@/types/portfolio';
import type { HoldingDividend, DividendEvent } from '@/app/api/dividend/route';

interface Props {
  holdings: ConsolidatedHolding[];
  exchangeRate: number;
}

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function formatKRW(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

function formatLabel(amount: number): string {
  if (amount >= 10000) {
    const man = Math.round(amount / 10000);
    return `${man.toLocaleString('ko-KR')}만`;
  }
  return amount.toLocaleString('ko-KR');
}

function formatPerShare(amount: number, unit: 'KRW' | 'USD'): string {
  if (unit === 'USD') {
    return `$${amount.toFixed(2)}`;
  }
  return `₩${amount.toLocaleString('ko-KR')}`;
}

interface MonthData {
  month: string;
  amount: number;
  hasConfirmed: boolean;
  hasProjected: boolean;
}

interface AccountAmount {
  account: string;
  amountKRW: number;
}

interface MonthGroup {
  monthIndex: number;
  monthLabel: string;
  total: number;
  items: Array<{
    date: string;
    day: number;
    status: 'confirmed' | 'projected';
    종목번호: string;
    종목명: string;
    단위: 'KRW' | 'USD';
    qty: number;
    perShare: number;
    totalKRW: number;
    byAccount: AccountAmount[];
  }>;
}

export default function DividendView({ holdings, exchangeRate }: Props) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [data, setData] = useState<HoldingDividend[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDividends = useCallback(async () => {
    if (holdings.length === 0) return;
    setLoading(true);
    try {
      const payload = {
        holdings: holdings.map((h) => ({
          종목번호: h.종목번호,
          종목명: h.종목명,
          단위: h.단위,
          qty: h.totalQty,
        })),
        exchangeRate,
      };
      const res = await fetch('/api/dividend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [holdings, exchangeRate]);

  useEffect(() => {
    fetchDividends();
  }, [fetchDividends]);

  // 종목번호 → ConsolidatedHolding 조회맵
  const holdingMap = useMemo(() => {
    const map = new Map<string, ConsolidatedHolding>();
    for (const h of holdings) map.set(h.종목번호, h);
    return map;
  }, [holdings]);

  // 계좌별 배당금 계산 (qty 비율)
  function calcByAccount(종목번호: string, totalKRW: number, totalQty: number): AccountAmount[] {
    const holding = holdingMap.get(종목번호);
    if (!holding) return [];
    return holding.byAccount
      .filter((a) => a.qty > 0)
      .map((a) => ({
        account: a.account,
        amountKRW: Math.round(totalKRW * (a.qty / totalQty)),
      }));
  }

  // Filter events for selected year
  const yearEvents = useMemo(() => {
    const yearStr = String(selectedYear);
    return data.flatMap((h) =>
      h.dividends
        .filter((d) => d.date.startsWith(yearStr))
        .map((d) => ({ ...d, 종목번호: h.종목번호, 종목명: h.종목명, 단위: h.단위, qty: h.qty }))
    );
  }, [data, selectedYear]);

  // Annual total
  const annualTotal = useMemo(
    () => yearEvents.reduce((sum, e) => sum + e.totalKRW, 0),
    [yearEvents]
  );

  // 연간 계좌별 합계
  const annualByAccount = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of yearEvents) {
      const breakdown = calcByAccount(e.종목번호, e.totalKRW, e.qty);
      for (const a of breakdown) {
        map.set(a.account, (map.get(a.account) ?? 0) + a.amountKRW);
      }
    }
    return Array.from(map.entries())
      .map(([account, amountKRW]) => ({ account, amountKRW }))
      .sort((a, b) => b.amountKRW - a.amountKRW);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearEvents, holdingMap]);

  // 종목별 연간 배당 요약 (금액 + 매수금액 대비 배당률)
  const stockSummary = useMemo(() => {
    const map = new Map<string, { 종목명: string; totalKRW: number; costKRW: number }>();
    for (const e of yearEvents) {
      const existing = map.get(e.종목번호);
      const holding = holdingMap.get(e.종목번호);
      const costKRW = holding ? holding.avgCost * holding.totalQty : 0;
      if (existing) {
        existing.totalKRW += e.totalKRW;
      } else {
        map.set(e.종목번호, { 종목명: e.종목명, totalKRW: e.totalKRW, costKRW });
      }
    }
    return Array.from(map.values())
      .map((s) => ({
        ...s,
        yieldRate: s.costKRW > 0 ? (s.totalKRW / s.costKRW) * 100 : 0,
      }))
      .sort((a, b) => b.totalKRW - a.totalKRW);
  }, [yearEvents, holdingMap]);

  // Monthly chart data (Jan–Dec)
  const chartData: MonthData[] = useMemo(() => {
    return MONTHS.map((month, idx) => {
      const monthStr = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
      const eventsInMonth = yearEvents.filter((e) => e.date.startsWith(monthStr));
      const amount = eventsInMonth.reduce((sum, e) => sum + e.totalKRW, 0);
      const hasConfirmed = eventsInMonth.some((e) => e.status === 'confirmed');
      const hasProjected = eventsInMonth.some((e) => e.status === 'projected') && !hasConfirmed;
      return { month, amount, hasConfirmed, hasProjected };
    });
  }, [yearEvents, selectedYear]);

  // Monthly grouped list
  const monthGroups: MonthGroup[] = useMemo(() => {
    const groups: MonthGroup[] = [];
    for (let idx = 0; idx < 12; idx++) {
      const monthStr = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
      const items = yearEvents
        .filter((e) => e.date.startsWith(monthStr))
        .map((e) => ({
          date: e.date,
          day: parseInt(e.date.split('-')[2], 10),
          status: e.status,
          종목번호: e.종목번호,
          종목명: e.종목명,
          단위: e.단위,
          qty: e.qty,
          perShare: e.perShare,
          totalKRW: e.totalKRW,
          byAccount: calcByAccount(e.종목번호, e.totalKRW, e.qty),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      if (items.length === 0) continue;
      const total = items.reduce((sum, i) => sum + i.totalKRW, 0);
      groups.push({ monthIndex: idx, monthLabel: MONTHS[idx], total, items });
    }
    return groups;
  }, [yearEvents, selectedYear]);

  // 월 필터 적용
  const visibleGroups = useMemo(
    () => selectedMonth === null ? monthGroups : monthGroups.filter((g) => g.monthIndex === selectedMonth),
    [monthGroups, selectedMonth]
  );

  const years = [currentYear - 1, currentYear, currentYear + 1];

  // Custom label renderer for bar chart
  const renderCustomLabel = (props: Record<string, unknown>) => {
    const { x, y, width, value } = props as { x: number; y: number; width: number; value: number };
    if (!value || value === 0) return null;
    return (
      <text
        x={Number(x) + Number(width) / 2}
        y={Number(y) - 4}
        textAnchor="middle"
        fontSize={10}
        fill="currentColor"
        className="text-foreground"
      >
        {formatLabel(value)}
      </text>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4 mt-4">
        <div className="h-8 bg-muted rounded animate-pulse w-48" />
        <div className="h-48 bg-muted rounded animate-pulse" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">배당 일정</h2>
          {/* Year selector */}
          <div className="flex gap-1">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => { setSelectedYear(y); setSelectedMonth(null); }}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  selectedYear === y
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground'
                }`}
              >
                {y}년
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={fetchDividends}
          className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-3 py-1 transition-colors"
        >
          새로고침
        </button>
      </div>

      {/* Annual total */}
      <div className="bg-card border rounded-xl p-4">
        <p className="text-xs text-muted-foreground mb-1">{selectedYear}년 연간 예상 배당 합계</p>
        <p className="text-2xl font-bold">
          {annualTotal > 0 ? formatKRW(annualTotal) : '—'}
        </p>
        {annualByAccount.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {annualByAccount.map(({ account, amountKRW }) => (
              <span key={account} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{account}</span>
                {' '}
                {amountKRW.toLocaleString('ko-KR')}원
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bar chart */}
      {annualTotal > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide />
              <Tooltip
                formatter={(value: number | undefined) => [value != null ? formatKRW(value) : '—', '배당금']}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar
                dataKey="amount"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                cursor="pointer"
                onClick={(_data, index) =>
                  setSelectedMonth((prev) => (prev === index ? null : index))
                }
              >
                <LabelList dataKey="amount" content={renderCustomLabel as unknown as React.ReactElement} />
                {chartData.map((entry, index) => {
                  const isSelected = selectedMonth === index;
                  const dimmed = selectedMonth !== null && !isSelected;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.amount === 0
                          ? 'transparent'
                          : entry.hasConfirmed
                          ? 'hsl(var(--primary))'
                          : 'hsl(var(--muted-foreground))'
                      }
                      opacity={dimmed ? 0.25 : entry.hasProjected ? 0.5 : 1}
                      stroke={isSelected ? 'hsl(var(--primary))' : 'none'}
                      strokeWidth={isSelected ? 2 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-end">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="inline-block w-3 h-3 rounded-sm bg-primary" />
              확정
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="inline-block w-3 h-3 rounded-sm bg-muted-foreground opacity-50" />
              예상
            </span>
          </div>
        </div>
      )}

      {/* 하단: 월별 리스트(좌) + 종목별 연간 배당(우) */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">

        {/* 좌: 월별 배당 리스트 */}
        <div className="xl:col-span-3">
        {selectedMonth !== null && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{MONTHS[selectedMonth]} 필터 중</span>
            <button
              onClick={() => setSelectedMonth(null)}
              className="text-xs text-primary hover:underline"
            >
              전체 보기
            </button>
          </div>
        )}
        {visibleGroups.length > 0 ? (
        <div className="space-y-3">
          {visibleGroups.map((group) => (
            <div key={group.monthIndex} className="bg-card border rounded-xl overflow-hidden">
              {/* Month header */}
              <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b">
                <span className="text-sm font-semibold">{group.monthLabel}</span>
                <span className="text-sm font-semibold">{formatKRW(group.total)}</span>
              </div>
              {/* Items */}
              <div className="divide-y divide-border">
                {group.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    {/* Day */}
                    <span className="w-6 text-center text-xs font-mono text-muted-foreground shrink-0">
                      {item.day}
                    </span>
                    {/* Badge */}
                    <span
                      className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                        item.status === 'confirmed'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {item.status === 'confirmed' ? '확정' : '예상'}
                    </span>
                    {/* Stock name + qty × per-share */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.종목명}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.qty.toLocaleString()}주 · {formatPerShare(item.perShare, item.단위)}
                      </p>
                    </div>
                    {/* 계좌별 금액 */}
                    <div className="text-right shrink-0">
                      {item.byAccount.map((a) => (
                        <p key={a.account} className="text-xs text-muted-foreground whitespace-nowrap">
                          <span className="font-medium text-foreground">{a.account}</span>
                          {' '}{a.amountKRW.toLocaleString()}원
                        </p>
                      ))}
                    </div>
                    {/* Total KRW */}
                    <span className="text-xs font-semibold whitespace-nowrap shrink-0 w-24 text-right">
                      {item.totalKRW.toLocaleString()}원
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        ) : (
          !loading && (
            <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground text-sm">
              {selectedYear}년 배당 데이터가 없습니다.
            </div>
          )
        )}
        </div>

        {/* 우: 종목별 연간 배당 요약 */}
        {stockSummary.length > 0 && (
          <div className="xl:col-span-2 bg-card border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
              <span className="text-sm font-semibold">종목별 연간 배당</span>
              <span className="text-xs text-muted-foreground">{selectedYear}년</span>
            </div>
            <div className="divide-y divide-border">
              {stockSummary.map((s) => (
                <div key={s.종목명} className="flex items-center justify-between px-4 py-2.5 gap-3">
                  <span className="text-xs font-medium flex-1 min-w-0 truncate">{s.종목명}</span>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold">{s.totalKRW.toLocaleString()}원</p>
                    {s.yieldRate > 0 && (
                      <p className="text-xs text-green-500">
                        배당률 {s.yieldRate.toFixed(2)}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>{/* end grid */}
    </div>
  );
}
