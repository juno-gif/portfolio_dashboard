'use client';

import { ConsolidatedHolding } from '@/types/portfolio';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatRate } from '@/lib/format';

interface StockDetailDrawerProps {
  holding: ConsolidatedHolding | null;
  open: boolean;
  onClose: () => void;
}

export default function StockDetailDrawer({
  holding,
  open,
  onClose,
}: StockDetailDrawerProps) {
  if (!holding) return null;

  const todayPositive = holding.todayGainRate >= 0;
  const totalPositive = holding.gainRate >= 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <span>{holding.종목명}</span>
            <span className="text-sm text-muted-foreground font-normal">
              {holding.종목번호}
            </span>
            <Badge className="text-xs">{holding.sector}</Badge>
          </SheetTitle>
        </SheetHeader>

        {/* 요약 지표 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">총 보유수량</p>
            <p className="text-lg font-bold">{holding.totalQty.toLocaleString('ko-KR')}주</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">총 평가금액</p>
            <p className="text-lg font-bold">
              ₩{Math.round(holding.evalAmount / 10000).toLocaleString('ko-KR')}만
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">오늘 수익률</p>
            <p className={`text-lg font-bold ${todayPositive ? 'text-green-500' : 'text-red-500'}`}>
              {formatRate(holding.todayGainRate)}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">전체 수익률</p>
            <p className={`text-lg font-bold ${totalPositive ? 'text-green-500' : 'text-red-500'}`}>
              {formatRate(holding.gainRate)}
            </p>
          </div>
        </div>

        {holding.priceUnavailable && (
          <p className="text-xs text-amber-500 mb-4 bg-amber-50 rounded p-2">
            ⚠️ 현재가 조회에 실패하여 평균단가 기준으로 표시됩니다.
          </p>
        )}

        {/* 계좌별 분포 */}
        <div>
          <h3 className="text-sm font-semibold mb-3">계좌별 분포</h3>
          <div className="space-y-3">
            {holding.byAccount.map((acc) => (
              <div key={acc.account}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{acc.account}</span>
                  <div className="flex gap-3 text-muted-foreground">
                    <span>{acc.qty.toLocaleString('ko-KR')}주</span>
                    <span>₩{Math.round(acc.evalAmount / 10000).toLocaleString('ko-KR')}만</span>
                    <span className="font-semibold text-foreground">{acc.ratio.toFixed(1)}%</span>
                  </div>
                </div>
                <Progress value={acc.ratio} className="h-2" />
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
