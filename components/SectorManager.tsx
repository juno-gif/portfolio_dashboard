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
  const [editingName, setEditingName] = useState<string | null>(null); // 편집 중인 섹터의 현재 이름
  const [editingValue, setEditingValue] = useState('');
  const [editingColor, setEditingColor] = useState<string | null>(null); // 컬러 피커 열린 섹터

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

  function startEdit(name: string) {
    setEditingName(name);
    setEditingValue(name);
    setError('');
  }

  function confirmEdit(oldName: string) {
    const newNameTrimmed = editingValue.trim();
    setEditingName(null);
    if (!newNameTrimmed || newNameTrimmed === oldName) return;
    if (sectors.find((s) => s.name === newNameTrimmed)) {
      setError(`'${newNameTrimmed}'은(는) 이미 존재하는 섹터입니다`);
      return;
    }

    // 1) sectorDefs 이름 업데이트
    const nextSectors = sectors.map((s) =>
      s.name === oldName ? { ...s, name: newNameTrimmed } : s
    );

    // 2) 기존 overrides에서 oldName → newName 마이그레이션
    const nextOverrides: Record<string, string> = {};
    for (const [ticker, sectorName] of Object.entries(overrides)) {
      nextOverrides[ticker] = sectorName === oldName ? newNameTrimmed : sectorName;
    }

    // 3) 자동 매칭(override 없음)으로 oldName에 배정된 종목들도 새 이름으로 고정
    const uniqueHoldings = Array.from(
      new Map(holdings.map((h) => [h.종목번호, h])).values()
    );
    for (const h of uniqueHoldings) {
      if (!overrides[h.종목번호] && tagSector(h) === oldName) {
        nextOverrides[h.종목번호] = newNameTrimmed;
      }
    }

    onChange(nextSectors, nextOverrides);
  }

  function updateColor(name: string, color: string) {
    const nextSectors = sectors.map((s) => (s.name === name ? { ...s, color } : s));
    onChange(nextSectors, overrides);
    setEditingColor(null);
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
                const isEditing = editingName === s.name;
                return (
                  <div key={s.name} className="text-xs bg-muted rounded-md overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button
                          onClick={() => setEditingColor(editingColor === s.name ? null : s.name)}
                          title="색상 변경"
                          className="w-3 h-3 rounded-sm flex-shrink-0 ring-offset-1 hover:ring-2 hover:ring-ring transition-all"
                          style={{ backgroundColor: s.color }}
                        />
                        {isEditing ? (
                          <input
                            autoFocus
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmEdit(s.name);
                              if (e.key === 'Escape') setEditingName(null);
                            }}
                            onBlur={() => confirmEdit(s.name)}
                            className="border border-input rounded px-1.5 py-0.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring w-full"
                          />
                        ) : (
                          <span className="font-medium truncate">{s.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isEditing && (
                          <button
                            onClick={() => startEdit(s.name)}
                            title="이름 편집"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            ✎
                          </button>
                        )}
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
                    </div>
                    {editingColor === s.name && (
                      <div className="flex gap-1 flex-wrap px-3 pb-2 border-t border-border/40 pt-2">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => updateColor(s.name, c)}
                            className={`w-5 h-5 rounded-sm border-2 transition-transform ${
                              s.color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-110'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    )}
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
