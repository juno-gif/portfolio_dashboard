'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { RawHolding, HoldingWithMeta, ConsolidatedHolding, MiscAsset, SectorDef } from '@/types/portfolio';
import {
  enrichHoldings,
  consolidateHoldings,
  calcAccountSummaries,
  calcSectorAllocations,
  calcPortfolioSummary,
} from '@/lib/portfolio-calculator';
import { DEFAULT_SECTORS } from '@/lib/sector-config';
import { fetchPrices, fetchExchangeRate } from '@/lib/price-fetcher';
import { parsePortfolioCSV } from '@/lib/csv-parser';
import { tagSector } from '@/lib/sector-tagger';
import { Skeleton } from '@/components/ui/skeleton';
import HeroSection from '@/components/HeroSection';
import AccountCards from '@/components/AccountCards';
import SectorChart from '@/components/SectorChart';
import StockList from '@/components/StockList';
import StockDetailDrawer from '@/components/StockDetailDrawer';
import ProjectionView from '@/components/ProjectionView';
import MiscAssets from '@/components/MiscAssets';
import SectorManager from '@/components/SectorManager';
import MarketView from '@/components/MarketView';
import HoldingsHeatmap from '@/components/HoldingsHeatmap';

const MISC_LS_KEY = 'misc_assets';
const SECTOR_LS_KEY = 'sector_config';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'projection' | 'market'>('portfolio');
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [sectorDefs, setSectorDefs] = useState<SectorDef[]>(DEFAULT_SECTORS);
  const [sectorOverrides, setSectorOverrides] = useState<Record<string, string>>({});
  const csvInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const loadPrices = useCallback(async (
    holdings: RawHolding[],
    overrides: Record<string, string> = {}
  ) => {
    setLoading(true);
    try {
      const [rate, priceMap] = await Promise.all([
        fetchExchangeRate(),
        fetchPrices(holdings),
      ]);
      setExchangeRate(rate);
      const enriched = enrichHoldings(holdings, priceMap, rate, overrides);
      setHoldingsWithMeta(enriched);
      setLastUpdated(
        new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpload = useCallback(
    async (holdings: RawHolding[], overrides: Record<string, string> = {}) => {
      setRawHoldings(holdings);
      await loadPrices(holdings, overrides);
    },
    [loadPrices]
  );

  const handleRefresh = useCallback(() => {
    if (rawHoldings.length > 0) loadPrices(rawHoldings, sectorOverrides);
  }, [rawHoldings, loadPrices, sectorOverrides]);

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

  // 섹터 config 로드: KV(토큰 있을 때) → localStorage 순
  const loadSectorConfig = useCallback(async (token: string | null): Promise<Record<string, string>> => {
    if (token) {
      try {
        const res = await fetch(`/api/sector?token=${token}`);
        if (res.ok) {
          const data = await res.json();
          if (data.sectors) setSectorDefs(data.sectors);
          if (data.overrides) setSectorOverrides(data.overrides);
          return data.overrides ?? {};
        }
      } catch { /* fallback */ }
    }
    const lsKey = token ? `${SECTOR_LS_KEY}_${token}` : SECTOR_LS_KEY;
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.sectors) setSectorDefs(data.sectors);
        if (data.overrides) setSectorOverrides(data.overrides);
        if (token) {
          fetch(`/api/sector?token=${token}`, {
            method: 'POST',
            body: raw,
          }).catch(() => {});
        }
        return data.overrides ?? {};
      }
    } catch { /* ignore */ }
    return {};
  }, []);

  const saveSectorConfig = useCallback((defs: SectorDef[], overrides: Record<string, string>) => {
    const payload = JSON.stringify({ sectors: defs, overrides });
    const lsKey = portfolioToken ? `${SECTOR_LS_KEY}_${portfolioToken}` : SECTOR_LS_KEY;
    localStorage.setItem(lsKey, payload);
    if (portfolioToken) {
      fetch(`/api/sector?token=${portfolioToken}`, {
        method: 'POST',
        body: payload,
      }).catch(() => {});
    }
  }, [portfolioToken]);

  const handleSectorConfigChange = useCallback((defs: SectorDef[], overrides: Record<string, string>) => {
    setSectorDefs(defs);
    setSectorOverrides(overrides);
    saveSectorConfig(defs, overrides);
    // sector 필드만 즉시 재태깅 (가격 재조회 불필요)
    setHoldingsWithMeta((prev) =>
      prev.map((h) => ({ ...h, sector: overrides[h.종목번호] ?? tagSector(h) }))
    );
  }, [saveSectorConfig]);

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
            const [, overrides] = await Promise.all([
              loadMiscAssets(urlToken),
              loadSectorConfig(urlToken),
            ]);
            await handleUpload(holdings, overrides);
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
            const [, overrides] = await Promise.all([
              loadMiscAssets(urlToken),
              loadSectorConfig(urlToken),
            ]);
            await handleUpload(holdings, overrides);
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
        const [, overrides] = await Promise.all([
          loadMiscAssets(null),
          loadSectorConfig(null),
        ]);
        await handleUpload(holdings, overrides);
      } catch {
        // 샘플 로드 실패 시 빈 상태 유지
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredHoldings = useMemo(
    () => selectedAccount ? holdingsWithMeta.filter((h) => h.계좌 === selectedAccount) : holdingsWithMeta,
    [holdingsWithMeta, selectedAccount]
  );
  const consolidated = useMemo(() => consolidateHoldings(filteredHoldings), [filteredHoldings]);
  const accountSummaries = useMemo(() => calcAccountSummaries(holdingsWithMeta), [holdingsWithMeta]);
  const sectorAllocations = useMemo(
    () => calcSectorAllocations(filteredHoldings, sectorDefs, selectedAccount ? [] : miscAssets),
    [filteredHoldings, sectorDefs, miscAssets, selectedAccount]
  );
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
  const sectorHoldings = useMemo(
    () => selectedSector ? consolidated.filter((h) => h.sector === selectedSector) : [],
    [consolidated, selectedSector]
  );

  const handleSelectHolding = (h: ConsolidatedHolding) => {
    setSelectedHolding(h);
    setDrawerOpen(true);
  };

  const handleDeleteAll = async () => {
    if (portfolioToken) {
      await fetch(`/api/delete?token=${portfolioToken}`, { method: 'DELETE' }).catch(() => {});
      // localStorage 정리
      const keys = [
        'portfolio_csv',
        `misc_assets_${portfolioToken}`,
        `sector_config_${portfolioToken}`,
        `projection_params_${portfolioToken}`,
      ];
      keys.forEach((k) => localStorage.removeItem(k));
    } else {
      // 토큰 없을 때는 localStorage만
      ['portfolio_csv', 'misc_assets', 'sector_config'].forEach((k) => localStorage.removeItem(k));
    }
    // 상태 초기화 + URL에서 토큰 제거
    setPortfolioToken(null);
    setRawHoldings([]);
    setHoldingsWithMeta([]);
    setMiscAssets([]);
    setSectorDefs(DEFAULT_SECTORS);
    setSectorOverrides({});
    setShowDeleteConfirm(false);
    window.history.replaceState({}, '', window.location.pathname);
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

      {/* 타이틀 */}
      <div className="flex items-center gap-2 pb-1">
        <h1 className="text-xl font-bold tracking-tight">내 자산관리</h1>
      </div>

      {/* GNB 탭 */}
      <div className="flex gap-1 border-b border-border pb-0">
        {(['portfolio', 'projection', 'market'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'portfolio' ? '포트폴리오' : tab === 'projection' ? '미래 예측' : '시장 현황'}
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
          <AccountCards
            accounts={accountSummaries}
            selectedAccount={selectedAccount}
            onAccountClick={(account) => setSelectedAccount((prev) => prev === account ? null : account)}
          />

          {/* 3. 섹터 차트 + 종목 리스트 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 sm:gap-6">
            <div className="bg-card border rounded-xl p-4 xl:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold">섹터 비중</h2>
                {selectedAccount && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{selectedAccount}</span>
                )}
              </div>
              <SectorChart
                allocations={sectorAllocations}
                selectedSector={selectedSector}
                onSectorClick={setSelectedSector}
              />
            </div>
            <div className="bg-card border rounded-xl p-4 overflow-auto xl:col-span-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">종목별 수익률</h2>
                {selectedSector && (
                  <button
                    onClick={() => setSelectedSector(null)}
                    className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full hover:bg-muted/70 transition-colors"
                  >
                    <span>{selectedSector}</span>
                    <span className="text-muted-foreground">✕</span>
                  </button>
                )}
              </div>
              <StockList
                holdings={selectedSector ? sectorHoldings : consolidated}
                onSelect={handleSelectHolding}
              />
            </div>
          </div>

          {/* 3-2. 보유종목 히트맵 */}
          <HoldingsHeatmap holdings={consolidated} onSelect={handleSelectHolding} />

          {/* 4. 기타 자산 */}
          <MiscAssets assets={miscAssets} sectors={sectorDefs} onChange={handleMiscAssetsChange} />

          {/* 5. 섹터 관리 */}
          <SectorManager
            sectors={sectorDefs}
            overrides={sectorOverrides}
            holdings={rawHoldings}
            onChange={handleSectorConfigChange}
          />

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
          <div className="flex justify-end gap-4 items-center">
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
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-destructive/70 hover:text-destructive underline"
            >
              데이터 삭제
            </button>
          </div>

          {/* 데이터 삭제 확인 모달 */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-background border rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
                <h3 className="text-sm font-semibold">데이터 삭제</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  저장된 데이터와 토큰이 모두 삭제됩니다.<br />
                  계속하시겠습니까?
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
                  >
                    아니오
                  </button>
                  <button
                    onClick={handleDeleteAll}
                    className="px-4 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  >
                    네
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'projection' && (
        <ProjectionView totalEval={adjustedSummary?.totalEval ?? 0} token={portfolioToken} />
      )}

      {activeTab === 'market' && <MarketView />}

      {/* 종목 드릴다운 */}
      <StockDetailDrawer
        holding={selectedHolding}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
