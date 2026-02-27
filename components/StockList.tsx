'use client';

import { useState } from 'react';
import { ConsolidatedHolding } from '@/types/portfolio';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatRate } from '@/lib/format';

const SECTOR_COLORS: Record<string, string> = {
  '미국지수': 'bg-blue-100 text-blue-800',
  '국내지수': 'bg-emerald-100 text-emerald-800',
  '금': 'bg-amber-100 text-amber-800',
  '방산/테마': 'bg-red-100 text-red-800',
  '채권/혼합': 'bg-purple-100 text-purple-800',
  '해외기타': 'bg-cyan-100 text-cyan-800',
  '개별주': 'bg-orange-100 text-orange-800',
  '기타': 'bg-gray-100 text-gray-800',
};

type SortKey = '종목명' | '섹터' | 'todayGainRate' | 'todayGainAmount' | 'evalAmount' | 'gainRate';
type SortDir = 'desc' | 'asc';

interface StockListProps {
  holdings: ConsolidatedHolding[];
  onSelect: (h: ConsolidatedHolding) => void;
}

export default function StockList({ holdings, onSelect }: StockListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('todayGainRate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...holdings].sort((a, b) => {
    let cmp = 0;
    if (sortKey === '종목명') cmp = a.종목명.localeCompare(b.종목명, 'ko');
    else if (sortKey === '섹터') cmp = a.sector.localeCompare(b.sector, 'ko');
    else cmp = (a[sortKey] as number) - (b[sortKey] as number);
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  const thClass = 'cursor-pointer select-none hover:text-foreground transition-colors';

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <TableHead className={thClass} onClick={() => handleSort('종목명')}>
              종목명{arrow('종목명')}
            </TableHead>
            <TableHead className={thClass} onClick={() => handleSort('섹터')}>
              섹터{arrow('섹터')}
            </TableHead>
            <TableHead className={`text-right ${thClass}`} onClick={() => handleSort('todayGainRate')}>
              오늘 수익률{arrow('todayGainRate')}
            </TableHead>
            <TableHead className={`text-right ${thClass}`} onClick={() => handleSort('todayGainAmount')}>
              오늘 손익{arrow('todayGainAmount')}
            </TableHead>
            <TableHead className={`text-right ${thClass}`} onClick={() => handleSort('evalAmount')}>
              평가금액{arrow('evalAmount')}
            </TableHead>
            <TableHead className={`text-right ${thClass}`} onClick={() => handleSort('gainRate')}>
              전체 수익률{arrow('gainRate')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((h) => {
            const todayPositive = h.todayGainRate >= 0;
            const totalPositive = h.gainRate >= 0;
            const isUSD = h.단위 === 'USD';
            const evalDisplay = isUSD
              ? `₩${Math.round(h.evalAmount / 10000).toLocaleString('ko-KR')}만 ($${Math.round(h.evalAmount / (h.currentPrice || 1) * (h.currentPrice || 0)).toLocaleString('en-US', { maximumFractionDigits: 0 })})`
              : `₩${Math.round(h.evalAmount / 10000).toLocaleString('ko-KR')}만`;

            return (
              <TableRow
                key={h.종목번호}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelect(h)}
              >
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{h.종목명}</span>
                    {h.priceUnavailable && (
                      <span className="text-xs text-amber-500">현재가 조회 실패</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs ${SECTOR_COLORS[h.sector] ?? 'bg-gray-100 text-gray-800'}`}>
                    {h.sector}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right font-semibold whitespace-nowrap ${todayPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {formatRate(h.todayGainRate)}
                </TableCell>
                <TableCell className={`text-right whitespace-nowrap ${todayPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {todayPositive ? '+' : '-'}₩{Math.abs(h.todayGainAmount).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">{evalDisplay}</TableCell>
                <TableCell className={`text-right whitespace-nowrap ${totalPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {formatRate(h.gainRate)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
