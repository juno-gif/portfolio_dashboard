'use client';

import { PortfolioSummary } from '@/types/portfolio';
import { formatKRW, formatRate } from '@/lib/format';

interface HeroSectionProps {
  summary: PortfolioSummary;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export default function HeroSection({ summary, onRefresh, isRefreshing }: HeroSectionProps) {
  const todayPositive = summary.todayGainAmount >= 0;
  const totalPositive = summary.totalGainAmount >= 0;

  return (
    <div className="bg-card border rounded-xl p-4 sm:p-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-sm text-muted-foreground">
        <span>📊 포트폴리오 대시보드</span>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span className="font-medium text-foreground">
            USD/KRW {summary.exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
          </span>
          <span suppressHydrationWarning>{summary.updatedAt} 기준</span>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
          >
            <span className={isRefreshing ? 'animate-spin inline-block' : ''}>↻</span>
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {/* 메인 지표 */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        {/* 오늘 손익 — 최우선 표시 */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">오늘 손익</p>
          <p className={`text-2xl sm:text-4xl font-bold ${todayPositive ? 'text-green-500' : 'text-red-500'}`}>
            {todayPositive ? '+' : '-'}₩{Math.abs(summary.todayGainAmount).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
          </p>
          <p className={`text-lg sm:text-2xl font-semibold mt-1 ${todayPositive ? 'text-green-500' : 'text-red-500'}`}>
            {formatRate(summary.todayGainRate)}
          </p>
        </div>

        {/* 총 평가금액 */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">총 평가금액</p>
          <p className="text-xl sm:text-2xl font-bold">
            ₩{summary.totalEval.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            투자원금 ₩{formatKRW(summary.totalCost)}
          </p>
          <p className={`text-sm font-medium mt-1 ${totalPositive ? 'text-green-500' : 'text-red-500'}`}>
            전체 {totalPositive ? '+' : '-'}₩{Math.abs(summary.totalGainAmount).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} ({formatRate(summary.totalGainRate)})
          </p>
        </div>
      </div>
    </div>
  );
}
