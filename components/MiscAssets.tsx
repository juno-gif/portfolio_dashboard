'use client';

import { useState } from 'react';
import { MiscAsset } from '@/types/portfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MiscAssetsProps {
  assets: MiscAsset[];
  onChange: (assets: MiscAsset[]) => void;
}

export default function MiscAssets({ assets, onChange }: MiscAssetsProps) {
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [error, setError] = useState('');

  const inputCls =
    'border border-input rounded-md px-2 py-1.5 text-sm bg-background w-full focus:outline-none focus:ring-1 focus:ring-ring';

  function addAsset() {
    setError('');
    const trimmed = newName.trim();
    if (!trimmed) { setError('자산 이름을 입력해주세요'); return; }
    const amount = parseFloat(newAmount.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) { setError('금액을 올바르게 입력해주세요 (단위: 원)'); return; }
    onChange([...assets, { name: trimmed, amount }]);
    setNewName('');
    setNewAmount('');
  }

  function removeAsset(index: number) {
    onChange(assets.filter((_, i) => i !== index));
  }

  const total = assets.reduce((sum, a) => sum + a.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">기타 자산</CardTitle>
        {assets.length > 0 && (
          <span className="text-xs text-muted-foreground">
            합계: ₩{total.toLocaleString('ko-KR')}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {assets.map((asset, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-xs bg-muted rounded-md px-3 py-2"
          >
            <span className="font-medium">{asset.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                ₩{asset.amount.toLocaleString('ko-KR')}
              </span>
              <button
                onClick={() => removeAsset(i)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="삭제"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {/* 추가 폼 */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">자산 이름</label>
            <input
              type="text"
              className={inputCls}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAsset()}
              placeholder="예: 미래에셋 펀드"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">현재 평가액 (원)</label>
            <input
              type="number"
              className={inputCls}
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAsset()}
              placeholder="예: 5000000"
            />
          </div>
          <button
            onClick={addAsset}
            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 mb-0.5"
          >
            + 추가
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
}
