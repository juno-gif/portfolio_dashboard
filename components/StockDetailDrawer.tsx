'use client';

import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { ConsolidatedHolding } from '@/types/portfolio';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatRate } from '@/lib/format';

interface StockDetailDrawerProps {
  holding: ConsolidatedHolding | null;
  open: boolean;
  onClose: () => void;
  exchangeRate?: number;
}

export default function StockDetailDrawer({
  holding,
  open,
  onClose,
  exchangeRate = 1370,
}: StockDetailDrawerProps) {
  if (!holding) return null;

  const isUSD = holding.단위 === 'USD';
  const todayPositive = holding.todayGainRate >= 0;
  const totalPositive = holding.gainRate >= 0;
  const gainPositive = holding.gainAmount >= 0;
  const costAmount = holding.avgCost * holding.totalQty;
  // USD 종목: avgCost(KRW)를 달러로 환산
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

  type ChartRange = '1d' | '5d' | '3mo' | '1y';
  const RANGE_LABELS: { value: ChartRange; label: string }[] = [
    { value: '1d', label: '1일' },
    { value: '5d', label: '1주' },
    { value: '3mo', label: '3개월' },
    { value: '1y', label: '1년' },
  ];

  const [chartRange, setChartRange] = useState<ChartRange>('3mo');
  const [chartData, setChartData] = useState<{ date: string; price: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [isIntraday, setIsIntraday] = useState(false);
  const [sessionTypes, setSessionTypes] = useState<string[]>([]);

  // 종목이 바뀌면 기간 초기화
  useEffect(() => {
    setChartRange('3mo');
  }, [holding?.종목번호]);

  useEffect(() => {
    if (!open || !holding) return;
    setChartData([]);
    setSessionTypes([]);
    setChartLoading(true);
    fetch(`/api/chart?ticker=${encodeURIComponent(holding.종목번호)}&unit=${holding.단위}&range=${chartRange}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.dates && d?.prices) {
          setChartData(d.dates.map((date: string, i: number) => ({ date, price: d.prices[i] })));
          setIsIntraday(d.isIntraday ?? false);
          setSessionTypes(d.sessionTypes ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setChartLoading(false));
  }, [open, holding?.종목번호, chartRange]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <span>{holding.종목명}</span>
            <span className="text-sm text-muted-foreground font-normal">
              {holding.종목번호}
            </span>
            <Badge className="text-xs">{holding.sector}</Badge>
          </SheetTitle>
        </SheetHeader>

        {/* 주가 차트 */}
        <div className="mb-6">
          {/* 기간 선택 */}
          <div className="flex gap-1 mb-2 justify-end">
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

            // NXT 세션 포함 여부 (KRW 1일 뷰)
            const hasNxt = sessionTypes.length === chartData.length && sessionTypes.some(s => s === 'NXT');
            const NXT_COLOR = '#94a3b8'; // slate-400
            // 세션별 데이터 분리 (경계점은 양쪽에 포함해 선 연결 유지)
            const dualData = hasNxt ? chartData.map((d, i) => ({
              date: d.date,
              krxPrice: sessionTypes[i] === 'KRX' ||
                (i > 0 && sessionTypes[i - 1] === 'KRX' && sessionTypes[i] === 'NXT') ||
                (i < total - 1 && sessionTypes[i + 1] === 'KRX' && sessionTypes[i] === 'NXT')
                ? d.price : undefined,
              nxtPrice: sessionTypes[i] === 'NXT' ||
                (i > 0 && sessionTypes[i - 1] === 'NXT' && sessionTypes[i] === 'KRX') ||
                (i < total - 1 && sessionTypes[i + 1] === 'NXT' && sessionTypes[i] === 'KRX')
                ? d.price : undefined,
            })) : null;

            return (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dualData ?? chartData} margin={{ top: 20, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="chartGradNxt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={NXT_COLOR} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={NXT_COLOR} stopOpacity={0} />
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
                      const entry = payload.find(p => p.value != null) ?? payload[0];
                      const date: string = entry.payload.date;
                      const price: number = (entry.value as number) ?? entry.payload.price;
                      const isNxtPoint = dualData && entry.payload.nxtPrice != null && entry.payload.krxPrice == null;
                      return (
                        <div className="bg-background border rounded px-2 py-1 text-xs shadow">
                          <p className="text-muted-foreground">{date}{isNxtPoint ? ' · NXT' : ''}</p>
                          <p className="font-semibold">{price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</p>
                        </div>
                      );
                    }}
                  />
                  {dualData ? (
                    <>
                      <Area type="monotone" dataKey="nxtPrice" stroke={NXT_COLOR} strokeWidth={1.5} fill="url(#chartGradNxt)" dot={false} connectNulls={false} />
                      <Area type="monotone" dataKey="krxPrice" stroke={color} strokeWidth={1.5} fill="url(#chartGrad)" dot={false} connectNulls={false} />
                    </>
                  ) : (
                    <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} fill="url(#chartGrad)" dot={false} />
                  )}
                  <ReferenceDot
                    x={chartData[maxIdx].date}
                    y={maxP}
                    r={3}
                    fill="#ef4444"
                    stroke="white"
                    strokeWidth={1}
                    label={{
                      value: maxLabel,
                      position: 'top',
                      fontSize: 9,
                      fill: '#ef4444',
                      offset: 4,
                      textAnchor: maxAnchor,
                    }}
                  />
                  <ReferenceDot
                    x={chartData[minIdx].date}
                    y={minP}
                    r={3}
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth={1}
                    label={{
                      value: minLabel,
                      position: 'bottom',
                      fontSize: 9,
                      fill: '#3b82f6',
                      offset: 4,
                      textAnchor: minAnchor,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            );
          })() : null}
          </div>
        </div>

        {/* 요약 지표 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Row 1 */}
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
          {/* Row 2 */}
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
          {/* Row 3 */}
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
          {/* Row 4 */}
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
        </div>

        {holding.priceUnavailable && (
          <p className="text-xs text-amber-500 mb-4 bg-amber-50 rounded p-2">
            ⚠️ 현재가 조회에 실패하여 평균단가 기준으로 표시됩니다.
          </p>
        )}

        {/* 계좌별 분포 */}
        <div>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
