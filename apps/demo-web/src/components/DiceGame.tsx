// apps/demo-web/src/components/DiceGame.tsx

'use client';

import { useState } from 'react';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import {
  computeMultiplier,
  placeDiceBet,
  type DiceBetOutcome,
  type DiceMode,
} from '@solsticebet/game-dice';

import { useSession } from '@/lib/session-context';

export function DiceGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [stake, setStake] = useState('1');
  const [target, setTarget] = useState(50);
  const [mode, setMode] = useState<DiceMode>('over');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<DiceBetOutcome | null>(null);

  const multiplier = computeMultiplier(target, mode);
  const winChance = mode === 'under' ? target : 100 - target;

  const placeBet = async () => {
    if (session === null) return;
    setError(null);
    setBusy(true);
    try {
      const stakeBig = parseAmount(stake);
      const betNum = bumpBetCount();
      const out = await placeDiceBet(session.ledger, {
        betId: `dice-${betNum}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        stake: stakeBig,
        target,
        mode,
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.diceNonce,
      });
      bumpNonce('dice');
      setLastResult(out);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
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
          <div className="mb-1 flex items-baseline justify-between">
            <label className="text-xs uppercase tracking-wider text-solstice-muted">Target</label>
            <span className="font-mono text-sm text-solstice-fg">{target.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={2}
            max={98}
            step={0.01}
            value={target}
            onChange={(e) => {
              setTarget(Number.parseFloat(e.target.value));
            }}
            disabled={busy}
            className="w-full accent-solstice-accent"
          />
          <div className="mt-1 flex justify-between text-[10px] text-solstice-muted">
            <span>2.00</span>
            <span>98.00</span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-solstice-muted">
            Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('under');
              }}
              disabled={busy}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                mode === 'under'
                  ? 'border-solstice-accent bg-solstice-accent/10 text-solstice-accent'
                  : 'border-solstice-border bg-solstice-bg text-solstice-muted hover:text-solstice-fg'
              }`}
            >
              Under
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('over');
              }}
              disabled={busy}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                mode === 'over'
                  ? 'border-solstice-accent bg-solstice-accent/10 text-solstice-accent'
                  : 'border-solstice-border bg-solstice-bg text-solstice-muted hover:text-solstice-fg'
              }`}
            >
              Over
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-md border border-solstice-border bg-solstice-bg/50 p-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
              Multiplier
            </div>
            <div className="font-mono text-lg text-solstice-accent">{multiplier.toFixed(4)}×</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
              Win chance
            </div>
            <div className="font-mono text-lg text-solstice-fg">{winChance.toFixed(2)}%</div>
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
          {busy ? 'Placing...' : `Roll dice for ${stake} USDT`}
        </button>

        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}
      </div>

      <div className="rounded-lg border border-solstice-border bg-solstice-bg/40 p-6">
        <div className="mb-2 text-xs uppercase tracking-widest text-solstice-muted">Last roll</div>
        {lastResult === null ? (
          <p className="text-sm text-solstice-muted">
            No bets yet. Set your stake, target, mode, and roll.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="text-center">
              <div
                className={`font-mono text-6xl font-bold tabular-nums ${
                  lastResult.isWin ? 'text-solstice-win' : 'text-solstice-loss'
                }`}
              >
                {lastResult.roll.toFixed(2)}
              </div>
              <div className="mt-1 text-xs text-solstice-muted">
                vs target {lastResult.target.toFixed(2)} ({lastResult.mode})
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-solstice-muted">Multiplier: </span>
                <span className="font-mono text-solstice-fg">
                  {lastResult.multiplier.toFixed(4)}×
                </span>
              </div>
              <div>
                <span className="text-solstice-muted">Outcome: </span>
                <span
                  className={`font-bold ${
                    lastResult.isWin ? 'text-solstice-win' : 'text-solstice-loss'
                  }`}
                >
                  {lastResult.isWin ? 'WIN' : 'LOSS'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-solstice-muted">
                  {lastResult.isWin ? 'Payout: ' : 'Lost: '}
                </span>
                <span
                  className={`font-mono font-bold ${
                    lastResult.isWin ? 'text-solstice-win' : 'text-solstice-loss'
                  }`}
                >
                  {lastResult.isWin ? '+' : '-'}
                  {formatAmountDisplay(
                    lastResult.isWin ? lastResult.payout : lastResult.stake,
                  )}{' '}
                  USDT
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
