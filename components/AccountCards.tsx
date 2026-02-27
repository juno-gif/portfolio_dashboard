'use client';

import { AccountSummary } from '@/types/portfolio';
import { Card, CardContent } from '@/components/ui/card';
import { formatKRW, formatRate } from '@/lib/format';

interface AccountCardsProps {
  accounts: AccountSummary[];
}

export default function AccountCards({ accounts }: AccountCardsProps) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {accounts.map((acc) => {
        const positive = acc.todayGainAmount >= 0;
        return (
          <Card key={acc.account} className="overflow-hidden">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">{acc.account}</p>
              <p className="text-base font-bold truncate">
                ₩{formatKRW(acc.evalAmount)}
              </p>
              <p className={`text-sm font-medium mt-1 ${positive ? 'text-green-500' : 'text-red-500'}`}>
                {positive ? '+' : ''}₩{formatKRW(Math.abs(acc.todayGainAmount))}
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
