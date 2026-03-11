'use client';

import { useState, useMemo, useId, useEffect, useRef, useCallback } from 'react';
import { CashFlowEvent, ProjectionParams } from '@/types/portfolio';
import { calcProjection } from '@/lib/projection-calculator';
import ProjectionChart from './ProjectionChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const LS_KEY = 'projection_params';

interface SavedParams {
  currentAge: string;
  annualReturn: string;
  inflationRate: string;
  events: CashFlowEvent[];
}

interface ProjectionViewProps {
  totalEval: number; // 원
  token: string | null;
}

function fmt(v: number): string {
  return v.toLocaleString('ko-KR');
}

function fmtSigned(v: number): string {
  return (v >= 0 ? '+' : '') + fmt(v);
}

export default function ProjectionView({ totalEval, token }: ProjectionViewProps) {
  const [currentAge, setCurrentAge] = useState<string>('');
  const [annualReturn, setAnnualReturn] = useState<string>('7');
  const [inflationRate, setInflationRate] = useState<string>('2.5');
  const [events, setEvents] = useState<CashFlowEvent[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadedRef = useRef(false);

  // 마운트 시 저장된 값 복원 (KV → localStorage 순)
  useEffect(() => {
    (async () => {
      let saved: SavedParams | null = null;

      if (token) {
        try {
          const res = await fetch(`/api/projection?token=${token}`);
          if (res.ok) {
            saved = await res.json();
          }
        } catch {
          // KV 실패 시 localStorage로 fallback
        }
      }

      // localStorage는 토큰이 있는 경우(KV fallback)에만 사용, 토큰별 키로 분리
      if (!saved && token) {
        const lsKey = `${LS_KEY}_${token}`;
        try {
          const raw = localStorage.getItem(lsKey);
          if (raw) saved = JSON.parse(raw);
        } catch {
          localStorage.removeItem(lsKey);
        }
      }

      if (saved) {
        setCurrentAge(saved.currentAge ?? '');
        setAnnualReturn(saved.annualReturn ?? '7');
        setInflationRate(saved.inflationRate ?? '2.5');
        setEvents(saved.events ?? []);
      }
      isLoadedRef.current = true;
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 파라미터 변경 시 자동 저장 (debounce 1.5s)
  const triggerSave = useCallback(() => {
    if (!isLoadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      const payload: SavedParams = { currentAge, annualReturn, inflationRate, events };
      try {
        // 토큰별 키로 저장 (토큰 없으면 localStorage 스킵)
        if (token) {
          localStorage.setItem(`${LS_KEY}_${token}`, JSON.stringify(payload));
          await fetch(`/api/projection?token=${token}`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
      }
    }, 1500);
  }, [currentAge, annualReturn, inflationRate, events, token]);

  useEffect(() => {
    triggerSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAge, annualReturn, inflationRate, events]);

  // 이벤트 추가 폼 상태
  const [newType, setNewType] = useState<'one-time' | 'recurring'>('one-time');
  const [newYear, setNewYear] = useState<string>('');
  const [newAmount, setNewAmount] = useState<string>('');
  const [newLabel, setNewLabel] = useState<string>('');
  const [newStartAge, setNewStartAge] = useState<string>('');
  const [newEndAge, setNewEndAge] = useState<string>('');
  const [newMonthly, setNewMonthly] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const selectId = useId();

  const params: ProjectionParams | null = useMemo(() => {
    const age = parseInt(currentAge);
    const r = parseFloat(annualReturn) / 100;
    if (!age || age <= 0 || isNaN(r)) return null;
    return { totalEval, currentAge: age, annualReturn: r, events };
  }, [totalEval, currentAge, annualReturn, events]);

  const rows = useMemo(() => (params ? calcProjection(params) : []), [params]);

  function addEvent() {
    setFormError('');
    if (newType === 'one-time') {
      const year = parseInt(newYear);
      const amount = parseFloat(newAmount);
      if (isNaN(year) || year < 2000) { setFormError('연도를 올바르게 입력해주세요 (예: 2041)'); return; }
      if (isNaN(amount)) { setFormError('금액을 입력해주세요 (예: 40000 또는 -8000)'); return; }
      if (!newLabel.trim()) { setFormError('설명을 입력해주세요'); return; }
      setEvents((prev) => [
        ...prev,
        { type: 'one-time', year, amount, label: newLabel.trim() },
      ]);
    } else {
      const startAge = parseInt(newStartAge);
      const monthly = parseFloat(newMonthly);
      if (isNaN(startAge) || startAge <= 0) { setFormError('시작 나이를 입력해주세요 (예: 65)'); return; }
      if (isNaN(monthly)) { setFormError('월 금액을 입력해주세요 (예: 150 또는 -300)'); return; }
      if (!newLabel.trim()) { setFormError('설명을 입력해주세요'); return; }
      setEvents((prev) => [
        ...prev,
        {
          type: 'recurring',
          startAge,
          endAge: newEndAge ? parseInt(newEndAge) : undefined,
          monthlyAmount: monthly,
          label: newLabel.trim(),
        },
      ]);
    }
    setNewYear('');
    setNewAmount('');
    setNewLabel('');
    setNewStartAge('');
    setNewEndAge('');
    setNewMonthly('');
  }

  function removeEvent(index: number) {
    setEvents((prev) => prev.filter((_, i) => i !== index));
  }

  const inputCls =
    'border border-input rounded-md px-2 py-1.5 text-sm bg-background w-full focus:outline-none focus:ring-1 focus:ring-ring';

  return (
    <div className="space-y-4">
      {/* 기본 설정 */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">기본 설정</CardTitle>
          {saveStatus !== 'idle' && (
            <span className="text-[11px] text-muted-foreground">
              {saveStatus === 'saving' ? '저장 중...' : '저장됨 ✓'}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">현재 자산</label>
              <div className="border border-input rounded-md px-2 py-1.5 text-sm bg-muted text-muted-foreground">
                ₩{totalEval.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">현재 나이 (세)</label>
              <input
                type="number"
                className={inputCls}
                value={currentAge}
                onChange={(e) => setCurrentAge(e.target.value)}
                placeholder="예: 40"
                min={1}
                max={100}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">연 평균 수익률 (%)</label>
              <input
                type="number"
                className={inputCls}
                value={annualReturn}
                onChange={(e) => setAnnualReturn(e.target.value)}
                placeholder="7"
                step="0.1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">인플레이션율 (%)</label>
              <input
                type="number"
                className={inputCls}
                value={inflationRate}
                onChange={(e) => setInflationRate(e.target.value)}
                placeholder="2.5"
                step="0.1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 현금흐름 이벤트 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">현금흐름 이벤트</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 기존 이벤트 목록 */}
          {events.length > 0 && (
            <div className="space-y-1.5">
              {events.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs bg-muted rounded-md px-3 py-2"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium">
                      {ev.type === 'one-time' ? '일회성' : '반복'}
                    </span>
                    {ev.type === 'one-time' ? (
                      <span>{ev.year}년</span>
                    ) : (
                      <span>
                        {ev.startAge}세{ev.endAge ? `~${ev.endAge}세` : '~'}
                      </span>
                    )}
                    <span className="font-medium">{ev.label}</span>
                    <span
                      className={
                        (ev.type === 'one-time' ? ev.amount : ev.monthlyAmount) >= 0
                          ? 'text-green-500'
                          : 'text-red-500'
                      }
                    >
                      {ev.type === 'one-time'
                        ? `${fmtSigned(ev.amount)}만원`
                        : `월 ${fmtSigned(ev.monthlyAmount)}만원`}
                    </span>
                  </div>
                  <button
                    onClick={() => removeEvent(i)}
                    className="text-muted-foreground hover:text-foreground ml-2 shrink-0"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 새 이벤트 추가 폼 */}
          <div className="border border-dashed border-border rounded-md p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <label htmlFor={selectId} className="text-xs text-muted-foreground shrink-0">유형</label>
              <select
                id={selectId}
                className="border border-input rounded-md px-2 py-1.5 text-xs bg-background"
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'one-time' | 'recurring')}
              >
                <option value="one-time">일회성</option>
                <option value="recurring">반복</option>
              </select>
            </div>

            {newType === 'one-time' ? (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">연도</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    placeholder="2041"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">금액 (만원)</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="+40000 / -8000"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">설명</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="퇴직금"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">시작 나이</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={newStartAge}
                    onChange={(e) => setNewStartAge(e.target.value)}
                    placeholder="65"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">종료 나이 (선택)</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={newEndAge}
                    onChange={(e) => setNewEndAge(e.target.value)}
                    placeholder="없으면 끝까지"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    월 금액 (만원)
                    <span className="ml-1 text-[10px] text-muted-foreground/60">현재가치 기준</span>
                  </label>
                  <input
                    type="number"
                    className={inputCls}
                    value={newMonthly}
                    onChange={(e) => setNewMonthly(e.target.value)}
                    placeholder="+150 / -300"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">설명</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="국민연금"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={addEvent}
                className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                + 추가
              </button>
              {formError && (
                <span className="text-xs text-red-500">{formError}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 결과 영역 */}
      {rows.length > 0 ? (
        <>
          {/* 바 차트 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">연도별 자산 추이</CardTitle>
              <p className="text-xs text-muted-foreground">
                파란색: 일반 연도 / 노란색: 이벤트 발생 연도 (단위: 억원)
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <ProjectionChart data={rows} />
            </CardContent>
          </Card>

          {/* 테이블 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">연도별 상세 (단위: 만원)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 overflow-x-auto">
              {(() => {
                const inflation = parseFloat(inflationRate) / 100;
                const validInflation = !isNaN(inflation) && inflation >= 0;
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">연도</TableHead>
                        <TableHead className="text-xs">나이</TableHead>
                        <TableHead className="text-xs text-right">기초</TableHead>
                        <TableHead className="text-xs text-right">입/출금</TableHead>
                        <TableHead className="text-xs text-right">기말</TableHead>
                        <TableHead className="text-xs text-right">증감</TableHead>
                        <TableHead className="text-xs text-right">증감(월)</TableHead>
                        {validInflation && (
                          <TableHead className="text-xs text-right text-muted-foreground">
                            현재가치
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, i) => {
                        const gainNeg = row.gain < 0;
                        const presentValue = validInflation
                          ? Math.round(row.endAssets / Math.pow(1 + inflation, i + 1))
                          : null;
                        return (
                          <TableRow key={row.year} className={row.hasEvent ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                            <TableCell className="text-xs font-medium">{row.year}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{row.age}세</TableCell>
                            <TableCell className="text-xs text-right">{fmt(row.beginAssets)}</TableCell>
                            <TableCell className={`text-xs text-right ${row.inOut < 0 ? 'text-red-500' : row.inOut > 0 ? 'text-green-500' : ''}`}>
                              {row.inOut !== 0 ? fmtSigned(row.inOut) : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-right font-medium">{fmt(row.endAssets)}</TableCell>
                            <TableCell className={`text-xs text-right ${gainNeg ? 'text-red-500' : 'text-green-500'}`}>
                              {fmtSigned(row.gain)}
                            </TableCell>
                            <TableCell className={`text-xs text-right ${gainNeg ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {fmtSigned(row.monthlyGain)}
                            </TableCell>
                            {validInflation && (
                              <TableCell className="text-xs text-right text-muted-foreground">
                                {fmt(presentValue!)}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          현재 나이와 수익률을 입력하면 예측 결과가 표시됩니다.
        </div>
      )}
    </div>
  );
}
