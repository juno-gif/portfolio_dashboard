'use client';

import { useState } from 'react';
import { Treemap, ResponsiveContainer } from 'recharts';
import { ConsolidatedHolding } from '@/types/portfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HoldingsHeatmapProps {
  holdings: ConsolidatedHolding[];
  onSelect: (holding: ConsolidatedHolding) => void;
}

function getHeatColor(rate: number): string {
  if (rate >=  4)   return '#7f1d1d';
  if (rate >=  3)   return '#991b1b';
  if (rate >=  2)   return '#b91c1c';
  if (rate >=  1)   return '#dc2626';
  if (rate >=  0.3) return '#ef4444';
  if (rate >   0)   return '#fca5a5';
  if (rate === 0)   return '#6b7280';
  if (rate >  -0.3) return '#93c5fd';
  if (rate >  -1)   return '#3b82f6';
  if (rate >  -2)   return '#1d4ed8';
  if (rate >  -3)   return '#1e40af';
  return '#1e3a8a';
}

interface TreeNode {
  name: string;
  종목번호: string;
  size: number;
  todayRate: number;
  evalAmount: number;
  [key: string]: unknown;
}

function CustomCell(props: any) {
  const { x, y, width, height, name, todayRate } = props;
  if (!width || !height || width < 4 || height < 4) return null;

  const rate = todayRate ?? 0;
  const isUp = rate >= 0;
  const showName = width > 48 && height > 32;
  const showRate = width > 48 && height > 52;
  const fontSize = Math.min(13, Math.max(9, Math.floor(Math.min(width, height) / 6)));
  const maxChars = Math.max(2, Math.floor(width / (fontSize * 0.65)));

  return (
    <g style={{ cursor: 'pointer' }}>
      <rect
        x={x + 1} y={y + 1}
        width={width - 2} height={height - 2}
        rx={3} fill={getHeatColor(rate)}
      />
      {showName && (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showRate ? -9 : 0)}
          textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize={fontSize} fontWeight="600"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name}
        </text>
      )}
      {showRate && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 9}
          textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.88)" fontSize={Math.max(9, fontSize - 1)}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {isUp ? '+' : ''}{rate.toFixed(2)}%
        </text>
      )}
    </g>
  );
}

function HeatmapChart({
  data,
  height,
  onNodeClick,
}: {
  data: TreeNode[];
  height: number;
  onNodeClick: (node: any) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={data}
        dataKey="size"
        aspectRatio={4 / 3}
        content={(props: any) => <CustomCell {...props} />}
        onClick={(node: any) => onNodeClick(node)}
      />
    </ResponsiveContainer>
  );
}

export default function HoldingsHeatmap({ holdings, onSelect }: HoldingsHeatmapProps) {
  const [expanded, setExpanded] = useState(false);

  const data: TreeNode[] = holdings
    .filter((h) => h.evalAmount > 0)
    .map((h) => ({
      name: h.종목명,
      종목번호: h.종목번호,
      size: h.evalAmount,
      todayRate: h.todayGainRate,
      evalAmount: h.evalAmount,
    }))
    .sort((a, b) => b.size - a.size);

  if (data.length === 0) return null;

  const handleNodeClick = (node: any) => {
    if (!node?.종목번호) return;
    const holding = holdings.find((h) => h.종목번호 === node.종목번호);
    if (holding) onSelect(holding);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">보유종목 히트맵</CardTitle>
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
            title="크게 보기"
          >
            확대 ↗
          </button>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0">
          <HeatmapChart data={data} height={260} onNodeClick={handleNodeClick} />
          <ColorScale />
        </CardContent>
      </Card>

      {/* 확대 모달 */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="bg-background border rounded-2xl shadow-2xl p-5 w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">보유종목 히트맵</h3>
              <button
                onClick={() => setExpanded(false)}
                className="text-muted-foreground hover:text-foreground w-7 h-7 flex items-center justify-center rounded hover:bg-muted"
              >
                ✕
              </button>
            </div>
            <HeatmapChart data={data} height={520} onNodeClick={(n) => { handleNodeClick(n); setExpanded(false); }} />
            <ColorScale />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              박스 크기 = 평가금액 비중 · 종목 클릭 시 상세 보기
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function ColorScale() {
  return (
    <div className="flex items-center gap-2 mt-2 px-1">
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">-3%↓</span>
      <div
        className="flex-1 h-2 rounded-full"
        style={{
          background:
            'linear-gradient(to right, #1e3a8a, #1d4ed8, #3b82f6, #93c5fd, #e5e7eb, #fca5a5, #ef4444, #b91c1c, #7f1d1d)',
        }}
      />
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">+3%↑</span>
    </div>
  );
}
