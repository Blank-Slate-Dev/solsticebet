// apps/demo-web/src/components/SeedPanel.tsx

'use client';

import { useSession } from '@/lib/session-context';

export function SeedPanel() {
  const { session } = useSession();
  if (session === null) return null;

  return (
    <details className="rounded-lg border border-solstice-border bg-solstice-card/60 p-4">
      <summary className="cursor-pointer text-sm font-medium text-solstice-muted hover:text-solstice-fg">
        Provably-fair seeds
      </summary>
      <dl className="mt-3 grid gap-2 font-mono text-xs">
        <div className="flex flex-wrap gap-x-3">
          <dt className="text-solstice-muted">Server seed hash (commit):</dt>
          <dd className="break-all text-solstice-fg">{session.serverSeedHash}</dd>
        </div>
        <div className="flex flex-wrap gap-x-3">
          <dt className="text-solstice-muted">Client seed:</dt>
          <dd className="break-all text-solstice-fg">{session.clientSeed}</dd>
        </div>
        <div className="flex flex-wrap gap-x-3">
          <dt className="text-solstice-muted">Nonces:</dt>
          <dd className="text-solstice-fg">
            dice {session.diceNonce} · mines {session.minesNonce} · plinko {session.plinkoNonce} ·
            roulette {session.rouletteNonce} · baccarat {session.baccaratNonce} · blackjack{' '}
            {session.blackjackNonce} · crash {session.crashNonce} · uth {session.uthNonce} · sicbo{' '}
            {session.sicboNonce} · coin-flip {session.coinFlipNonce} · limbo {session.limboNonce} ·
            lucky-wheel {session.luckyWheelNonce} · keno {session.kenoNonce} · hi-lo{' '}
            {session.hiLoNonce}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-solstice-muted">
        In production, the server seed is held secret until rotation, then revealed. In this demo,
        you can see it in dev tools — it&apos;s only committed via its hash to keep the API shape
        realistic.
      </p>
    </details>
  );
}
