// apps/demo-web/src/components/LedgerPanel.tsx

'use client';

import { formatAmountDisplay } from '@solsticebet/ledger';

import { useSession } from '@/lib/session-context';

export function LedgerPanel() {
  const { recentEntries } = useSession();

  return (
    <section className="rounded-lg border border-solstice-border bg-solstice-card/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-solstice-muted">
        Recent ledger entries
      </h2>
      {recentEntries.length === 0 ? (
        <p className="text-xs text-solstice-muted">No bets yet. Place one to see ledger entries.</p>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-solstice-border text-left text-solstice-muted">
                <th className="py-2 pr-2 font-normal">#</th>
                <th className="py-2 pr-2 font-normal">type</th>
                <th className="py-2 pr-2 text-right font-normal">amount</th>
                <th className="py-2 font-normal">ref</th>
              </tr>
            </thead>
            <tbody>
              {recentEntries.map((e) => {
                const positive = e.amount >= 0n;
                const sign = positive ? '+' : '';
                return (
                  <tr key={e.id} className="border-b border-solstice-border/40">
                    <td className="py-1.5 pr-2 text-solstice-muted">{e.id}</td>
                    <td className="py-1.5 pr-2 text-solstice-fg">{e.transactionType}</td>
                    <td
                      className={`py-1.5 pr-2 text-right tabular-nums ${
                        positive ? 'text-solstice-win' : 'text-solstice-loss'
                      }`}
                    >
                      {sign}
                      {formatAmountDisplay(e.amount, 4)}
                    </td>
                    <td className="truncate py-1.5 text-solstice-muted">{e.referenceId ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
