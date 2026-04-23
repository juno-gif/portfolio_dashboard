'use client';

import { useMemo, useState } from 'react';
import { HoldingWithMeta, SectorDef } from '@/types/portfolio';
import { formatRate } from '@/lib/format';

type SortKey = 'sector' | 'evalAmount' | 'todayGainRate' | 'gainRate';
type SortDir = 'desc' | 'asc';

interface Props {
  holdings: HoldingWithMeta[];
  sectorDefs: SectorDef[];
  selectedSector: string | null;
  onSectorClick: (sector: string) => void;
}

export default function SectorReturns({ holdings, sectorDefs, selectedSector, onSectorClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('evalAmount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';
  const thClass = 'cursor-pointer select-none hover:text-foreground transition-colors';

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sectorDefs) map.set(s.name, s.color);
    return map;
  }, [sectorDefs]);

  const sectorData = useMemo(() => {
    const map = new Map<string, {
      evalAmount: number;
      gainAmount: number;
      todayGainAmount: number;
    }>();

    for (const h of holdings) {
      const d = map.get(h.sector) ?? { evalAmount: 0, gainAmount: 0, todayGainAmount: 0 };
      d.evalAmount += h.evalAmount;
      d.gainAmount += h.gainAmount;
      d.todayGainAmount += h.todayGainAmount;
      map.set(h.sector, d);
    }

    return Array.from(map.entries())
      .map(([sector, d]) => {
        const costAmount = d.evalAmount - d.gainAmount;
        const prevEval = d.evalAmount - d.todayGainAmount;
        return {
          sector,
          evalAmount: d.evalAmount,
          gainAmount: d.gainAmount,
          gainRate: costAmount > 0 ? (d.gainAmount / costAmount) * 100 : 0,
          todayGainRate: prevEval > 0 ? (d.todayGainAmount / prevEval) * 100 : 0,
        };
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'sector') cmp = a.sector.localeCompare(b.sector, 'ko');
        else cmp = (a[sortKey] as number) - (b[sortKey] as number);
        return sortDir === 'desc' ? -cmp : cmp;
      });
  }, [holdings, sortKey, sortDir]);

  return (
    <div>
      <h2 className="text-sm font-semibold mb-2">섹터별 수익률</h2>
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-1 pb-1 border-b mb-1">
        <span className="w-2.5 shrink-0" />
        <button className={`text-xs text-muted-foreground flex-1 text-left ${thClass}`} onClick={() => handleSort('sector')}>
          섹터{arrow('sector')}
        </button>
        <button className={`text-xs text-muted-foreground w-14 text-right shrink-0 ${thClass}`} onClick={() => handleSort('todayGainRate')}>
          오늘{arrow('todayGainRate')}
        </button>
        <button className={`text-xs text-muted-foreground w-14 text-right shrink-0 ${thClass}`} onClick={() => handleSort('gainRate')}>
          전체{arrow('gainRate')}
        </button>
        <button className={`text-xs text-muted-foreground w-16 text-right shrink-0 ${thClass}`} onClick={() => handleSort('evalAmount')}>
          평가금액{arrow('evalAmount')}
        </button>
      </div>
      <div className="divide-y divide-border">
        {sectorData.map((s) => {
          const isSelected = selectedSector === s.sector;
          const color = colorMap.get(s.sector) ?? '#888888';
          return (
            <button
              key={s.sector}
              onClick={() => onSectorClick(s.sector)}
              className={`w-full flex items-center gap-2 py-2 px-1 rounded transition-colors text-left
                ${isSelected ? 'bg-muted' : 'hover:bg-muted/50'}`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs flex-1 min-w-0 truncate font-medium">{s.sector}</span>
              <span className={`text-xs w-14 text-right shrink-0 ${s.todayGainRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatRate(s.todayGainRate)}
              </span>
              <span className={`text-xs font-semibold w-14 text-right shrink-0 ${s.gainRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatRate(s.gainRate)}
              </span>
              <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                ₩{Math.round(s.evalAmount / 10000).toLocaleString('ko-KR')}만
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
