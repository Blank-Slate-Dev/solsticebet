// apps/demo-web/src/components/KenoGame.tsx

'use client';

import { useEffect, useRef, useState } from 'react';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import { multiplierFor, placeKenoBet, type KenoBetOutcome } from '@solsticebet/game-keno';

import { useSession } from '@/lib/session-context';

export function KenoGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [stake, setStake] = useState('1');
  const [picks, setPicks] = useState<readonly number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<KenoBetOutcome | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current !== null) clearInterval(revealTimerRef.current);
    };
  }, []);

  const togglePick = (n: number) => {
    if (picks.includes(n)) {
      setPicks(picks.filter((p) => p !== n));
    } else if (picks.length < 10) {
      setPicks([...picks, n]);
    }
  };

  const submit = async () => {
    if (session === null || picks.length === 0) return;
    setError(null);
    setBusy(true);
    setLast(null);
    setRevealedCount(0);
    try {
      const num = bumpBetCount();
      const out = await placeKenoBet(session.ledger, {
        betId: `keno-${String(num)}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        stake: parseAmount(stake),
        picks,
        risk: 'classic',
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.kenoNonce,
      });
      bumpNonce('keno');
      setLast(out);
      // Reveal drawn numbers sequentially
      let i = 0;
      revealTimerRef.current = setInterval(() => {
        i += 1;
        setRevealedCount(i);
        if (i >= out.drawn.length) {
          if (revealTimerRef.current !== null) {
            clearInterval(revealTimerRef.current);
            revealTimerRef.current = null;
          }
        }
      }, 80);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Only reveal the first `revealedCount` numbers from the drawn list to
  // create a sequential reveal animation effect.
  const drawnRevealed = last?.drawn.slice(0, revealedCount) ?? [];
  const drawnSet = new Set(drawnRevealed);
  const lastPicksSet = new Set(last?.picks ?? []);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4 rounded-lg border border-solstice-border bg-solstice-bg/40 p-4">
        <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
          Pick 1-10 numbers from 1 to 80
        </div>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
            const isPicked = picks.includes(n);
            const wasPicked = lastPicksSet.has(n);
            const wasDrawn = drawnSet.has(n);
            let cls = 'rounded text-xs font-mono py-1.5 border transition ';
            if (last !== null) {
              if (wasPicked && wasDrawn)
                cls += 'border-solstice-win bg-solstice-win/30 text-solstice-win keno-draw';
              else if (wasPicked)
                cls += 'border-solstice-loss/40 bg-solstice-loss/10 text-solstice-loss';
              else if (wasDrawn)
                cls +=
                  'border-solstice-accent/40 bg-solstice-accent/10 text-solstice-accent keno-draw';
              else cls += 'border-solstice-border bg-solstice-card text-solstice-muted';
            } else if (isPicked) {
              cls += 'border-solstice-accent bg-solstice-accent/20 text-solstice-accent';
            } else {
              cls +=
                'border-solstice-border bg-solstice-card text-solstice-fg hover:border-solstice-accent';
            }
            return (
              <button
                key={`${n}-${String(wasDrawn)}-${String(revealedCount)}`}
                type="button"
                onClick={() => {
                  if (last === null) togglePick(n);
                }}
                disabled={busy || last !== null}
                className={cls}
              >
                {n}
              </button>
            );
          })}
        </div>
        {last !== null && (
          <div className="rounded-md border border-solstice-border bg-solstice-card/40 p-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
              Hits: {last.hits} / {last.picks.length}
            </div>
            <div
              className={`mt-1 font-mono text-xl font-bold ${
                last.isWin ? 'text-solstice-win' : 'text-solstice-loss'
              }`}
            >
              {last.multiplier > 0
                ? `${last.multiplier}× → +${formatAmountDisplay(last.payout - last.stake)} USDT`
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
        <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3 text-xs">
          <div className="text-solstice-muted">Picks: {picks.length} / 10</div>
          {picks.length > 0 && (
            <div className="mt-1 font-mono text-solstice-fg">
              {picks
                .slice()
                .sort((a, b) => a - b)
                .join(', ')}
            </div>
          )}
          {picks.length > 0 && (
            <div className="mt-2 text-[11px] text-solstice-muted">
              Max payout: {multiplierFor(picks.length, picks.length, 'classic')}× stake
            </div>
          )}
        </div>
        {last !== null ? (
          <button
            type="button"
            onClick={() => {
              setLast(null);
              setPicks([]);
            }}
            className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90"
          >
            New round
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              void submit();
            }}
            disabled={busy || session === null || picks.length === 0}
            className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Drawing...' : picks.length === 0 ? 'Pick at least 1' : `Draw (${stake} USDT)`}
          </button>
        )}
        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}
        <button
          type="button"
          onClick={() => {
            setPicks([]);
          }}
          disabled={busy || picks.length === 0 || last !== null}
          className="w-full text-xs text-solstice-muted hover:text-solstice-fg"
        >
          Clear picks
        </button>
      </div>
    </div>
  );
}
