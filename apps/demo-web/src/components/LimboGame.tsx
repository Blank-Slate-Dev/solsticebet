// apps/demo-web/src/components/LimboGame.tsx

'use client';

import { useEffect, useRef, useState } from 'react';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import { placeLimboBet, type LimboBetOutcome } from '@solsticebet/game-limbo';

import { useSession } from '@/lib/session-context';

type AnimPhase = 'idle' | 'climbing' | 'settled';

function timeToReach(target: number): number {
  // multiplier(t) = e^(t * 0.06); t = ln(m) / 0.06
  return Math.log(target) / 0.06;
}
function multiplierAt(t: number): number {
  return Math.exp(t * 0.06);
}

export function LimboGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [stake, setStake] = useState('1');
  const [target, setTarget] = useState('2.00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<LimboBetOutcome | null>(null);
  const [phase, setPhase] = useState<AnimPhase>('idle');
  const [currentMul, setCurrentMul] = useState(1.0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const runClimb = (resultMul: number) => {
    setPhase('climbing');
    startRef.current = performance.now();
    const totalT = timeToReach(resultMul);
    const durationSec = Math.min(Math.max(totalT, 0.4), 5);

    const tick = () => {
      const elapsedSec = (performance.now() - startRef.current) / 1000;
      const fraction = Math.min(elapsedSec / durationSec, 1);
      const t = fraction * totalT;
      const m = multiplierAt(t);
      setCurrentMul(Math.min(m, resultMul));
      if (fraction >= 1) {
        setCurrentMul(resultMul);
        setPhase('settled');
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const placeBet = async () => {
    if (session === null) return;
    setError(null);
    setBusy(true);
    setLast(null);
    setPhase('idle');
    setCurrentMul(1.0);
    try {
      const t = Number.parseFloat(target);
      const num = bumpBetCount();
      const out = await placeLimboBet(session.ledger, {
        betId: `limbo-${String(num)}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        stake: parseAmount(stake),
        target: Math.round(t * 100) / 100,
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.limboNonce,
      });
      bumpNonce('limbo');
      setLast(out);
      await refresh();
      runClimb(out.result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const settled = phase === 'settled' && last !== null;
  const climbing = phase === 'climbing';
  const mulColor = settled
    ? last.isWin
      ? 'text-solstice-win'
      : 'text-solstice-loss'
    : climbing
      ? 'text-solstice-accent'
      : 'text-solstice-muted';

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="flex flex-col items-center justify-center rounded-lg border border-solstice-border bg-solstice-bg/40 p-8 min-h-[320px]">
        <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
          {phase === 'idle'
            ? 'Set target & bet'
            : climbing
              ? 'Climbing...'
              : last?.isWin === true
                ? 'Won'
                : 'Crashed'}
        </div>
        <div
          className={`mt-4 font-mono text-7xl font-bold tabular-nums transition-colors ${mulColor}`}
        >
          {phase === 'idle' && last === null ? '—' : `${currentMul.toFixed(2)}×`}
        </div>
        {settled && last !== null && (
          <div className="mt-4 text-center">
            <div className="text-xs text-solstice-muted">Target: {last.target.toFixed(2)}×</div>
            <div
              className={`mt-2 font-mono text-xl font-bold ${last.isWin ? 'text-solstice-win' : 'text-solstice-loss'}`}
            >
              {last.isWin
                ? `+${formatAmountDisplay(last.payout - last.stake)} USDT`
                : `−${formatAmountDisplay(last.stake)} USDT`}
            </div>
          </div>
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
            Target multiplier (≥ 1.01)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
            }}
            disabled={busy}
            className="w-full rounded-md border border-solstice-border bg-solstice-bg px-3 py-2 font-mono text-sm text-solstice-fg focus:border-solstice-accent focus:outline-none"
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {['1.50', '2.00', '5.00', '10.00', '100.00'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setTarget(v);
                }}
                disabled={busy}
                className="rounded border border-solstice-border px-2 py-1 text-[11px] text-solstice-muted hover:border-solstice-accent hover:text-solstice-fg"
              >
                {v}×
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
          {busy ? 'Rolling...' : `Bet ${stake} USDT`}
        </button>
        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}
        <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3 text-[11px] text-solstice-muted">
          Pick a target multiplier. Win if RNG result ≥ your target. Same long-tail distribution as
          Crash.
        </div>
      </div>
    </div>
  );
}
