// apps/demo-web/src/components/BlackjackGame.tsx
//
// Rainbet-style Blackjack: felt table, deck on the right, chip-based betting,
// proper bet circles, animated card slides from the deck.

'use client';

import { useState } from 'react';

import { formatAmountDisplay } from '@solsticebet/ledger';
import {
  canSplit,
  doubleDown,
  handTotal,
  hit,
  isBlackjack as cardsIsBlackjack,
  split,
  stand,
  startRound,
  type BlackjackHand,
  type BlackjackRound,
} from '@solsticebet/game-blackjack';

import { useSession } from '@/lib/session-context';

import { ActionButton } from './casino/ActionButton';
import { CasinoCard } from './casino/CasinoCard';
import { type ChipDenom, ChipSelector, BetCircle } from './casino/Chips';
import { Deck } from './casino/Deck';
import { Felt } from './casino/Felt';

// Cards "fly in" from approximately the deck position. The deck sits on the
// right side of the felt; cards land roughly center-bottom (player) or
// center-top (dealer). These offsets are visually-tuned approximations.
const DEAL_FROM_X = 320;
const DEAL_FROM_Y_PLAYER = -120;
const DEAL_FROM_Y_DEALER = -40;
const DEAL_STAGGER_MS = 180;

interface HandViewProps {
  readonly hand: BlackjackHand;
  readonly isActive: boolean;
  readonly handIndex: number;
  readonly roundId: string;
}

function HandView({ hand, isActive, handIndex, roundId }: HandViewProps) {
  const t = handTotal(hand.cards);
  let label = '';
  let labelColor = 'text-solstice-muted';
  if (hand.settle === 'win' || hand.settle === 'win_blackjack') {
    label = hand.settle === 'win_blackjack' ? 'BLACKJACK' : 'WIN';
    labelColor = 'text-solstice-win';
  } else if (hand.settle === 'push') {
    label = 'PUSH';
    labelColor = 'text-yellow-300';
  } else if (hand.settle === 'loss') {
    label = t.isBust ? 'BUST' : 'LOSS';
    labelColor = 'text-solstice-loss';
  } else if (hand.state === 'busted') {
    label = 'BUST';
    labelColor = 'text-solstice-loss';
  } else if (hand.state === 'blackjack') {
    label = 'BLACKJACK';
    labelColor = 'text-solstice-win';
  } else if (hand.state === 'doubled') {
    label = 'DOUBLED';
    labelColor = 'text-solstice-accent';
  } else if (hand.state === 'split_ace') {
    label = '21!';
    labelColor = 'text-solstice-accent';
  } else if (hand.state === 'stood') {
    label = 'STAND';
  }

  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 ${
        isActive
          ? 'border-solstice-accent bg-solstice-accent/10 ring-2 ring-solstice-accent/30'
          : 'border-transparent'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-lg font-bold tabular-nums text-solstice-fg">
          {t.isBust ? `${t.total}!` : t.isSoft ? `${t.total}` : t.total}
        </span>
        {label !== '' && (
          <span className={`text-[10px] font-bold uppercase tracking-widest ${labelColor}`}>
            {label}
          </span>
        )}
      </div>
      <div className="flex gap-1">
        {hand.cards.map((rank, i) => (
          <CasinoCard
            key={`${roundId}-h${String(handIndex)}-c${String(i)}`}
            rank={rank}
            size="md"
            highlight={isActive && i === hand.cards.length - 1}
            dealFromX={DEAL_FROM_X}
            dealFromY={DEAL_FROM_Y_PLAYER}
            delay={i * DEAL_STAGGER_MS}
            animKey={`${roundId}-h${String(handIndex)}-c${String(i)}`}
          />
        ))}
      </div>
      {hand.payout !== null && hand.payout > 0n && (
        <div className="font-mono text-xs text-solstice-win">
          +{formatAmountDisplay(hand.payout)} USDT
        </div>
      )}
    </div>
  );
}

