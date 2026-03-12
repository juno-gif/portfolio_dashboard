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
  selectedSector?: string | null;
  onSectorClick?: (sector: string | null) => void;
}

export default function SectorChart({ allocations, selectedSector, onSectorClick }: SectorChartProps) {
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

  const handlePieClick = (entry: any) => {
    if (!onSectorClick) return;
    onSectorClick(selectedSector === entry.sector ? null : entry.sector);
  };

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
          onClick={handlePieClick}
          style={{ cursor: onSectorClick ? 'pointer' : 'default' }}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color}
              opacity={!selectedSector || selectedSector === entry.sector ? 1 : 0.25}
              stroke={selectedSector === entry.sector ? '#fff' : 'none'}
              strokeWidth={selectedSector === entry.sector ? 2 : 0}
            />
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
        <Legend
          content={() => (
            <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 text-xs">
              {data.map((entry) => (
                <li
                  key={entry.name}
                  className="flex items-center gap-1"
                  onClick={() => handlePieClick(entry)}
                  style={{
                    cursor: onSectorClick ? 'pointer' : 'default',
                    opacity: !selectedSector || selectedSector === entry.sector ? 1 : 0.4,
                  }}
                >
                  <span
                    className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.name}
                </li>
              ))}
            </ul>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
