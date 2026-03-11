'use client';

import { ProjectionYear } from '@/types/portfolio';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface ProjectionChartProps {
  data: ProjectionYear[];
}

export default function ProjectionChart({ data }: ProjectionChartProps) {
  if (data.length === 0) return null;

  const chartData = data.map((row) => ({
    year: row.year,
    age: row.age,
    endAssets: Math.round((row.endAssets / 10000) * 100) / 100, // 억원 (소수 2자리)
    gain: row.gain,
    hasEvent: row.hasEvent,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="year"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => String(v)}
          interval={4}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `${v}억`}
          width={48}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            const gainSign = d.gain >= 0 ? '+' : '';
            return (
              <div className="bg-background border rounded-lg px-3 py-2 text-xs shadow-md">
                <p className="font-semibold mb-1">{d.year}년 ({d.age}세)</p>
                <p>기말 자산: <span className="font-medium">{d.endAssets.toFixed(1)}억원</span></p>
                <p className={d.gain >= 0 ? 'text-green-500' : 'text-red-500'}>
                  전년 대비: {gainSign}{d.gain.toLocaleString('ko-KR')}만원
                </p>
                {d.hasEvent && (
                  <p className="text-amber-500 mt-1">● 이벤트 발생 연도</p>
                )}
              </div>
            );
          }}
        />
        <Bar dataKey="endAssets" radius={[2, 2, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.hasEvent ? '#F59E0B' : '#3B82F6'}
              opacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
