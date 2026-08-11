'use client';

import { useState, useEffect } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { ConsolidatedHolding, RawHolding } from '@/types/portfolio';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatRate } from '@/lib/format';
import { ETFHolding } from '@/app/api/etf-holdings/route';

type ChartRange = '1d' | '5d' | '3mo' | '1y';
const RANGE_LABELS: { value: ChartRange; label: string }[] = [
  { value: '1d', label: '1일' },
  { value: '5d', label: '1주' },
  { value: '3mo', label: '3개월' },
  { value: '1y', label: '1년' },
];

function PriceChart({ ticker, unit, open, defaultRange = '3mo' }: {
  ticker: string;
  unit: string;
  open: boolean;
  defaultRange?: ChartRange;
}) {
  const isUSD = unit === 'USD';
  const [chartRange, setChartRange] = useState<ChartRange>(defaultRange);
  const [chartData, setChartData] = useState<{ date: string; price: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [isIntraday, setIsIntraday] = useState(false);
  const [sessionTypes, setSessionTypes] = useState<string[]>([]);
  const [isPrevDay, setIsPrevDay] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChartData([]);
    setSessionTypes([]);
    setIsPrevDay(false);
    setChartLoading(true);
    fetch(`/api/chart?ticker=${encodeURIComponent(ticker)}&unit=${unit}&range=${chartRange}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.dates && d?.prices) {
          setChartData(d.dates.map((date: string, i: number) => ({ date, price: d.prices[i] })));
          setIsIntraday(d.isIntraday ?? false);
          setSessionTypes(d.sessionTypes ?? []);
          setIsPrevDay(d.isPrevDay ?? false);
        }
      })
      .catch(() => {})
      .finally(() => setChartLoading(false));
  }, [open, ticker, chartRange, unit]);

  const gradId = `chartGrad-${ticker.replace(/[^a-zA-Z0-9]/g, '_')}`;

  return (
    <div className="mb-6">
      <div className="flex gap-1 mb-2 justify-end items-center">
        {isPrevDay && chartRange === '1d' && (
          <span className="text-[10px] text-amber-500 mr-auto">전일 기준</span>
        )}
        {RANGE_LABELS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setChartRange(value)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              chartRange === value
                ? 'bg-foreground text-background font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="h-44">
        {chartLoading ? (
          <div className="h-full bg-muted rounded-lg animate-pulse" />
        ) : chartData.length > 0 ? (() => {
          const isUp = chartData[chartData.length - 1].price >= chartData[0].price;
          const color = isUp ? '#22c55e' : '#ef4444';
          const prices = chartData.map((d) => d.price);
          const minP = Math.min(...prices);
          const maxP = Math.max(...prices);
          const minIdx = prices.indexOf(minP);
          const maxIdx = prices.indexOf(maxP);
          const pad = (maxP - minP) * 0.15 || 1;
          const fmtP = (p: number) => isUSD ? `$${p.toFixed(2)}` : `₩${Math.round(p).toLocaleString('ko-KR')}`;
          const fmtDate = (dateStr: string) => isIntraday ? dateStr : dateStr.slice(5).replace('-', '/');
          const total = chartData.length;
          const minAnchor = minIdx > total * 0.7 ? 'end' : 'start';
          const maxAnchor = maxIdx > total * 0.7 ? 'end' : 'start';
          const maxLabel = `최고 ${fmtP(maxP)} (${fmtDate(chartData[maxIdx].date)})`;
          const minLabel = `최저 ${fmtP(minP)} (${fmtDate(chartData[minIdx].date)})`;

          const hasNxt = sessionTypes.length === chartData.length && sessionTypes.some((s) => s === 'NXT');
          const NXT_COLOR = '#94a3b8';
          const nxtOverlay = hasNxt ? chartData.map((d, i) => {
            const isNxt = sessionTypes[i] === 'NXT';
            const adjKrx = isNxt && (
              (i > 0 && sessionTypes[i - 1] === 'KRX') ||
              (i < total - 1 && sessionTypes[i + 1] === 'KRX')
            );
            const adjNxt = !isNxt && (
              (i > 0 && sessionTypes[i - 1] === 'NXT') ||
              (i < total - 1 && sessionTypes[i + 1] === 'NXT')
            );
            return {
              date: d.date,
              krxPrice: (!isNxt || adjKrx) ? d.price : null,
              nxtPrice: (isNxt || adjNxt) ? d.price : null,
            };
          }) : null;

          return (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={nxtOverlay ?? chartData} margin={{ top: 20, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => isIntraday ? v : v.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis hide domain={[minP - pad, maxP + pad]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const entry = payload[0];
                    const date: string = entry.payload.date;
                    const price: number = entry.payload.krxPrice ?? entry.payload.nxtPrice ?? entry.payload.price;
                    const isNxtPoint = nxtOverlay && entry.payload.krxPrice == null && entry.payload.nxtPrice != null;
                    return (
                      <div className="bg-background border rounded px-2 py-1 text-xs shadow">
                        <p className="text-muted-foreground">{date}{isNxtPoint ? ' · NXT' : ''}</p>
                        <p className="font-semibold">{price?.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey={nxtOverlay ? 'krxPrice' : 'price'} stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} connectNulls={false} />
                {nxtOverlay && (
                  <Line type="monotone" dataKey="nxtPrice" stroke={NXT_COLOR} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                )}
                <ReferenceDot
                  x={chartData[maxIdx].date}
                  y={maxP}
                  r={3}
                  fill="#ef4444"
                  stroke="white"
                  strokeWidth={1}
                  label={{ value: maxLabel, position: 'top', fontSize: 9, fill: '#ef4444', offset: 4, textAnchor: maxAnchor }}
                />
                <ReferenceDot
                  x={chartData[minIdx].date}
                  y={minP}
                  r={3}
                  fill="#3b82f6"
                  stroke="white"
                  strokeWidth={1}
                  label={{ value: minLabel, position: 'bottom', fontSize: 9, fill: '#3b82f6', offset: 4, textAnchor: minAnchor }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          );
        })() : null}
      </div>
    </div>
  );
}

function ConstituentDrawer({ holding, open, onClose, unit }: {
  holding: ETFHolding | null;
  open: boolean;
  onClose: () => void;
  unit: string;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[360px] sm:w-[440px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <span>{holding?.name || holding?.symbol}</span>
            {holding?.name && holding?.symbol && (
              <span className="text-sm text-muted-foreground font-normal">{holding.symbol}</span>
            )}
          </SheetTitle>
        </SheetHeader>
        {holding?.symbol && (
          <PriceChart
            key={holding.symbol}
            ticker={holding.symbol}
            unit={unit}
            open={open}
            defaultRange="1d"
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

interface StockDetailDrawerProps {
  holding: ConsolidatedHolding | null;
  open: boolean;
  onClose: () => void;
  exchangeRate?: number;
  rawEntries?: RawHolding[];
  onEdit?: (entries: RawHolding[]) => void;
}

export default function StockDetailDrawer({
  holding,
  open,
  onClose,
  exchangeRate = 1370,
  rawEntries,
  onEdit,
}: StockDetailDrawerProps) {
  const [etfHoldings, setEtfHoldings] = useState<ETFHolding[] | null>(null);
  const [constituentChange, setConstituentChange] = useState<Record<string, number | null>>({});
  const [selectedConstituent, setSelectedConstituent] = useState<ETFHolding | null>(null);
  const [constituentOpen, setConstituentOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editRows, setEditRows] = useState<{ account: string; qty: string; avgCost: string }[]>([]);
  const [editSaveError, setEditSaveError] = useState('');

  useEffect(() => {
    setEtfHoldings(null);
    setConstituentChange({});
    setEditMode(false);
    setEditRows([]);
    setEditSaveError('');
  }, [holding?.종목번호]);

  useEffect(() => {
    if (!open || !holding) return;
    fetch(`/api/etf-holdings?ticker=${encodeURIComponent(holding.종목번호)}&unit=${holding.단위}`)
      .then((r) => r.json())
      .then((d) => { if (d?.holdings?.length) setEtfHoldings(d.holdings); })
      .catch(() => {});
  }, [open, holding?.종목번호]);

  // ETF 구성 종목의 오늘 등락률 (기존 price/price-us 시세 API 재사용)
  useEffect(() => {
    if (!etfHoldings?.length || !holding) return;
    const symbols = [...new Set(etfHoldings.map((h) => h.symbol).filter(Boolean))];
    if (!symbols.length) return;
    const url = holding.단위 === 'USD'
      ? `/api/price-us?tickers=${symbols.join(',')}`
      : `/api/price?codes=${symbols.join(',')}`;
    fetch(url)
      .then((r) => r.json())
      .then((data: Record<string, { currentPrice: number; prevClose: number } | null>) => {
        const map: Record<string, number | null> = {};
        for (const sym of symbols) {
          const d = data[sym];
          map[sym] = d?.prevClose ? ((d.currentPrice - d.prevClose) / d.prevClose) * 100 : null;
        }
        setConstituentChange(map);
      })
      .catch(() => {});
  }, [etfHoldings, holding?.단위]);

  if (!holding) return null;

  const isUSD = holding.단위 === 'USD';

  function startEdit() {
    if (!rawEntries?.length) return;
    setEditRows(rawEntries.map((e) => ({
      account: e.계좌,
      qty: String(e.수량),
      avgCost: String(e.평균단가),
    })));
    setEditSaveError('');
    setEditMode(true);
  }

  function saveEdit() {
    setEditSaveError('');
    const updated: RawHolding[] = [];
    for (const row of editRows) {
      const qty = parseFloat(row.qty);
      const avgCost = parseFloat(row.avgCost);
      if (isNaN(qty) || qty < 0) { setEditSaveError('수량을 올바르게 입력해주세요'); return; }
      if (isNaN(avgCost) || avgCost <= 0) { setEditSaveError('평단가를 올바르게 입력해주세요'); return; }
      if (qty > 0) {
        const original = rawEntries?.find((e) => e.계좌 === row.account);
        if (original) updated.push({ ...original, 수량: qty, 평균단가: avgCost });
      }
    }
    onEdit?.(updated);
    setEditMode(false);
  }
  const todayPositive = holding.todayGainRate >= 0;
  const totalPositive = holding.gainRate >= 0;
  const gainPositive = holding.gainAmount >= 0;
  const costAmount = holding.avgCost * holding.totalQty;
  const avgCostDisplay = isUSD ? holding.avgCost / exchangeRate : holding.avgCost;
  const currentPriceDisplay = holding.currentPrice;
  const fmtCurrency = (v: number) =>
    isUSD
      ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `₩${Math.round(v).toLocaleString('ko-KR')}`;
  const fmtAmount = (krw: number) =>
    isUSD
      ? `$${Math.round(krw / exchangeRate).toLocaleString('en-US')}`
      : `₩${Math.round(krw / 10000).toLocaleString('ko-KR')}만`;
  const fmtGain = (krw: number) => {
    const sign = krw >= 0 ? '+' : '-';
    const abs = Math.abs(krw);
    return isUSD
      ? `${sign}$${Math.round(abs / exchangeRate).toLocaleString('en-US')}`
      : `${sign}₩${Math.round(abs / 10000).toLocaleString('ko-KR')}만`;
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 flex-wrap pr-8">
              <a
                href={isUSD
                  ? `https://finance.yahoo.com/quote/${holding.종목번호}`
                  : `https://finance.naver.com/item/main.naver?code=${holding.종목번호}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-2 cursor-pointer"
              >
                {holding.종목명}
              </a>
              <span className="text-sm text-muted-foreground font-normal">
                {holding.종목번호}
              </span>
              <Badge className="text-xs">{holding.sector}</Badge>
            </SheetTitle>
            {onEdit && !editMode && (
              <button
                onClick={startEdit}
                className="mt-2 text-xs px-2.5 py-1 rounded-md border hover:bg-muted transition-colors w-fit"
              >
                수정
              </button>
            )}
          </SheetHeader>

          {/* 수정 모드 */}
          {editMode && (
            <div className="mb-6 space-y-3">
              <div className="space-y-2">
                {editRows.map((row, idx) => (
                  <div key={row.account} className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{row.account}</span>
                      <button
                        onClick={() => setEditRows((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">수량</label>
                        <input
                          type="number"
                          value={row.qty}
                          onChange={(e) =>
                            setEditRows((prev) =>
                              prev.map((r, i) => i === idx ? { ...r, qty: e.target.value } : r)
                            )
                          }
                          className="border border-input rounded-md px-2 py-1.5 text-sm bg-background w-full focus:outline-none focus:ring-1 focus:ring-ring"
                          min={0}
                          step="any"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          평단가 {isUSD ? '($)' : '(원)'}
                        </label>
                        <input
                          type="number"
                          value={row.avgCost}
                          onChange={(e) =>
                            setEditRows((prev) =>
                              prev.map((r, i) => i === idx ? { ...r, avgCost: e.target.value } : r)
                            )
                          }
                          className="border border-input rounded-md px-2 py-1.5 text-sm bg-background w-full focus:outline-none focus:ring-1 focus:ring-ring"
                          min={0}
                          step="any"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {editRows.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-lg">
                    모든 계좌를 삭제하면 해당 종목이 제거됩니다.
                  </p>
                )}
              </div>
              {editSaveError && <p className="text-xs text-red-500">{editSaveError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  className="flex-1 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  저장
                </button>
                <button
                  onClick={() => { setEditMode(false); setEditSaveError(''); }}
                  className="flex-1 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 주가 차트 (수정 모드일 때 숨김) */}
          {!editMode && <PriceChart
            key={holding.종목번호}
            ticker={holding.종목번호}
            unit={holding.단위}
            open={open}
            defaultRange="3mo"
          />}

          {/* 요약 지표 */}
          {!editMode && <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">총 보유수량</p>
              <p className="text-lg font-bold">{holding.totalQty.toLocaleString('ko-KR')}주</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">평가이익</p>
              <p className={`text-lg font-bold ${gainPositive ? 'text-green-500' : 'text-red-500'}`}>
                {fmtGain(holding.gainAmount)}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">매수금액</p>
              <p className="text-lg font-bold">
                {fmtAmount(costAmount)}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">총 평가금액</p>
              <p className="text-lg font-bold">
                {isUSD
                  ? `$${(holding.currentPrice * holding.totalQty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : fmtAmount(holding.evalAmount)}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">평단가</p>
              <p className="text-lg font-bold">
                {fmtCurrency(avgCostDisplay)}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">현재 주가</p>
              <p className={`text-lg font-bold ${todayPositive ? 'text-green-500' : 'text-red-500'}`}>
                {fmtCurrency(currentPriceDisplay)}
              </p>
              {holding.priceLabel && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{holding.priceLabel}</p>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">오늘 수익률</p>
              <p className={`text-lg font-bold ${todayPositive ? 'text-green-500' : 'text-red-500'}`}>
                {formatRate(holding.todayGainRate)}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">전체 수익률</p>
              <p className={`text-lg font-bold ${totalPositive ? 'text-green-500' : 'text-red-500'}`}>
                {formatRate(holding.gainRate)}
              </p>
            </div>
          </div>}

          {!editMode && holding.priceUnavailable && (
            <p className="text-xs text-amber-500 mb-4 bg-amber-50 rounded p-2">
              ⚠️ 현재가 조회에 실패하여 평균단가 기준으로 표시됩니다.
            </p>
          )}

          {/* 계좌별 분포 */}
          {!editMode && <div>
            <h3 className="text-sm font-semibold mb-3">계좌별 분포</h3>
            <div className="space-y-3">
              {holding.byAccount.map((acc) => (
                <div key={acc.account}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{acc.account}</span>
                    <div className="flex gap-3 text-muted-foreground">
                      <span>{acc.qty.toLocaleString('ko-KR')}주</span>
                      <span>₩{Math.round(acc.evalAmount / 10000).toLocaleString('ko-KR')}만</span>
                      <span className="font-semibold text-foreground">{acc.ratio.toFixed(1)}%</span>
                    </div>
                  </div>
                  <Progress value={acc.ratio} className="h-2" />
                </div>
              ))}
            </div>
          </div>}

          {/* ETF 구성 */}
          {etfHoldings && etfHoldings.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-3">ETF 구성 종목 (상위 {etfHoldings.length}개)</h3>
              <div className="space-y-1">
                {etfHoldings.map((h) => {
                  const chg = constituentChange[h.symbol];
                  const chgPositive = chg != null && chg >= 0;
                  return (
                    <div
                      key={h.symbol || h.name}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md px-1.5 py-1 -mx-1.5 transition-colors group"
                      onClick={() => {
                        setSelectedConstituent(h);
                        setConstituentOpen(true);
                      }}
                    >
                      <div className="w-24 shrink-0">
                        <div className="text-xs font-medium truncate">{h.name || h.symbol}</div>
                        {h.name && h.symbol && <div className="text-[10px] text-muted-foreground">{h.symbol}</div>}
                      </div>
                      {h.pct !== null ? (
                        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-foreground/40 rounded-full"
                            style={{ width: `${Math.min(h.pct * 2, 100)}%` }}
                          />
                        </div>
                      ) : (
                        <div className="flex-1" />
                      )}
                      <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
                        {h.pct !== null ? `${h.pct}%` : '-'}
                      </span>
                      <span className={`text-xs w-12 text-right shrink-0 ${chg == null ? 'text-muted-foreground/50' : chgPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {chg != null ? `${chgPositive ? '+' : ''}${chg.toFixed(2)}%` : '-'}
                      </span>
                      <svg
                        className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ConstituentDrawer
        holding={selectedConstituent}
        open={constituentOpen}
        onClose={() => setConstituentOpen(false)}
        unit={holding.단위}
      />
    </>
  );
}
