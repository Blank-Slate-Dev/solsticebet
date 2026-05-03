// apps/demo-web/src/components/CrashGame.tsx

'use client';

import { useEffect, useRef, useState } from 'react';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import { placeCrashBet, type CrashBetOutcome } from '@solsticebet/game-crash';

import { useSession } from '@/lib/session-context';

type AnimationPhase = 'idle' | 'climbing' | 'busted';

/**
 * The visual climb is purely cosmetic — the bet outcome is already decided
 * at bet placement time. We animate from 1.00x toward bustAt over a duration
 * that scales with the magnitude of bustAt so dramatic crashes feel dramatic
 * but a bust at 1.00x doesn't take 5 seconds.
 *
 * Crash multipliers grow exponentially over time in real Crash; we use the
 * canonical formula multiplier(t) = e^(t * 0.06) and find t where the
 * multiplier reaches bustAt.
 */
function timeToReach(target: number): number {
  // multiplier = e^(t * 0.06); t = ln(multiplier) / 0.06
  return Math.log(target) / 0.06;
}

function multiplierAt(t: number): number {
  return Math.exp(t * 0.06);
}

export function CrashGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [stake, setStake] = useState('1');
  const [autoCashOut, setAutoCashOut] = useState('2.00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CrashBetOutcome | null>(null);
  const [phase, setPhase] = useState<AnimationPhase>('idle');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const animationRef = useRef<number | null>(null);
  const animationStartRef = useRef<number>(0);

  // Stop any running animation when the component unmounts or before a new bet
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const placeBet = async () => {
    if (session === null) return;
    setError(null);
    setBusy(true);
    setOutcome(null);
    setPhase('idle');
    setCurrentMultiplier(1.0);
    try {
      const stakeBig = parseAmount(stake);
      const acoNum = Number.parseFloat(autoCashOut);
      if (!Number.isFinite(acoNum)) {
        throw new Error('autoCashOut must be a number');
      }
      const num = bumpBetCount();
      const out = await placeCrashBet(session.ledger, {
        betId: `crash-${String(num)}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        stake: stakeBig,
        autoCashOut: Math.round(acoNum * 100) / 100,
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.crashNonce,
      });
      bumpNonce('crash');
      setOutcome(out);
      await refresh();
      // Start animation
      runAnimation(out.bustAt, out.autoCashOut, out.isWin);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const runAnimation = (bustAt: number, aco: number, isWin: boolean) => {
    setPhase('climbing');
    animationStartRef.current = performance.now();
    // Total animation duration: scale by log(bustAt) so high multipliers take
    // a bit longer, but cap so even huge multipliers complete in ~6 seconds.
    const totalT = timeToReach(bustAt);
    const durationSec = Math.min(Math.max(totalT, 0.4), 6);

    const tick = () => {
      const now = performance.now();
      const elapsedSec = (now - animationStartRef.current) / 1000;
      const fraction = Math.min(elapsedSec / durationSec, 1);
      // Map fraction → t (0 to totalT)
      const t = fraction * totalT;
      const m = multiplierAt(t);
      // Clamp visual multiplier to bustAt
      const display = Math.min(m, bustAt);
      setCurrentMultiplier(display);

      if (fraction >= 1) {
        setPhase('busted');
        setBusy(false);
        // If player won (cashed out before bust), freeze at their cash-out for clarity
        if (isWin) {
          setCurrentMultiplier(aco);
        } else {
          setCurrentMultiplier(bustAt);
        }
        animationRef.current = null;
        return;
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  };

  const reset = () => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setOutcome(null);
    setPhase('idle');
    setCurrentMultiplier(1.0);
    setError(null);
    setBusy(false);
  };

  // Visual styling for the multiplier number
  let multiplierColor = 'text-solstice-fg';
  if (phase === 'climbing') {
    if (outcome !== null && currentMultiplier >= outcome.autoCashOut && outcome.isWin) {
      multiplierColor = 'text-solstice-win';
    } else {
      multiplierColor = 'text-solstice-accent';
    }
  } else if (phase === 'busted') {
    multiplierColor = outcome?.isWin === true ? 'text-solstice-win' : 'text-solstice-loss';
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      {/* Climb display */}
      <div className="flex flex-col items-center justify-center rounded-lg border border-solstice-border bg-solstice-bg/40 p-6">
        <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
          {phase === 'idle'
            ? 'Place a bet to begin'
            : phase === 'climbing'
              ? 'Climbing...'
              : outcome?.isWin === true
                ? 'Cashed out'
                : 'Busted'}
        </div>
        <div
          className={`mt-2 font-mono text-7xl font-bold tabular-nums transition-colors ${multiplierColor}`}
        >
          {currentMultiplier.toFixed(2)}×
        </div>

        {phase !== 'idle' && outcome !== null && (
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-solstice-border bg-solstice-card/40 p-2 text-center">
              <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
                Cash out at
              </div>
              <div className="font-mono">{outcome.autoCashOut.toFixed(2)}×</div>
            </div>
            <div className="rounded-md border border-solstice-border bg-solstice-card/40 p-2 text-center">
              <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
                Bust at
              </div>
              <div className="font-mono">{outcome.bustAt.toFixed(2)}×</div>
            </div>
          </div>
        )}

        {phase === 'busted' && outcome !== null && (
          <div className="mt-6 text-center">
            <div className="text-[10px] uppercase tracking-widest text-solstice-muted">Result</div>
            <div
              className={`mt-1 font-mono text-2xl font-bold ${
                outcome.isWin ? 'text-solstice-win' : 'text-solstice-loss'
              }`}
            >
              {outcome.isWin
                ? `+${formatAmountDisplay(outcome.payout - outcome.stake)} USDT`
                : `−${formatAmountDisplay(outcome.stake)} USDT`}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
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
            Auto cash out (≥ 1.01)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={autoCashOut}
            onChange={(e) => {
              setAutoCashOut(e.target.value);
            }}
            disabled={busy}
            className="w-full rounded-md border border-solstice-border bg-solstice-bg px-3 py-2 font-mono text-sm text-solstice-fg focus:border-solstice-accent focus:outline-none"
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {['1.50', '2.00', '5.00', '10.00'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setAutoCashOut(v);
                }}
                disabled={busy}
                className="rounded border border-solstice-border px-2 py-1 text-[11px] text-solstice-muted hover:border-solstice-accent hover:text-solstice-fg"
              >
                {v}×
              </button>
            ))}
          </div>
        </div>

        {phase === 'busted' ? (
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90"
          >
            Play again
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              void placeBet();
            }}
            disabled={busy || session === null}
            className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Climbing...' : `Bet ${stake} USDT`}
          </button>
        )}

        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}

        <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3 text-[11px] text-solstice-muted">
          <p className="mb-1 font-semibold text-solstice-fg">How this works</p>
          <p>
            Single-player Crash. The bust point is determined when you place the bet via the
            provably-fair RNG. The climb is a visual replay; multiplayer real-time Crash will be
            added when the game-server is built.
          </p>
        </div>
      </div>
    </div>
  );
}