export function BlackjackGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [betAmount, setBetAmount] = useState<bigint>(0n);
  const [round, setRound] = useState<BlackjackRound | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSettled = round?.state === 'settled';
  const activeHand =
    round !== null && !isSettled ? (round.playerHands[round.activeHandIndex] ?? null) : null;

  const canHit = activeHand?.state === 'active';
  const canStand = activeHand?.state === 'active';
  const canDouble = activeHand?.state === 'active' && activeHand.cards.length === 2;
  const canDoSplit =
    activeHand?.state === 'active' &&
    activeHand.cards.length === 2 &&
    canSplit(activeHand.cards) &&
    (round?.playerHands.length ?? 4) < 4;

  const dealerCards = round?.dealer.cards ?? [];
  const dealerFinal = round?.dealer.final ?? false;

  const addChip = (denom: ChipDenom) => {
    setBetAmount((prev) => prev + denom.value);
  };

  const clearBet = () => {
    setBetAmount(0n);
  };

  const halveBet = () => {
    setBetAmount((prev) => prev / 2n);
  };

  const doubleBet = () => {
    setBetAmount((prev) => prev * 2n);
  };

  const startNew = async () => {
    if (session === null || betAmount === 0n) return;
    setError(null);
    setBusy(true);
    try {
      const num = bumpBetCount();
      const r = await startRound(session.ledger, session.blackjackRounds, {
        roundId: `blackjack-${String(num)}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        stake: betAmount,
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.blackjackNonce,
      });
      bumpNonce('blackjack');
      setRound(r);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doAction = async (action: 'hit' | 'stand' | 'double' | 'split') => {
    if (session === null || round === null) return;
    setError(null);
    setBusy(true);
    try {
      let r: BlackjackRound;
      if (action === 'hit') {
        r = await hit(session.ledger, session.blackjackRounds, round.roundId);
      } else if (action === 'stand') {
        r = await stand(session.ledger, session.blackjackRounds, round.roundId);
      } else if (action === 'double') {
        r = await doubleDown(session.ledger, session.blackjackRounds, round.roundId);
      } else {
        r = await split(session.ledger, session.blackjackRounds, round.roundId);
      }
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

  // Dealer total / blackjack labels
  const dealerTotal = handTotal(dealerCards);
  const dealerHasBJ =
    isSettled && round?.dealer.cards.length === 2 && cardsIsBlackjack(round.dealer.cards);
  const dealerLabel = isSettled
    ? dealerHasBJ
      ? 'BLACKJACK'
      : dealerTotal.isBust
        ? 'BUST'
        : dealerTotal.total >= 17
          ? 'STAND'
          : ''
    : '';

  return (
    <div className="space-y-4">
      {/* Felt table */}
      <Felt
        tagline="BLACKJACK PAYS 3 TO 2"
        {...(isSettled ? {} : { subTagline: 'DEALER STANDS ON SOFT 17 — H17' })}
      >
        {/* Deck on the right side */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2">
          <Deck size="md" />
        </div>

        {/* Dealer area (top center) */}
        <div className="absolute left-0 right-0 top-8 flex flex-col items-center">
          <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
            Dealer
            {dealerLabel !== '' && (
              <span
                className={`ml-2 font-bold ${
                  dealerHasBJ === true || dealerTotal.total >= 17
                    ? 'text-solstice-fg'
                    : 'text-solstice-loss'
                }`}
              >
                {dealerLabel}
              </span>
            )}
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-solstice-fg">
            {dealerCards.length === 0 ? '—' : dealerFinal ? dealerTotal.total : '?'}
          </div>
          <div className="mt-1 flex gap-1">
            {dealerCards.map((rank, i) => {
              // Hide the second dealer card until settled.
              const isHole = i === 1 && !dealerFinal;
              return (
                <CasinoCard
                  key={`dealer-${String(round?.roundId ?? 'none')}-${String(i)}`}
                  rank={rank}
                  faceDown={isHole}
                  size="md"
                  dealFromX={DEAL_FROM_X}
                  dealFromY={DEAL_FROM_Y_DEALER}
                  delay={i * DEAL_STAGGER_MS + DEAL_STAGGER_MS / 2}
                  animKey={`dealer-${String(round?.roundId ?? 'none')}-${String(i)}-${String(dealerFinal)}`}
                />
              );
            })}
          </div>
        </div>

        {/* Player area (bottom center) */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          {round !== null ? (
            <div className="flex gap-3">
              {round.playerHands.map((hand, i) => (
                <HandView
                  key={i}
                  hand={hand}
                  isActive={!isSettled && i === round.activeHandIndex}
                  handIndex={i}
                  roundId={round.roundId}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <BetCircle
                label="Perfect Pair"
                amount={0n}
                disabled
                tooltip="Side bet — coming soon"
                size="sm"
              />
              <BetCircle label="Main bet" amount={betAmount} highlight={betAmount > 0n} />
              <BetCircle
                label="21+3"
                amount={0n}
                disabled
                tooltip="Side bet — coming soon"
                size="sm"
              />
            </div>
          )}
        </div>

        {/* Settled summary */}
        {isSettled && round !== null && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <div
              className={`rounded-md border px-3 py-1 font-mono text-sm font-bold ${
                (round.totalPayout ?? 0n) > round.totalCommitted
                  ? 'border-solstice-win bg-solstice-win/10 text-solstice-win'
                  : (round.totalPayout ?? 0n) === round.totalCommitted
                    ? 'border-yellow-500 bg-yellow-500/10 text-yellow-300'
                    : 'border-solstice-loss bg-solstice-loss/10 text-solstice-loss'
              }`}
            >
              {(round.totalPayout ?? 0n) >= round.totalCommitted ? '+' : ''}
              {formatAmountDisplay((round.totalPayout ?? 0n) - round.totalCommitted)} USDT
            </div>
          </div>
        )}
      </Felt>

      {/* Bottom controls strip */}
      <div className="rounded-lg border border-solstice-border bg-solstice-card/40 p-4">
        {round === null || isSettled ? (
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
              <button
                type="button"
                onClick={halveBet}
                disabled={busy || betAmount === 0n}
                className="rounded-md border border-solstice-border bg-solstice-bg px-3 py-1 text-xs text-solstice-muted hover:text-solstice-fg disabled:opacity-30"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={busy || betAmount === 0n}
                className="rounded-md border border-solstice-border bg-solstice-bg px-3 py-1 text-xs text-solstice-muted hover:text-solstice-fg disabled:opacity-30"
              >
                2×
              </button>
              <div className="flex-1 rounded-md border border-solstice-border bg-solstice-bg px-3 py-2 text-center font-mono text-sm text-solstice-fg">
                {formatAmountDisplay(betAmount)} USDT
              </div>
              <button
                type="button"
                onClick={clearBet}
                disabled={busy || betAmount === 0n}
                className="rounded-md border border-solstice-border bg-solstice-bg px-3 py-1 text-xs text-solstice-muted hover:text-solstice-loss disabled:opacity-30"
              >
                Clear
              </button>
            </div>
            <div className="flex gap-2">
              <ActionButton
                label={isSettled ? 'Play again' : busy ? 'Dealing...' : 'Deal'}
                variant="primary"
                onClick={
                  isSettled
                    ? reset
                    : () => {
                        void startNew();
                      }
                }
                disabled={busy || (betAmount === 0n && !isSettled) || session === null}
              />
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <ActionButton
              icon="✋"
              label="Stand"
              {...(canStand
                ? {
                    onClick: () => {
                      void doAction('stand');
                    },
                  }
                : {})}
              disabled={!canStand || busy}
            />
            <ActionButton
              icon="🃏"
              label="Hit"
              {...(canHit
                ? {
                    onClick: () => {
                      void doAction('hit');
                    },
                  }
                : {})}
              disabled={!canHit || busy}
            />
            <ActionButton
              icon="×2"
              label="Double"
              variant="warning"
              {...(canDouble
                ? {
                    onClick: () => {
                      void doAction('double');
                    },
                  }
                : {})}
              disabled={!canDouble || busy}
            />
            <ActionButton
              icon="✂️"
              label="Split"
              {...(canDoSplit
                ? {
                    onClick: () => {
                      void doAction('split');
                    },
                  }
                : {})}
              disabled={!canDoSplit || busy}
            />
          </div>
        )}
        {error !== null && <p className="mt-2 text-center text-xs text-solstice-loss">{error}</p>}
      </div>
    </div>
  );
}
