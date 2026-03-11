'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { RawHolding, HoldingWithMeta, ConsolidatedHolding, MiscAsset } from '@/types/portfolio';
import {
  enrichHoldings,
  consolidateHoldings,
  calcAccountSummaries,
  calcSectorAllocations,
  calcPortfolioSummary,
} from '@/lib/portfolio-calculator';
import { fetchPrices, fetchExchangeRate } from '@/lib/price-fetcher';
import { parsePortfolioCSV } from '@/lib/csv-parser';
import { Skeleton } from '@/components/ui/skeleton';
import HeroSection from '@/components/HeroSection';
import AccountCards from '@/components/AccountCards';
import SectorChart from '@/components/SectorChart';
import StockList from '@/components/StockList';
import StockDetailDrawer from '@/components/StockDetailDrawer';
import ProjectionView from '@/components/ProjectionView';
import MiscAssets from '@/components/MiscAssets';

const MISC_LS_KEY = 'misc_assets';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'projection'>('portfolio');
  const [rawHoldings, setRawHoldings] = useState<RawHolding[]>([]);
  const [holdingsWithMeta, setHoldingsWithMeta] = useState<HoldingWithMeta[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(1370);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [selectedHolding, setSelectedHolding] = useState<ConsolidatedHolding | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [portfolioToken, setPortfolioToken] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [miscAssets, setMiscAssets] = useState<MiscAsset[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const loadPrices = useCallback(async (holdings: RawHolding[]) => {
    setLoading(true);
    try {
      const [rate, priceMap] = await Promise.all([
        fetchExchangeRate(),
        fetchPrices(holdings),
      ]);
      setExchangeRate(rate);
      const enriched = enrichHoldings(holdings, priceMap, rate);
      setHoldingsWithMeta(enriched);
      setLastUpdated(
        new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpload = useCallback(
    async (holdings: RawHolding[]) => {
      setRawHoldings(holdings);
      await loadPrices(holdings);
    },
    [loadPrices]
  );

  const handleRefresh = useCallback(() => {
    if (rawHoldings.length > 0) loadPrices(rawHoldings);
  }, [rawHoldings, loadPrices]);

  // 기타 자산 로드: KV(토큰 있을 때) → localStorage 순
  const loadMiscAssets = useCallback(async (token: string | null) => {
    if (token) {
      try {
        const res = await fetch(`/api/misc?token=${token}`);
        if (res.ok) {
          const data = await res.json();
          setMiscAssets(Array.isArray(data) ? data : []);
          return;
        }
      } catch {
        // KV 실패 시 localStorage fallback
      }
    }
    // localStorage에서 시도 (토큰 있을 때 이전 배포 호환: token 없는 키도 확인)
    const keys = token
      ? [`${MISC_LS_KEY}_${token}`, MISC_LS_KEY]
      : [MISC_LS_KEY];
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          setMiscAssets(parsed);
          // KV에 없었으면 지금 올려서 다른 기기에서도 볼 수 있도록 동기화
          if (token) {
            fetch(`/api/misc?token=${token}`, {
              method: 'POST',
              body: JSON.stringify(parsed),
            }).catch(() => {});
          }
          return;
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  }, []);

  const handleMiscAssetsChange = useCallback((assets: MiscAsset[]) => {
    setMiscAssets(assets);
    const key = portfolioToken ? `${MISC_LS_KEY}_${portfolioToken}` : MISC_LS_KEY;
    localStorage.setItem(key, JSON.stringify(assets));
    if (portfolioToken) {
      fetch(`/api/misc?token=${portfolioToken}`, {
        method: 'POST',
        body: JSON.stringify(assets),
      }).catch(() => {});
    }
  }, [portfolioToken]);

  // 마운트 시: ?token= → KV → localStorage → 샘플 순서로 로드
  useEffect(() => {
    (async () => {
      // 1) URL에 ?token= 있으면 KV에서 fetch
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        try {
          const res = await fetch(`/api/portfolio?token=${urlToken}`);
          if (res.ok) {
            const text = await res.text();
            const file = new File([text], 'portfolio.csv', { type: 'text/csv' });
            const holdings = await parsePortfolioCSV(file);
            setPortfolioToken(urlToken);
            await Promise.all([
              handleUpload(holdings),
              loadMiscAssets(urlToken),
            ]);
            return;
          }
        } catch {
          // KV 로드 실패 시 다음 단계로
        }
      }

      // 2) localStorage에 저장된 CSV (토큰이 있었으나 KV 실패한 경우만)
      if (urlToken) {
        try {
          const saved = localStorage.getItem('portfolio_csv');
          if (saved) {
            const file = new File([saved], 'portfolio.csv', { type: 'text/csv' });
            const holdings = await parsePortfolioCSV(file);
            await Promise.all([
              handleUpload(holdings),
              loadMiscAssets(urlToken),
            ]);
            return;
          }
        } catch {
          localStorage.removeItem('portfolio_csv');
        }
      }

      // 3) 샘플 로드 (토큰 없는 기본 URL 또는 KV/localStorage 모두 실패)
      try {
        const res = await fetch('/sample.csv');
        const text = await res.text();
        const file = new File([text], 'sample.csv', { type: 'text/csv' });
        const holdings = await parsePortfolioCSV(file);
        await Promise.all([
          handleUpload(holdings),
          loadMiscAssets(null),
        ]);
      } catch {
        // 샘플 로드 실패 시 빈 상태 유지
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const consolidated = useMemo(() => consolidateHoldings(holdingsWithMeta), [holdingsWithMeta]);
  const accountSummaries = useMemo(() => calcAccountSummaries(holdingsWithMeta), [holdingsWithMeta]);
  const sectorAllocations = useMemo(() => calcSectorAllocations(holdingsWithMeta), [holdingsWithMeta]);
  const portfolioSummary = useMemo(
    () => calcPortfolioSummary(holdingsWithMeta, exchangeRate),
    [holdingsWithMeta, exchangeRate]
  );
  const miscTotal = useMemo(
    () => miscAssets.reduce((sum, a) => sum + a.amount, 0),
    [miscAssets]
  );
  const adjustedSummary = useMemo(
    () => portfolioSummary ? { ...portfolioSummary, totalEval: portfolioSummary.totalEval + miscTotal } : null,
    [portfolioSummary, miscTotal]
  );

  const handleSelectHolding = (h: ConsolidatedHolding) => {
    setSelectedHolding(h);
    setDrawerOpen(true);
  };

  const handleDownloadCsv = () => {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const header = '계좌,종목명,종목번호,수량,평균단가,단위';
    const rows = rawHoldings.map(
      (h) => `${q(h.계좌)},${q(h.종목명)},${q(h.종목번호)},${h.수량},${h.평균단가},${h.단위}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFile = async (file: File) => {
    try {
      const text = await file.text();
      const csvFile = new File([text], file.name, { type: 'text/csv' });
      const holdings = await parsePortfolioCSV(csvFile);

      // KV 저장 (신규 token 발급 or 기존 token 덮어쓰기)
      try {
        const url = portfolioToken
          ? `/api/portfolio?token=${portfolioToken}`
          : '/api/portfolio';
        const res = await fetch(url, { method: 'POST', body: text });
        if (res.ok) {
          const { token } = await res.json();
          setPortfolioToken(token);
          const newUrl = `${window.location.pathname}?token=${token}`;
          window.history.pushState({}, '', newUrl);
        }
      } catch {
        // KV 저장 실패 시 localStorage fallback만 사용
      }

      localStorage.setItem('portfolio_csv', text);
      await handleUpload(holdings);
    } catch {
      // 파싱 실패 무시
    }
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await handleCsvFile(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleCsvFile(file);
  };

  // 초기 로딩 스켈레톤
  if (loading && holdingsWithMeta.length === 0) {
    return (
      <div className="p-3 sm:p-6 space-y-4 max-w-screen-2xl mx-auto">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 sm:gap-6">
          <Skeleton className="h-72 rounded-xl xl:col-span-2" />
          <Skeleton className="h-72 rounded-xl xl:col-span-3" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-3 sm:p-6 space-y-4 max-w-screen-2xl mx-auto relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 드래그 오버레이 */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary rounded-xl pointer-events-none">
          <div className="text-center">
            <p className="text-4xl mb-3">📂</p>
            <p className="text-xl font-semibold text-primary">CSV 파일을 여기에 놓으세요</p>
          </div>
        </div>
      )}

      {/* GNB 탭 */}
      <div className="flex gap-1 border-b border-border pb-0">
        {(['portfolio', 'projection'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'portfolio' ? '포트폴리오' : '미래 예측'}
          </button>
        ))}
      </div>

      {activeTab === 'portfolio' && (
        <>
          {/* 1. 히어로 — 오늘 손익 최우선 */}
          <HeroSection
            summary={adjustedSummary}
            onRefresh={handleRefresh}
            isRefreshing={loading}
          />

          {/* 2. 계좌별 카드 */}
          <AccountCards accounts={accountSummaries} />

          {/* 3. 섹터 차트 + 종목 리스트 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 sm:gap-6">
            <div className="bg-card border rounded-xl p-4 xl:col-span-2">
              <h2 className="text-sm font-semibold mb-3">섹터 비중</h2>
              <SectorChart allocations={sectorAllocations} />
            </div>
            <div className="bg-card border rounded-xl p-4 overflow-auto xl:col-span-3">
              <h2 className="text-sm font-semibold mb-3">종목별 수익률</h2>
              <StockList holdings={consolidated} onSelect={handleSelectHolding} />
            </div>
          </div>

          {/* 4. 기타 자산 */}
          <MiscAssets assets={miscAssets} onChange={handleMiscAssetsChange} />

          {/* 5. CSV 다운로드 / 재업로드 / 내 URL */}
          <div className="flex justify-end gap-4">
            {portfolioToken && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setCopyDone(true);
                  setTimeout(() => setCopyDone(false), 2000);
                }}
                className="text-xs text-primary hover:text-primary/80 underline"
              >
                {copyDone ? '복사됨 ✓' : '내 포트폴리오 URL 복사'}
              </button>
            )}
          </div>
          <div className="flex justify-end gap-4">
            <button
              onClick={handleDownloadCsv}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              CSV 다운로드
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvFileChange}
            />
            <button
              onClick={() => csvInputRef.current?.click()}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              CSV 다시 업로드
            </button>
          </div>
        </>
      )}

      {activeTab === 'projection' && (
        <ProjectionView totalEval={adjustedSummary?.totalEval ?? 0} token={portfolioToken} />
      )}

      {/* 종목 드릴다운 */}
      <StockDetailDrawer
        holding={selectedHolding}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
