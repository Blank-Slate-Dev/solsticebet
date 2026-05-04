// apps/demo-web/src/components/BaccaratGame.tsx
//
// Rainbet-style Baccarat: felt table with 3 bet circles (Player/Tie/Banker),
// chip-based betting, animated card deals from the deck.

'use client';

import { useState } from 'react';

import { formatAmountDisplay } from '@solsticebet/ledger';
import {
  PAYOUTS,
  placeBaccaratCoup,
  pointValueOf,
  type BaccaratBet,
  type BaccaratBetType,
  type BaccaratCoupOutcome,
} from '@solsticebet/game-baccarat';

import { useSession } from '@/lib/session-context';

import { ActionButton } from './casino/ActionButton';
import { CasinoCard } from './casino/CasinoCard';
import { type ChipDenom, ChipSelector, BetCircle, decomposeIntoChips } from './casino/Chips';
import { Deck } from './casino/Deck';
import { Felt } from './casino/Felt';

const DEAL_FROM_X = 320;
const DEAL_STAGGER_MS = 150;

/**
 * Removes the smallest chip from a bet circle's stack. Returns a new bets
 * object. If the circle has no chips, the bet object is returned unchanged.
 */
function removeTopChipFrom(
  bets: { player: bigint; banker: bigint; tie: bigint },
  circle: 'player' | 'banker' | 'tie',
): { player: bigint; banker: bigint; tie: bigint } {
  const current = bets[circle];
  if (current === 0n) return bets;
  const stack = decomposeIntoChips(current);
  const top = stack[stack.length - 1];
  if (top === undefined) return bets;
  return { ...bets, [circle]: current - top.value };
}

const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
function rankLabel(r: number): string {
  return RANK_LABELS[r] ?? '?';
}

interface CardWithPointProps {
  readonly rank: number;
  readonly delay: number;
  readonly fromY: number;
  readonly highlight?: boolean;
  readonly animKey: string;
}
function CardWithPoint({ rank, delay, fromY, highlight, animKey }: CardWithPointProps) {
  // Baccarat uses suit-less cards; render as monochrome with point indicator.
  return (
    <div className="flex flex-col items-center">
      <CasinoCard
        rank={rank}
        size="md"
        dealFromX={DEAL_FROM_X}
        dealFromY={fromY}
        delay={delay}
        animKey={animKey}
        highlight={highlight ?? false}
      />
      <div className="mt-1 text-[9px] uppercase tracking-widest text-solstice-muted">
        {rankLabel(rank)} · {pointValueOf(rank)}pt
      </div>
    </div>
  );
}

