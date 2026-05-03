// apps/demo-web/src/components/MinesGame.tsx

'use client';

import { useState } from 'react';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import {
  cashOut,
  multiplierFor,
  revealTile,
  startRound,
  TOTAL_TILES,
  type MinesRound,
} from '@solsticebet/game-mines';

import { useSession } from '@/lib/session-context';

type TileState = 'hidden' | 'safe' | 'mine';

export function MinesGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [stake, setStake] = useState('1');
  const [mineCount, setMineCount] = useState(3);
  const [round, setRound] = useState<MinesRound | null>(null);
  const [tileStates, setTileStates] = useState<TileState[]>(() =>
    Array<TileState>(TOTAL_TILES).fill('hidden'),
  );
  const [bustedTile, setBustedTile] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = round?.state === 'active';
  const safeRevealed = round?.revealed.length ?? 0;
  const currentMultiplier =
    round !== null && safeRevealed > 0 ? multiplierFor(round.mineCount, safeRevealed) : 1;
  const potentialPayout =
    round !== null && safeRevealed > 0 ? (Number(round.stake) / 1e18) * currentMultiplier : 0;

  const startNew = async () => {
    if (session === null) return;
    setError(null);
    setBusy(true);
    try {
      const stakeBig = parseAmount(stake);
      const betNum = bumpBetCount();
      const r = await startRound(session.ledger, session.minesRounds, {
        roundId: `mines-${betNum}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        stake: stakeBig,
        mineCount,
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.minesNonce,
      });
      bumpNonce('mines');
      setRound(r);
      setTileStates(Array<TileState>(TOTAL_TILES).fill('hidden'));
      setBustedTile(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleReveal = async (tile: number) => {
    if (session === null || round === null || !isActive || busy) return;
    if (tileStates[tile] !== 'hidden') return;
    setBusy(true);
    try {
      const out = await revealTile(session.ledger, session.minesRounds, round.roundId, tile);
      setRound(out.round);
      const next = [...tileStates];
      next[tile] = out.wasMine === true ? 'mine' : 'safe';
      setTileStates(next);
      if (out.wasMine === true) {
        setBustedTile(tile);
        // Reveal all mine positions on the board for visual closure
        const minePositions = new Set(out.round.mineLayout.slice(0, out.round.mineCount));
        const updated = [...next];
        for (let i = 0; i < TOTAL_TILES; i++) {
          if (minePositions.has(i) && updated[i] === 'hidden') {
            updated[i] = 'mine';
          }
        }
        setTileStates(updated);
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCashOut = async () => {
    if (session === null || round === null || !isActive) return;
    setBusy(true);
    try {
      const out = await cashOut(session.ledger, session.minesRounds, round.roundId);
      setRound(out.round);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_240px]">
      <div className="rounded-lg border border-solstice-border bg-solstice-bg/40 p-6">
        <div className="mx-auto grid w-fit grid-cols-5 gap-2">
          {Array.from({ length: TOTAL_TILES }, (_, i) => {
            const state = tileStates[i] ?? 'hidden';
            const justBusted = bustedTile === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  void handleReveal(i);
                }}
                disabled={!isActive || busy || state !== 'hidden'}
                className={`flex h-14 w-14 items-center justify-center rounded-md border text-xl font-bold transition ${
                  state === 'hidden'
                    ? isActive
                      ? 'border-solstice-border bg-solstice-card text-solstice-muted hover:border-solstice-accent hover:bg-solstice-accent/10'
                      : 'border-solstice-border bg-solstice-card/30 text-solstice-muted/40'
                    : state === 'safe'
                      ? 'border-solstice-win bg-solstice-win/10 text-solstice-win'
                      : justBusted
                        ? 'border-solstice-loss bg-solstice-loss/30 text-solstice-loss'
                        : 'border-solstice-loss/40 bg-solstice-loss/10 text-solstice-loss/70'
                }`}
              >
                {state === 'safe' ? '✓' : state === 'mine' ? '✦' : ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {!isActive && (
          <>
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
                <label className="text-xs uppercase tracking-wider text-solstice-muted">
                  Mines
                </label>
                <span className="font-mono text-sm text-solstice-fg">{mineCount}</span>
              </div>
              <input
                type="range"
                min={1}
                max={24}
                step={1}
                value={mineCount}
                onChange={(e) => {
                  setMineCount(Number.parseInt(e.target.value, 10));
                }}
                disabled={busy}
                className="w-full accent-solstice-accent"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                void startNew();
              }}
              disabled={busy || session === null}
              className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Starting...' : `Start round (${stake} USDT)`}
            </button>
            {round !== null && (
              <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3 text-xs">
                <div className="text-solstice-muted">Last round:</div>
                <div
                  className={`font-bold ${
                    round.state === 'cashed_out' ? 'text-solstice-win' : 'text-solstice-loss'
                  }`}
                >
                  {round.state === 'cashed_out'
                    ? `Cashed out: +${formatAmountDisplay(round.payout ?? 0n)} USDT`
                    : 'Busted'}
                </div>
              </div>
            )}
          </>
        )}
        {isActive && (
          <>
            <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3 space-y-2">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
                  Multiplier
                </div>
                <div className="font-mono text-2xl text-solstice-accent">
                  {currentMultiplier.toFixed(4)}×
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
                  Cash out for
                </div>
                <div className="font-mono text-lg text-solstice-win">
                  {potentialPayout.toFixed(2)} USDT
                </div>
              </div>
              <div className="text-xs text-solstice-muted">
                {safeRevealed} safe / {round?.mineCount ?? 0} mines
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleCashOut();
              }}
              disabled={busy || safeRevealed === 0}
              className="w-full rounded-md bg-solstice-win px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90 disabled:opacity-30"
            >
              {safeRevealed === 0 ? 'Reveal at least 1 tile' : 'Cash out'}
            </button>
          </>
        )}
        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}
      </div>
    </div>
  );
}
