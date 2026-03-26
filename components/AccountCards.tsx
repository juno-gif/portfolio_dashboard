'use client';

import { AccountSummary } from '@/types/portfolio';
import { Card, CardContent } from '@/components/ui/card';
import { formatKRW, formatRate } from '@/lib/format';

interface AccountCardsProps {
  accounts: AccountSummary[];
  selectedAccount?: string | null;
  onAccountClick?: (account: string) => void;
}

export default function AccountCards({ accounts, selectedAccount, onAccountClick }: AccountCardsProps) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))` }}>
      {accounts.map((acc) => {
        const positive = acc.todayGainAmount >= 0;
        const isSelected = selectedAccount === acc.account;
        return (
          <Card
            key={acc.account}
            className={`overflow-hidden cursor-pointer transition-all ${
              isSelected
                ? 'ring-2 ring-primary bg-primary/5'
                : selectedAccount
                  ? 'opacity-50 hover:opacity-75'
                  : 'hover:ring-1 hover:ring-border'
            }`}
            onClick={() => onAccountClick?.(acc.account)}
          >
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">{acc.account}</p>
              <p className="text-base font-bold truncate">
                ₩{formatKRW(acc.evalAmount)}
              </p>
              <p className={`text-sm font-medium mt-1 ${positive ? 'text-green-500' : 'text-red-500'}`}>
                {positive ? '+' : '-'}₩{formatKRW(Math.abs(acc.todayGainAmount))}
              </p>
              <p className={`text-xs ${positive ? 'text-green-500' : 'text-red-500'}`}>
                {formatRate(acc.todayGainRate)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