export function BaccaratGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  // Bet amounts per bet type:
  const [bets, setBets] = useState<{ player: bigint; banker: bigint; tie: bigint }>({
    player: 0n,
    banker: 0n,
    tie: 0n,
  });
  const [activeCircle, setActiveCircle] = useState<BaccaratBetType>('player');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<BaccaratCoupOutcome | null>(null);

  const totalBet = bets.player + bets.banker + bets.tie;

  const addChip = (denom: ChipDenom) => {
    setBets((prev) => ({
      ...prev,
      [activeCircle]: prev[activeCircle] + denom.value,
    }));
  };

  const clearAll = () => {
    setBets({ player: 0n, banker: 0n, tie: 0n });
  };

  const halve = () => {
    setBets((prev) => ({
      player: prev.player / 2n,
      banker: prev.banker / 2n,
      tie: prev.tie / 2n,
    }));
  };

  const dbl = () => {
    setBets((prev) => ({
      player: prev.player * 2n,
      banker: prev.banker * 2n,
      tie: prev.tie * 2n,
    }));
  };

  const deal = async () => {
    if (session === null || totalBet === 0n) return;
    setError(null);
    setBusy(true);
    try {
      const apiBets: BaccaratBet[] = [];
      if (bets.player > 0n) apiBets.push({ type: 'player', stake: bets.player });
      if (bets.banker > 0n) apiBets.push({ type: 'banker', stake: bets.banker });
      if (bets.tie > 0n) apiBets.push({ type: 'tie', stake: bets.tie });
      const num = bumpBetCount();
      const out = await placeBaccaratCoup(session.ledger, {
        coupId: `baccarat-${String(num)}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        bets: apiBets,
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.baccaratNonce,
      });
      bumpNonce('baccarat');
      setLast(out);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setLast(null);
    setBets({ player: 0n, banker: 0n, tie: 0n });
    setError(null);
  };

  const winner = last?.deal.winner ?? null;
  const playerCards = last?.deal.player.cards ?? [];
  const bankerCards = last?.deal.banker.cards ?? [];

  return (
    <div className="space-y-4">
      <Felt
        tagline="BANKER 0.95:1 · PLAYER 1:1 · TIE 8:1"
        {...(last !== null && winner !== null
          ? { subTagline: `${winner.toUpperCase()} WINS` }
          : {})}
      >
        {/* Deck on the right */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2">
          <Deck size="md" />
        </div>

        {/* Banker (top center) */}
        <div className="absolute left-0 right-0 top-6 flex flex-col items-center">
          <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
            Banker {last !== null && `· ${last.deal.banker.total}`}
          </div>
          <div className="mt-1 flex gap-1">
            {bankerCards.map((rank, i) => (
              <CardWithPoint
                key={`b-${String(last?.coupId ?? '')}-${String(i)}`}
                rank={rank}
                delay={i * DEAL_STAGGER_MS + DEAL_STAGGER_MS / 2}
                fromY={-40}
                highlight={winner === 'banker'}
                animKey={`b-${String(last?.coupId ?? '')}-${String(i)}`}
              />
            ))}
          </div>
        </div>

        {/* Player (bottom center, above bet circles) */}
        <div className="absolute bottom-32 left-0 right-0 flex flex-col items-center">
          <div className="mt-1 flex gap-1">
            {playerCards.map((rank, i) => (
              <CardWithPoint
                key={`p-${String(last?.coupId ?? '')}-${String(i)}`}
                rank={rank}
                delay={i * DEAL_STAGGER_MS}
                fromY={-100}
                highlight={winner === 'player'}
                animKey={`p-${String(last?.coupId ?? '')}-${String(i)}`}
              />
            ))}
          </div>
          {last !== null && (
            <div className="mt-1 text-[10px] uppercase tracking-widest text-solstice-muted">
              Player · {last.deal.player.total}
            </div>
          )}
        </div>

        {/* Bet circles row (very bottom of felt) */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-6">
          <BetCircle
            label="Player 1:1"
            amount={bets.player}
            highlight={activeCircle === 'player' && last === null}
            disabled={last !== null}
            {...(last === null
              ? {
                  onClick: () => {
                    setActiveCircle('player');
                  },
                  onRemoveChip: () => {
                    setBets((prev) => removeTopChipFrom(prev, 'player'));
                  },
                }
              : {})}
          />
          <BetCircle
            label="Tie 8:1"
            amount={bets.tie}
            highlight={activeCircle === 'tie' && last === null}
            disabled={last !== null}
            {...(last === null
              ? {
                  onClick: () => {
                    setActiveCircle('tie');
                  },
                  onRemoveChip: () => {
                    setBets((prev) => removeTopChipFrom(prev, 'tie'));
                  },
                }
              : {})}
          />
          <BetCircle
            label={`Banker ${PAYOUTS.banker}:1`}
            amount={bets.banker}
            highlight={activeCircle === 'banker' && last === null}
            disabled={last !== null}
            {...(last === null
              ? {
                  onClick: () => {
                    setActiveCircle('banker');
                  },
                  onRemoveChip: () => {
                    setBets((prev) => removeTopChipFrom(prev, 'banker'));
                  },
                }
              : {})}
          />
        </div>

        {last !== null && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <div
              className={`rounded-md border px-3 py-1 font-mono text-sm font-bold ${
                last.totalPayout > last.totalStake
                  ? 'border-solstice-win bg-solstice-win/10 text-solstice-win'
                  : last.totalPayout === last.totalStake
                    ? 'border-yellow-500 bg-yellow-500/10 text-yellow-300'
                    : 'border-solstice-loss bg-solstice-loss/10 text-solstice-loss'
              }`}
            >
              {last.totalPayout >= last.totalStake ? '+' : ''}
              {formatAmountDisplay(last.totalPayout - last.totalStake)} USDT
            </div>
          </div>
        )}
      </Felt>

      {/* Bottom controls */}
      <div className="rounded-lg border border-solstice-border bg-solstice-card/40 p-4">
        {last === null ? (
          <div className="space-y-3">
            <div className="text-center text-[10px] uppercase tracking-widest text-solstice-muted">
              Tap a bet circle, then click chips to add
            </div>
            <div className="flex items-center justify-center">
              <ChipSelector
                disabled={busy}
                onPick={(d) => {
                  addChip(d);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={halve}
                disabled={busy || totalBet === 0n}
                className="rounded-md border border-solstice-border bg-solstice-bg px-3 py-1 text-xs text-solstice-muted hover:text-solstice-fg disabled:opacity-30"
              >
                ½
              </button>
              <button
                type="button"
                onClick={dbl}
                disabled={busy || totalBet === 0n}
                className="rounded-md border border-solstice-border bg-solstice-bg px-3 py-1 text-xs text-solstice-muted hover:text-solstice-fg disabled:opacity-30"
              >
                2×
              </button>
              <div className="flex-1 rounded-md border border-solstice-border bg-solstice-bg px-3 py-2 text-center font-mono text-sm text-solstice-fg">
                Total: {formatAmountDisplay(totalBet)} USDT
              </div>
              <button
                type="button"
                onClick={clearAll}
                disabled={busy || totalBet === 0n}
                className="rounded-md border border-solstice-border bg-solstice-bg px-3 py-1 text-xs text-solstice-muted hover:text-solstice-loss disabled:opacity-30"
              >
                Clear
              </button>
            </div>
            <ActionButton
              label={busy ? 'Dealing...' : 'Deal'}
              variant="primary"
              {...(totalBet > 0n && !busy && session !== null
                ? {
                    onClick: () => {
                      void deal();
                    },
                  }
                : {})}
              disabled={busy || totalBet === 0n || session === null}
            />
          </div>
        ) : (
          <ActionButton label="New hand" variant="primary" onClick={reset} />
        )}
        {error !== null && <p className="mt-2 text-center text-xs text-solstice-loss">{error}</p>}
      </div>
    </div>
  );
}
