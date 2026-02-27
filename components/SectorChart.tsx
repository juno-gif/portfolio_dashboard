'use client';

import { SectorAllocation } from '@/types/portfolio';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface SectorChartProps {
  allocations: SectorAllocation[];
}

export default function SectorChart({ allocations }: SectorChartProps) {
  if (allocations.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
        데이터 없음
      </div>
    );
  }

  const data = allocations.map((a) => ({
    name: `${a.sector} ${a.ratio.toFixed(1)}%`,
    value: a.amount,
    color: a.color,
    sector: a.sector,
    ratio: a.ratio,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number | string | undefined) => [
            `₩${Number(value ?? 0).toLocaleString('ko-KR')}`,
            '평가금액',
          ]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
