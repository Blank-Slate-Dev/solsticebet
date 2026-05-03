// apps/demo-web/src/components/HiLoGame.tsx
//
// Rainbet-style Hi-Lo: felt with deck on the right, big card in center,
// chip-based betting, history strip, dynamic pick buttons.

'use client';

import { useState } from 'react';

import { formatAmountDisplay } from '@solsticebet/ledger';
import {
  availablePicks,
  cashOut,
  pick,
  pickMultiplier,
  pickProbability,
  startRound,
  type HiLoPick,
  type HiLoRound,
} from '@solsticebet/game-hi-lo';

import { useSession } from '@/lib/session-context';

import { ActionButton } from './casino/ActionButton';
import { CasinoCard } from './casino/CasinoCard';
import { type ChipDenom, ChipSelector, BetCircle } from './casino/Chips';
import { Deck } from './casino/Deck';
import { Felt } from './casino/Felt';

export function HiLoGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [betAmount, setBetAmount] = useState<bigint>(0n);
  const [round, setRound] = useState<HiLoRound | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addChip = (d: ChipDenom) => {
    setBetAmount((p) => p + d.value);
  };
  const clear = () => {
    setBetAmount(0n);
  };

  const start = async () => {
    if (session === null || betAmount === 0n) return;
    setError(null);
    setBusy(true);
    try {
      const num = bumpBetCount();
      const r = await startRound(session.ledger, session.hiLoRounds, {
        roundId: `hilo-${String(num)}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        stake: betAmount,
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.hiLoNonce,
      });
      bumpNonce('hi-lo');
      setRound(r);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doPick = async (p: HiLoPick) => {
    if (session === null || round === null) return;
    setError(null);
    setBusy(true);
    try {
      const r = await pick(session.ledger, session.hiLoRounds, round.roundId, p);
      setRound(r);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doCashOut = async () => {
    if (session === null || round === null) return;
    setError(null);
    setBusy(true);
    try {
      const r = await cashOut(session.ledger, session.hiLoRounds, round.roundId);
      setRound(r);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setRound(null);
    setBetAmount(0n);
    setError(null);
  };

  const isActive = round?.state === 'active';
  const isFinished = round !== null && round.state !== 'active';
  const currentRank =
    round !== null && round.cards.length > 0 ? (round.cards[round.cards.length - 1] ?? 0) : null;
  const available = currentRank !== null && isActive ? availablePicks(currentRank) : [];
  const higherAvailable = available.includes('higher_or_equal');
  const lowerAvailable = available.includes('lower_or_equal');
  const higherProb = currentRank !== null ? pickProbability(currentRank, 'higher_or_equal') : 0;
  const lowerProb = currentRank !== null ? pickProbability(currentRank, 'lower_or_equal') : 0;
  const higherMul = higherProb > 0 ? pickMultiplier(higherProb) : 0;
  const lowerMul = lowerProb > 0 ? pickMultiplier(lowerProb) : 0;

  const historyCards = round !== null && round.cards.length > 1 ? round.cards.slice(0, -1) : [];

  return (
    <div className="space-y-4">
      <Felt
        tagline={
          round === null
            ? 'GUESS HIGHER OR LOWER · TIES WIN'
            : `STREAK ${String(round.picks.length)} · MULTIPLIER ${round.currentMultiplier.toFixed(2)}×`
        }
      >
        <div className="absolute right-6 top-1/2 -translate-y-1/2">
          <Deck size="md" />
        </div>

        {/* Big main card center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {currentRank !== null ? (
            <div className="perspective-[1000px]">
              <div
                key={`hilo-card-${String(round?.cards.length ?? 0)}`}
                className={`card-deal-from-deck flex h-44 w-32 flex-col items-center justify-between rounded-lg border-2 bg-white p-3 text-black shadow-2xl ${
                  round?.state === 'busted'
                    ? 'border-solstice-loss ring-2 ring-solstice-loss/50'
                    : round?.state === 'cashed_out'
                      ? 'border-solstice-win ring-2 ring-solstice-win/50'
                      : 'border-solstice-accent ring-2 ring-solstice-accent/50'
                }`}
                style={
                  {
                    '--deal-from-x': '320px',
                    '--deal-from-y': '0px',
                  } as React.CSSProperties
                }
              >
                <div className="text-2xl font-bold text-zinc-900">
                  {['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][currentRank]}
                </div>
                <div className="text-7xl font-bold text-zinc-900">
                  {['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][currentRank]}
                </div>
                <div className="rotate-180 text-2xl font-bold text-zinc-900">
                  {['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][currentRank]}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-44 w-32 items-center justify-center rounded-lg border-2 border-dashed border-solstice-border bg-solstice-card/40 text-xs text-solstice-muted">
              Place bet to deal
            </div>
          )}

          {/* History strip below card */}
          {historyCards.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1 px-4">
              {historyCards.slice(-12).map((rank, i) => (
                <CasinoCard
                  key={`hist-${String(i)}`}
                  rank={rank}
                  size="sm"
                  animKey={`hist-${String(i)}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bet circle bottom-left */}
        <div className="absolute bottom-6 left-6">
          <BetCircle
            label="Stake"
            amount={isFinished ? round.stake : betAmount}
            highlight={betAmount > 0n && round === null}
          />
        </div>

        {/* Result panel bottom-right */}
        {isFinished && round !== null && (
          <div className="absolute bottom-6 right-24">
            <div
              className={`rounded-md border px-3 py-2 font-mono text-sm font-bold ${
                round.state === 'cashed_out'
                  ? 'border-solstice-win bg-solstice-win/10 text-solstice-win'
                  : 'border-solstice-loss bg-solstice-loss/10 text-solstice-loss'
              }`}
            >
              {round.state === 'cashed_out' && round.payout !== null
                ? `+${formatAmountDisplay(round.payout - round.stake)} USDT`
                : `−${formatAmountDisplay(round.stake)} USDT`}
            </div>
          </div>
        )}
      </Felt>

      {/* Controls */}
      <div className="rounded-lg border border-solstice-border bg-solstice-card/40 p-4">
        {round === null || isFinished ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center">
              <ChipSelector
                disabled={busy}
                onPick={(d) => {
                  addChip(d);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border border-solstice-border bg-solstice-bg px-3 py-2 text-center font-mono text-sm text-solstice-fg">
                {formatAmountDisplay(betAmount)} USDT
              </div>
              <button
                type="button"
                onClick={clear}
                disabled={busy || betAmount === 0n}
                className="rounded-md border border-solstice-border bg-solstice-bg px-3 py-1 text-xs text-solstice-muted hover:text-solstice-loss disabled:opacity-30"
              >
                Clear
              </button>
            </div>
            <ActionButton
              label={isFinished ? 'New round' : busy ? 'Dealing...' : 'Deal'}
              variant="primary"
              {...(isFinished
                ? { onClick: reset }
                : betAmount > 0n && session !== null && !busy
                  ? {
                      onClick: () => {
                        void start();
                      },
                    }
                  : {})}
              disabled={busy || (betAmount === 0n && !isFinished) || session === null}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                {...(higherAvailable && !busy
                  ? {
                      onClick: () => {
                        void doPick('higher_or_equal');
                      },
                    }
                  : {})}
                disabled={busy || !higherAvailable}
                className={`rounded-full border px-4 py-3 text-sm font-bold transition disabled:opacity-30 ${
                  higherAvailable
                    ? 'border-solstice-accent bg-solstice-accent/10 text-solstice-accent hover:bg-solstice-accent/20'
                    : 'border-solstice-border bg-solstice-card text-solstice-muted'
                }`}
              >
                <div>↑ Higher{currentRank !== null && currentRank > 0 ? ' or Equal' : ''}</div>
                <div className="text-[10px] font-normal text-solstice-muted">
                  {higherAvailable
                    ? `${(higherProb * 100).toFixed(1)}% · ${higherMul.toFixed(2)}×`
                    : 'Not available'}
                </div>
              </button>
              <button
                type="button"
                {...(lowerAvailable && !busy
                  ? {
                      onClick: () => {
                        void doPick('lower_or_equal');
                      },
                    }
                  : {})}
                disabled={busy || !lowerAvailable}
                className={`rounded-full border px-4 py-3 text-sm font-bold transition disabled:opacity-30 ${
                  lowerAvailable
                    ? 'border-solstice-accent bg-solstice-accent/10 text-solstice-accent hover:bg-solstice-accent/20'
                    : 'border-solstice-border bg-solstice-card text-solstice-muted'
                }`}
              >
                <div>↓ Lower{currentRank !== null && currentRank < 12 ? ' or Equal' : ''}</div>
                <div className="text-[10px] font-normal text-solstice-muted">
                  {lowerAvailable
                    ? `${(lowerProb * 100).toFixed(1)}% · ${lowerMul.toFixed(2)}×`
                    : 'Not available'}
                </div>
              </button>
            </div>
            <ActionButton
              label={
                (round.picks.length ?? 0) === 0
                  ? 'Make a pick first'
                  : `Cash out ${round.currentMultiplier.toFixed(2)}×`
              }
              variant="success"
              {...((round.picks.length ?? 0) > 0 && !busy
                ? {
                    onClick: () => {
                      void doCashOut();
                    },
                  }
                : {})}
              disabled={busy || (round.picks.length ?? 0) === 0}
            />
          </div>
        )}
        {error !== null && <p className="mt-2 text-center text-xs text-solstice-loss">{error}</p>}
      </div>
    </div>
  );
}
