'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { RawHolding, HoldingWithMeta, ConsolidatedHolding } from '@/types/portfolio';
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

export default function Home() {
  const [rawHoldings, setRawHoldings] = useState<RawHolding[]>([]);
  const [holdingsWithMeta, setHoldingsWithMeta] = useState<HoldingWithMeta[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(1370);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [selectedHolding, setSelectedHolding] = useState<ConsolidatedHolding | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
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

  // 마운트 시: 저장된 CSV 복원 → 없으면 샘플 로드
  useEffect(() => {
    (async () => {
      try {
        const saved = localStorage.getItem('portfolio_csv');
        if (saved) {
          const file = new File([saved], 'portfolio.csv', { type: 'text/csv' });
          const holdings = await parsePortfolioCSV(file);
          await handleUpload(holdings);
          return;
        }
      } catch {
        localStorage.removeItem('portfolio_csv');
      }
      // 저장된 데이터 없음 → 샘플 로드 (localStorage에 저장 안 함)
      try {
        const res = await fetch('/sample.csv');
        const text = await res.text();
        const file = new File([text], 'sample.csv', { type: 'text/csv' });
        const holdings = await parsePortfolioCSV(file);
        await handleUpload(holdings);
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
      <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto relative"
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
      {/* 1. 히어로 — 오늘 손익 최우선 */}
      <HeroSection
        summary={portfolioSummary}
        onRefresh={handleRefresh}
        isRefreshing={loading}
      />

      {/* 2. 계좌별 카드 */}
      <AccountCards accounts={accountSummaries} />

      {/* 3. 섹터 차트 + 종목 리스트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-card border rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">섹터 비중</h2>
          <SectorChart allocations={sectorAllocations} />
        </div>
        <div className="bg-card border rounded-xl p-4 overflow-auto">
          <h2 className="text-sm font-semibold mb-3">종목별 수익률</h2>
          <StockList holdings={consolidated} onSelect={handleSelectHolding} />
        </div>
      </div>

      {/* 4. CSV 다운로드 / 재업로드 */}
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

      {/* 종목 드릴다운 */}
      <StockDetailDrawer
        holding={selectedHolding}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
