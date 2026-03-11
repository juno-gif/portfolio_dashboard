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

  const data = [...allocations]
    .sort((a, b) => b.ratio - a.ratio)
    .map((a) => ({
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
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-background border rounded-lg px-3 py-2 text-xs shadow-md">
                <p className="font-semibold mb-1">{d.sector}</p>
                <p className="text-muted-foreground">{d.ratio.toFixed(1)}%</p>
                <p>₩{Number(d.value).toLocaleString('ko-KR')}</p>
              </div>
            );
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
