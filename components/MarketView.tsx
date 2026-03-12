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
import type { MarketItem } from '@/app/api/market/route';

function fmt(value: number, unit: string): string {
  if (unit === '원' || unit === 'pt') {
    return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MarketCard({ item }: { item: MarketItem }) {
  const change = item.currentPrice - item.prevClose;
  const changeRate = item.prevClose > 0 ? (change / item.prevClose) * 100 : 0;
  const isUp = change >= 0;

  // Recharts용 데이터: x축 날짜를 일부만 표시
  const chartData = item.dates.map((d, i) => ({ date: d, price: item.prices[i] }));

  // y축 도메인에 약간의 여유
  const minPrice = Math.min(...item.prices);
  const maxPrice = Math.max(...item.prices);
  const pad = (maxPrice - minPrice) * 0.1 || maxPrice * 0.01;
  const yDomain: [number, number] = [minPrice - pad, maxPrice + pad];

  // x축 틱: 첫날, 매월 초, 마지막날 (최대 4개)
  const tickIndices = new Set<number>([0, chartData.length - 1]);
  for (let i = 1; i < chartData.length - 1; i++) {
    if (chartData[i].date.endsWith('/01') || chartData[i].date.endsWith('/02')) {
      tickIndices.add(i);
    }
  }
  const tickDates = new Set(Array.from(tickIndices).map((i) => chartData[i]?.date));

  const priceColor = isUp ? '#e11d48' : '#2563eb';
  const strokeColor = isUp ? '#e11d48' : '#2563eb';
  const fillId = `fill-${item.symbol.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className="bg-card border rounded-xl p-4 flex flex-col gap-2">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted-foreground font-medium">{item.name}</span>
        <div className="text-right">
          <p className="text-base font-bold leading-tight" style={{ color: priceColor }}>
            {fmt(item.currentPrice, item.unit)}
            <span className="text-xs font-normal ml-1">{item.unit}</span>
          </p>
          <p className="text-xs" style={{ color: priceColor }}>
            {isUp ? '▲' : '▼'} {Math.abs(change).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
            {' '}({isUp ? '+' : ''}{changeRate.toFixed(2)}%)
          </p>
        </div>
      </div>

      {/* 차트 */}
      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
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
              stroke={strokeColor}
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

export default function MarketView() {
  const [items, setItems] = useState<(MarketItem | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/market');
        if (res.ok) {
          const data = await res.json();
          setItems(data);
          setUpdatedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-card border rounded-xl p-4 h-[196px] animate-pulse">
            <div className="h-3 bg-muted rounded w-1/3 mb-2" />
            <div className="h-6 bg-muted rounded w-1/2 mb-4" />
            <div className="h-[120px] bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  const validItems = items.filter(Boolean) as MarketItem[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">최근 3개월 일봉 기준 · Yahoo Finance</p>
        {updatedAt && <p className="text-xs text-muted-foreground">조회 {updatedAt}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {validItems.map((item) => (
          <MarketCard key={item.symbol} item={item} />
        ))}
      </div>
    </div>
  );
}
