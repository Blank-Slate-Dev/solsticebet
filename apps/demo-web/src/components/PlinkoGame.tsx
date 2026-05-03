// apps/demo-web/src/components/PlinkoGame.tsx

'use client';

import { useState } from 'react';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import {
  getTable,
  placePlinkoBet,
  type PlinkoBetOutcome,
  type PlinkoRisk,
  type PlinkoRows,
  ROWS_VALUES,
  RISK_VALUES,
} from '@solsticebet/game-plinko';

import { useSession } from '@/lib/session-context';

export function PlinkoGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [stake, setStake] = useState('1');
  const [rows, setRows] = useState<PlinkoRows>(8);
  const [risk, setRisk] = useState<PlinkoRisk>('medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PlinkoBetOutcome | null>(null);

  const table = getTable(rows, risk);

  const placeBet = async () => {
    if (session === null) return;
    setError(null);
    setBusy(true);
    try {
      const stakeBig = parseAmount(stake);
      const betNum = bumpBetCount();
      const out = await placePlinkoBet(session.ledger, {
        betId: `plinko-${betNum}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        stake: stakeBig,
        rows,
        risk,
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.plinkoNonce,
      });
      bumpNonce('plinko');
      setLastResult(out);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const lastBucket = lastResult?.bucket ?? -1;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_240px]">
      <div className="space-y-4 rounded-lg border border-solstice-border bg-solstice-bg/40 p-6">
        {lastResult !== null && (
          <div className="text-center text-sm">
            <span className="text-solstice-muted">Path: </span>
            <span className="font-mono text-solstice-fg">
              {lastResult.path.map((d) => (d === 'left' ? '◀' : '▶')).join(' ')}
            </span>
          </div>
        )}

        <div className="flex justify-center">
          <div className="grid grid-flow-col gap-1">
            {table.map((mul, i) => {
              const isWinningBucket = i === lastBucket;
              return (
                <div
                  key={i}
                  className={`flex h-12 min-w-[40px] flex-col items-center justify-center rounded-md border px-1 text-[11px] font-mono transition ${
                    isWinningBucket
                      ? mul > 1
                        ? 'border-solstice-win bg-solstice-win/20 text-solstice-win'
                        : mul === 1
                          ? 'border-yellow-500 bg-yellow-500/20 text-yellow-300'
                          : 'border-solstice-loss bg-solstice-loss/20 text-solstice-loss'
                      : mul >= 10
                        ? 'border-solstice-accent/40 bg-solstice-accent/5 text-solstice-accent'
                        : mul > 1
                          ? 'border-solstice-border bg-solstice-card text-solstice-fg'
                          : mul === 1
                            ? 'border-solstice-border bg-solstice-card text-solstice-muted'
                            : 'border-solstice-border bg-solstice-card text-solstice-muted/70'
                  }`}
                >
                  <div className="font-bold">{mul}×</div>
                  <div className="text-[9px] text-solstice-muted">{i}</div>
                </div>
              );
            })}
          </div>
        </div>

        {lastResult !== null && (
          <div className="border-t border-solstice-border pt-4 text-center">
            <div className="text-xs uppercase tracking-widest text-solstice-muted">
              Bucket {lastResult.bucket} · {lastResult.multiplier}×
            </div>
            <div
              className={`mt-1 font-mono text-xl font-bold ${
                lastResult.payout > lastResult.stake
                  ? 'text-solstice-win'
                  : lastResult.payout === lastResult.stake
                    ? 'text-yellow-300'
                    : 'text-solstice-loss'
              }`}
            >
              {lastResult.payout > lastResult.stake
                ? `+${formatAmountDisplay(lastResult.payout - lastResult.stake)} USDT`
                : lastResult.payout === lastResult.stake
                  ? 'PUSH (stake refunded)'
                  : `-${formatAmountDisplay(lastResult.stake - lastResult.payout)} USDT`}
            </div>
          </div>
        )}

        {lastResult === null && (
          <p className="text-center text-xs text-solstice-muted">
            Pick stake, rows, and risk; drop the ball.
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-solstice-muted">
            Stake (USDT)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={stake}
            onChange={(e) => {
              setStake(e.target.value);
            }}
            disabled={busy}
            className="w-full rounded-md border border-solstice-border bg-solstice-bg px-3 py-2 font-mono text-sm text-solstice-fg focus:border-solstice-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-solstice-muted">
            Rows
          </label>
          <div className="grid grid-cols-3 gap-2">
            {ROWS_VALUES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRows(r);
                }}
                disabled={busy}
                className={`rounded-md border px-2 py-2 text-sm font-medium ${
                  rows === r
                    ? 'border-solstice-accent bg-solstice-accent/10 text-solstice-accent'
                    : 'border-solstice-border bg-solstice-bg text-solstice-muted hover:text-solstice-fg'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-solstice-muted">
            Risk
          </label>
          <div className="grid grid-cols-3 gap-2">
            {RISK_VALUES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRisk(r);
                }}
                disabled={busy}
                className={`rounded-md border px-2 py-2 text-xs font-medium ${
                  risk === r
                    ? 'border-solstice-accent bg-solstice-accent/10 text-solstice-accent'
                    : 'border-solstice-border bg-solstice-bg text-solstice-muted hover:text-solstice-fg'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void placeBet();
          }}
          disabled={busy || session === null}
          className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Dropping...' : `Drop ball (${stake} USDT)`}
        </button>
        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}
      </div>
    </div>
  );
}
