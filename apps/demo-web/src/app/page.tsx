// apps/demo-web/src/app/page.tsx

'use client';

import { DemoBanner } from '@/components/DemoBanner';
import { GameTabs } from '@/components/GameTabs';
import { Header } from '@/components/Header';
import { LedgerPanel } from '@/components/LedgerPanel';
import { SeedPanel } from '@/components/SeedPanel';
import { SessionProvider } from '@/lib/session-context';

export default function HomePage() {
  return (
    <SessionProvider>
      <DemoBanner />
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-solstice-fg">Solstice Demo</h1>
          <p className="mt-1 text-sm text-solstice-muted">
            Provably-fair Dice, Mines, and Plinko. All bets run client-side against an in-memory
            ledger using the same engine packages the production system will use.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <GameTabs />
          <div className="space-y-6">
            <SeedPanel />
            <LedgerPanel />
          </div>
        </div>
      </main>
    </SessionProvider>
  );
}
