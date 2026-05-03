// apps/demo-web/src/components/Header.tsx

'use client';

import { formatAmountDisplay } from '@solsticebet/ledger';

import { useSession } from '@/lib/session-context';

export function Header() {
  const { balanceWei, session, reset } = useSession();
  return (
    <header className="border-b border-solstice-border bg-solstice-card/40 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-solstice-accent to-solstice-accent-deep" />
            <div className="absolute inset-1 rounded-full bg-solstice-bg" />
            <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-solstice-accent" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-solstice-fg">Solstice</div>
            <div className="text-[10px] uppercase tracking-widest text-solstice-muted">Demo</div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-solstice-muted">Balance</div>
            <div className="font-mono text-2xl font-bold tabular-nums text-solstice-accent">
              {session === null ? '...' : formatAmountDisplay(balanceWei, 4)}{' '}
              <span className="text-sm text-solstice-muted">USDT</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void reset();
            }}
            className="rounded-md border border-solstice-border bg-solstice-card px-3 py-1.5 text-xs text-solstice-muted hover:border-solstice-accent hover:text-solstice-fg"
          >
            Reset session
          </button>
        </div>
      </div>
    </header>
  );
}
