'use client';

import { useState } from 'react';
import { SectorDef, RawHolding } from '@/types/portfolio';
import { DEFAULT_SECTORS } from '@/lib/sector-config';
import { tagSector } from '@/lib/sector-tagger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SectorManagerProps {
  sectors: SectorDef[];
  overrides: Record<string, string>;
  holdings: RawHolding[];
  onChange: (sectors: SectorDef[], overrides: Record<string, string>) => void;
}

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#F97316', '#6B7280',
  '#EC4899', '#84CC16', '#14B8A6', '#A855F7',
];

export default function SectorManager({
  sectors,
  overrides,
  holdings,
  onChange,
}: SectorManagerProps) {
  const [tab, setTab] = useState<'sectors' | 'stocks'>('sectors');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[8]);
  const [error, setError] = useState('');

  const inputCls =
    'border border-input rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring';

  // 각 섹터를 사용 중인 종목번호 집합
  function usedSectors(): Set<string> {
    const used = new Set<string>();
    for (const h of holdings) {
      const sector = overrides[h.종목번호] ?? tagSector(h);
      used.add(sector);
    }
    return used;
  }

  function addSector() {
    setError('');
    const name = newName.trim();
    if (!name) { setError('섹터 이름을 입력해주세요'); return; }
    if (sectors.find((s) => s.name === name)) { setError('이미 존재하는 섹터입니다'); return; }
    onChange([...sectors, { name, color: newColor }], overrides);
    setNewName('');
    setNewColor(PRESET_COLORS[8]);
  }

  function deleteSector(name: string) {
    const used = usedSectors();
    if (used.has(name)) return; // 사용 중이면 삭제 불가
    const next = sectors.filter((s) => s.name !== name);
    onChange(next, overrides);
  }

  function resetSectors() {
    // 기본 섹터 복원, 오버라이드는 유지
    onChange(DEFAULT_SECTORS, overrides);
  }

  function setOverride(종목번호: string, sector: string) {
    const next = { ...overrides };
    if (!sector) {
      delete next[종목번호];
    } else {
      next[종목번호] = sector;
    }
    onChange(sectors, next);
  }

  const used = usedSectors();

  // 종목 목록 (중복 제거: 종목번호 기준)
  const uniqueHoldings = Array.from(
    new Map(holdings.map((h) => [h.종목번호, h])).values()
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">섹터 관리</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 탭 */}
        <div className="flex gap-1 mb-4 border-b">
          <button
            onClick={() => setTab('sectors')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === 'sectors'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            섹터 목록
          </button>
          <button
            onClick={() => setTab('stocks')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === 'stocks'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            종목별 섹터
          </button>
        </div>

        {/* 섹터 목록 탭 */}
        {tab === 'sectors' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {sectors.map((s) => {
                const canDelete = !used.has(s.name);
                return (
                  <div
                    key={s.name}
                    className="flex items-center justify-between text-xs bg-muted rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="font-medium">{s.name}</span>
                    </div>
                    <button
                      onClick={() => deleteSector(s.name)}
                      disabled={!canDelete}
                      title={canDelete ? '삭제' : '이 섹터를 사용 중인 종목이 있어 삭제할 수 없습니다'}
                      className={`transition-colors ${
                        canDelete
                          ? 'text-muted-foreground hover:text-destructive'
                          : 'text-muted-foreground/30 cursor-not-allowed'
                      }`}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 섹터 추가 */}
            <div className="space-y-2 pt-1">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">섹터 이름</label>
                  <input
                    type="text"
                    className={`${inputCls} w-full`}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addSector()}
                    placeholder="예: 리츠"
                  />
                </div>
                <div className="shrink-0">
                  <label className="text-xs text-muted-foreground mb-1 block">색상</label>
                  <div className="flex gap-1 flex-wrap w-40">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={`w-5 h-5 rounded-sm border-2 transition-transform ${
                          newColor === c ? 'border-foreground scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={addSector}
                  className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 mb-0.5"
                >
                  + 추가
                </button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            {/* 기본값으로 초기화 */}
            <div className="flex justify-end pt-1">
              <button
                onClick={resetSectors}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                기본 섹터로 초기화
              </button>
            </div>
          </div>
        )}

        {/* 종목별 섹터 탭 */}
        {tab === 'stocks' && (
          <div className="space-y-1.5">
            {uniqueHoldings.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">
                CSV를 업로드하면 종목 목록이 표시됩니다
              </p>
            )}
            {uniqueHoldings.map((h) => {
              const autoSector = tagSector(h);
              const currentSector = overrides[h.종목번호] ?? autoSector;
              const isOverridden = !!overrides[h.종목번호];

              return (
                <div
                  key={h.종목번호}
                  className="flex items-center justify-between text-xs bg-muted rounded-md px-3 py-2 gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium truncate block">{h.종목명}</span>
                    {isOverridden && (
                      <span className="text-muted-foreground">
                        자동: {autoSector}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={currentSector}
                      onChange={(e) => setOverride(h.종목번호, e.target.value)}
                      className={`${inputCls} text-xs py-1 pr-6`}
                    >
                      {sectors.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {isOverridden && (
                      <button
                        onClick={() => setOverride(h.종목번호, '')}
                        title="자동 매칭으로 되돌리기"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
