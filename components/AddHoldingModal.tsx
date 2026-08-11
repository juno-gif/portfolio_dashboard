'use client';

import { useState, useEffect } from 'react';
import { RawHolding } from '@/types/portfolio';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (holding: RawHolding) => void;
  accounts: string[];
}

const inputCls =
  'border border-input rounded-md px-2 py-1.5 text-sm bg-background w-full focus:outline-none focus:ring-1 focus:ring-ring';

export default function AddHoldingModal({ open, onClose, onAdd, accounts }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<'KRW' | 'USD'>('KRW');
  const [resolvedCode, setResolvedCode] = useState('');
  const [account, setAccount] = useState('');
  const [qty, setQty] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (open && accounts.length > 0) setAccount(accounts[0]);
  }, [open, accounts]);

  if (!open) return null;

  function reset() {
    setCode('');
    setName('');
    setUnit('KRW');
    setResolvedCode('');
    setQty('');
    setAvgCost('');
    setLookupStatus('idle');
    setSubmitError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function lookupStock() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLookupStatus('loading');
    setName('');
    try {
      const res = await fetch(`/api/stock-info?code=${encodeURIComponent(trimmed)}`);
      if (!res.ok) { setLookupStatus('error'); return; }
      const data = await res.json();
      if (data.name) {
        setName(data.name);
        setUnit(data.unit);
        setResolvedCode(data.code);
        setCode(data.code);
        setLookupStatus('found');
      } else {
        setLookupStatus('error');
      }
    } catch {
      setLookupStatus('error');
    }
  }

  function handleSubmit() {
    setSubmitError('');
    if (lookupStatus !== 'found') { setSubmitError('종목을 먼저 조회해주세요'); return; }
    if (!account.trim()) { setSubmitError('계좌를 선택해주세요'); return; }
    const qtyNum = parseFloat(qty);
    if (isNaN(qtyNum) || qtyNum <= 0) { setSubmitError('수량을 올바르게 입력해주세요'); return; }
    const avgCostNum = parseFloat(avgCost);
    if (isNaN(avgCostNum) || avgCostNum <= 0) { setSubmitError('평단가를 올바르게 입력해주세요'); return; }

    onAdd({
      계좌: account.trim(),
      종목명: name,
      종목번호: resolvedCode,
      수량: qtyNum,
      평균단가: avgCostNum,
      단위: unit,
    });
    reset();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
        <h3 className="text-sm font-semibold">신규 종목 등록</h3>

        {/* 종목 조회 */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">종목코드</label>
          <div className="flex gap-2">
            <input
              type="text"
              className={inputCls}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setLookupStatus('idle');
                setName('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && lookupStock()}
              placeholder="예: 005930 또는 AAPL"
              autoFocus
            />
            <button
              onClick={lookupStock}
              disabled={!code.trim() || lookupStatus === 'loading'}
              className="shrink-0 px-3 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
            >
              {lookupStatus === 'loading' ? '...' : '조회'}
            </button>
          </div>
          {lookupStatus === 'found' && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1.5">
              <span className="font-medium">{name}</span>
              <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">{unit}</span>
            </p>
          )}
          {lookupStatus === 'error' && (
            <p className="text-xs text-red-500 mt-1">종목을 찾을 수 없습니다. 코드를 확인해주세요.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* 계좌 */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">계좌</label>
            {accounts.length > 0 ? (
              <select
                className={inputCls}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className={inputCls}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="계좌명 입력"
              />
            )}
          </div>

          {/* 수량 */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">수량</label>
            <input
              type="number"
              className={inputCls}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="예: 10"
              min={0}
              step="any"
            />
          </div>

          {/* 평단가 */}
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">
              평단가 {unit === 'USD' ? '($)' : '(원)'}
            </label>
            <input
              type="number"
              className={inputCls}
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              placeholder={unit === 'USD' ? '예: 145.50' : '예: 72000'}
              min={0}
              step="any"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>

        {submitError && (
          <p className="text-xs text-red-500">{submitError}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
