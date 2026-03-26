'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MarketItem, MarketGroup } from '@/app/api/market/route';

function fmt(value: number, unit: string): string {
  if (unit === 'pt') {
    return value >= 1000
      ? value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
      : value.toFixed(2);
  }
  if (unit === '원') return value.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (unit === '%') return value.toFixed(2);
  // $
  if (value >= 10000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (value >= 100)   return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return value.toFixed(2);
}

function MarketCard({ item }: { item: MarketItem }) {
  const change = item.currentPrice - item.prevClose;
  const changeRate = item.prevClose > 0 ? (change / item.prevClose) * 100 : 0;
  const isUp = change >= 0;

  const periodChange = item.currentPrice - item.periodStartPrice;
  const periodRate = item.periodStartPrice > 0 ? (periodChange / item.periodStartPrice) * 100 : 0;
  const isPeriodUp = periodChange >= 0;

  const chartData = item.dates.map((d, i) => ({ date: d, price: item.prices[i] }));
  const minPrice = Math.min(...item.prices);
  const maxPrice = Math.max(...item.prices);
  const pad = (maxPrice - minPrice) * 0.08 || maxPrice * 0.01;
  const yDomain: [number, number] = [minPrice - pad, maxPrice + pad];

  // 월 경계 틱만 표시
  const tickDates = new Set<string>();
  tickDates.add(chartData[0]?.date);
  tickDates.add(chartData[chartData.length - 1]?.date);
  for (const d of chartData) {
    if (d.date.endsWith('/01') || d.date.endsWith('/02')) tickDates.add(d.date);
  }

  const priceColor = isUp ? '#e11d48' : '#2563eb';
  const fillId = `fill-${item.symbol.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className="bg-card border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted-foreground font-medium leading-tight">{item.name}</span>
        <div className="text-right shrink-0">
          <p className="text-base font-bold leading-tight" style={{ color: priceColor }}>
            {fmt(item.currentPrice, item.unit)}
            <span className="text-xs font-normal ml-1">{item.unit}</span>
          </p>
          <p className="text-xs" style={{ color: priceColor }}>
            {isUp ? '▲' : '▼'} {fmt(Math.abs(change), item.unit)}
            {' '}({isUp ? '+' : ''}{changeRate.toFixed(2)}%)
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            3M{' '}
            <span style={{ color: isPeriodUp ? '#e11d48' : '#2563eb' }}>
              {isPeriodUp ? '+' : ''}{periodRate.toFixed(2)}%
            </span>
          </p>
        </div>
      </div>

      <div className="h-[110px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 2, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={priceColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={priceColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tickFormatter={(v) => (tickDates.has(v) ? v : '')}
            />
            <YAxis domain={yDomain} hide />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-background border rounded px-2 py-1 text-xs shadow-md">
                    <p className="text-muted-foreground">{d.date}</p>
                    <p className="font-semibold">{fmt(d.price, item.unit)} {item.unit}</p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={priceColor}
              strokeWidth={1.5}
              fill={`url(#${fillId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GroupSection({ group, items }: { group: string; items: (MarketItem | null)[] }) {
  const valid = items.filter(Boolean) as MarketItem[];
  if (valid.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5">
        {group}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item, i) =>
          item ? <MarketCard key={item.symbol} item={item} /> : <div key={i} />
        )}
      </div>
    </div>
  );
}

export default function MarketView() {
  const [groups, setGroups] = useState<MarketGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/market');
        if (res.ok) {
          setGroups(await res.json());
          setUpdatedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {[2, 3, 4, 4].map((count, gi) => (
          <div key={gi} className="space-y-2">
            <div className="h-3 bg-muted rounded w-24 animate-pulse" />
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`}>
              {[...Array(count)].map((_, i) => (
                <div key={i} className="bg-card border rounded-xl p-4 h-[188px] animate-pulse">
                  <div className="h-3 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-6 bg-muted rounded w-1/2 mb-4" />
                  <div className="h-[110px] bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">최근 3개월 일봉 · Yahoo Finance</p>
        {updatedAt && <p className="text-xs text-muted-foreground">조회 {updatedAt}</p>}
      </div>
      {groups.map((g) => (
        <GroupSection key={g.group} group={g.group} items={g.items} />
      ))}
    </div>
  );
}
