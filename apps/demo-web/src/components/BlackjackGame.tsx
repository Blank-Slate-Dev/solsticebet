// apps/demo-web/src/components/BlackjackGame.tsx

'use client';

import { useState } from 'react';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import {
  canSplit,
  cardValue,
  doubleDown,
  handTotal,
  hit,
  isAce,
  split,
  stand,
  startRound,
  type BlackjackHand,
  type BlackjackHandSettle,
  type BlackjackRound,
} from '@solsticebet/game-blackjack';

import { useSession } from '@/lib/session-context';

const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

function cardLabel(rank: number): string {
  return RANK_LABELS[rank] ?? '?';
}

interface CardProps {
  readonly rank: number | null;
  readonly faceDown?: boolean;
  readonly highlight?: boolean;
}

function Card({ rank, faceDown = false, highlight = false }: CardProps) {
  if (faceDown || rank === null) {
    return (
      <div className="flex h-20 w-14 items-center justify-center rounded-md border border-solstice-border bg-gradient-to-br from-solstice-accent-deep to-solstice-bg shadow-md">
        <div className="h-12 w-8 rounded border border-solstice-accent/40 bg-solstice-accent/10" />
      </div>
    );
  }
  const isRed = false; // We don't track suit, just rank — keep cards monochrome
  return (
    <div
      className={`flex h-20 w-14 flex-col items-center justify-between rounded-md border bg-white p-1 text-black shadow-md transition ${
        highlight ? 'border-solstice-accent ring-2 ring-solstice-accent/50' : 'border-zinc-300'
      }`}
    >
      <div className={`text-sm font-bold ${isRed ? 'text-red-600' : 'text-zinc-900'}`}>
        {cardLabel(rank)}
      </div>
      <div className="text-3xl">
        {isAce(rank) ? '♠' : cardValue(rank) === 10 && rank > 8 ? '♣' : '♦'}
      </div>
      <div className={`rotate-180 text-sm font-bold ${isRed ? 'text-red-600' : 'text-zinc-900'}`}>
        {cardLabel(rank)}
      </div>
    </div>
  );
}

function Hand({
  cards,
  total,
  isBust,
  isSoft,
  state,
  isActive,
  settle,
  payout,
  stake,
  faceDownIndex,
}: {
  cards: readonly number[];
  total: number;
  isBust: boolean;
  isSoft: boolean;
  state: BlackjackHand['state'] | 'dealer';
  isActive: boolean;
  settle?: BlackjackHandSettle | null;
  payout?: bigint | null;
  stake?: bigint;
  /** If set, this card index is rendered face-down. */
  faceDownIndex?: number;
}) {
  let label = '';
  let labelColor = 'text-solstice-muted';
  if (settle === 'win' || settle === 'win_blackjack') {
    label = settle === 'win_blackjack' ? 'BLACKJACK!' : 'WIN';
    labelColor = 'text-solstice-win';
  } else if (settle === 'push') {
    label = 'PUSH';
    labelColor = 'text-yellow-300';
  } else if (settle === 'loss') {
    label = isBust ? 'BUST' : 'LOSS';
    labelColor = 'text-solstice-loss';
  } else if (state === 'busted') {
    label = 'BUST';
    labelColor = 'text-solstice-loss';
  } else if (state === 'blackjack') {
    label = 'BLACKJACK';
    labelColor = 'text-solstice-win';
  } else if (state === 'doubled') {
    label = 'DOUBLED';
    labelColor = 'text-solstice-accent';
  } else if (state === 'split_ace') {
    label = 'SPLIT-ACE';
    labelColor = 'text-solstice-muted';
  } else if (state === 'stood') {
    label = 'STAND';
    labelColor = 'text-solstice-muted';
  }

  return (
    <div
      className={`rounded-md border p-3 ${
        isActive
          ? 'border-solstice-accent bg-solstice-accent/5'
          : 'border-solstice-border bg-solstice-card/40'
      }`}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xl font-bold tabular-nums">
            {isBust ? `${total} (bust)` : isSoft ? `${total} (soft)` : total}
          </span>
          {label !== '' && <span className={`text-xs font-bold ${labelColor}`}>{label}</span>}
        </div>
        {stake !== undefined && (
          <span className="font-mono text-xs text-solstice-muted">
            {formatAmountDisplay(stake)} USDT
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {cards.map((rank, i) => (
          <Card
            key={i}
            rank={rank}
            faceDown={faceDownIndex !== undefined && i === faceDownIndex}
            highlight={isActive && i === cards.length - 1}
          />
        ))}
      </div>
      {payout !== null && payout !== undefined && payout > 0n && (
        <div className="mt-2 text-right text-xs">
          <span className="text-solstice-muted">Payout: </span>
          <span className="font-mono text-solstice-win">+{formatAmountDisplay(payout)} USDT</span>
        </div>
      )}
    </div>
  );
}

export function BlackjackGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [stake, setStake] = useState('10');
  const [round, setRound] = useState<BlackjackRound | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startNew = async () => {
    if (session === null) return;
    setError(null);
    setBusy(true);
    try {
      const stakeBig = parseAmount(stake);
      const num = bumpBetCount();
      const r = await startRound(session.ledger, session.blackjackRounds, {
        roundId: `blackjack-${String(num)}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        stake: stakeBig,
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

  const isSettled = round?.state === 'settled';
  const activeHand =
    round !== null && !isSettled ? (round.playerHands[round.activeHandIndex] ?? null) : null;

  // Action button availability
  const canHit = activeHand?.state === 'active';
  const canStand = activeHand?.state === 'active';
  const canDouble = activeHand?.state === 'active' && activeHand.cards.length === 2;
  const canDoSplit =
    activeHand?.state === 'active' &&
    activeHand.cards.length === 2 &&
    canSplit(activeHand.cards) &&
    (round?.playerHands.length ?? 4) < 4;

  // Compute dealer total and visible state
  const dealerCards = round?.dealer.cards ?? [];
  const dealerFinal = round?.dealer.final ?? false;
  const dealerVisibleCards = dealerFinal ? dealerCards : dealerCards.slice(0, 1);
  const dealerVisibleTotal = dealerFinal
    ? handTotal(dealerCards)
    : dealerVisibleCards.length > 0
      ? handTotal(dealerVisibleCards)
      : { total: 0, isSoft: false, isBust: false };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="space-y-4 rounded-lg border border-solstice-border bg-solstice-bg/40 p-6">
        {round === null ? (
          <p className="py-12 text-center text-sm text-solstice-muted">
            Place a stake on the right and click Deal to start a round.
          </p>
        ) : (
          <>
            {/* Dealer section */}
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-widest text-solstice-muted">
                Dealer{' '}
                {dealerFinal &&
                  `· total ${dealerVisibleTotal.total}${dealerVisibleTotal.isBust ? ' (bust)' : ''}`}
                {!dealerFinal && dealerCards.length > 0 && ` · showing ${dealerVisibleTotal.total}`}
              </div>
              <Hand
                cards={dealerCards}
                total={dealerVisibleTotal.total}
                isBust={dealerFinal && dealerVisibleTotal.isBust}
                isSoft={dealerVisibleTotal.isSoft}
                state="dealer"
                isActive={false}
                {...(!dealerFinal ? { faceDownIndex: 1 } : {})}
              />
            </div>

            {/* Player hands */}
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-widest text-solstice-muted">
                Player {round.playerHands.length > 1 ? `· ${round.playerHands.length} hands` : ''}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {round.playerHands.map((h, i) => {
                  const t = handTotal(h.cards);
                  return (
                    <Hand
                      key={i}
                      cards={h.cards}
                      total={t.total}
                      isBust={t.isBust}
                      isSoft={t.isSoft}
                      state={h.state}
                      isActive={!isSettled && i === round.activeHandIndex}
                      settle={h.settle}
                      payout={h.payout}
                      stake={h.stake}
                    />
                  );
                })}
              </div>
            </div>

            {/* Round summary on settle */}
            {isSettled && (
              <div className="rounded-md border border-solstice-border bg-solstice-card/40 p-3 text-center">
                <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
                  Round result
                </div>
                <div
                  className={`mt-1 font-mono text-lg font-bold ${
                    (round.totalPayout ?? 0n) > round.totalCommitted
                      ? 'text-solstice-win'
                      : (round.totalPayout ?? 0n) === round.totalCommitted
                        ? 'text-yellow-300'
                        : 'text-solstice-loss'
                  }`}
                >
                  Net {(round.totalPayout ?? 0n) >= round.totalCommitted ? '+' : ''}
                  {formatAmountDisplay((round.totalPayout ?? 0n) - round.totalCommitted)} USDT
                </div>
                <div className="mt-1 text-xs text-solstice-muted">
                  Staked {formatAmountDisplay(round.totalCommitted)} · Returned{' '}
                  {formatAmountDisplay(round.totalPayout ?? 0n)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="space-y-4">
        {round === null || isSettled ? (
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
            <button
              type="button"
              onClick={() => {
                void startNew();
              }}
              disabled={busy || session === null}
              className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Dealing...' : isSettled ? 'Deal again' : `Deal (${stake} USDT)`}
            </button>
          </>
        ) : (
          <>
            <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3 text-xs">
              <div className="text-solstice-muted">Hand</div>
              <div className="font-mono text-solstice-fg">
                {round.activeHandIndex + 1} of {round.playerHands.length}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void doAction('hit');
              }}
              disabled={busy || !canHit}
              className="w-full rounded-md border border-solstice-accent bg-solstice-accent/10 px-4 py-3 text-sm font-bold text-solstice-accent hover:bg-solstice-accent/20 disabled:opacity-30"
            >
              Hit
            </button>
            <button
              type="button"
              onClick={() => {
                void doAction('stand');
              }}
              disabled={busy || !canStand}
              className="w-full rounded-md border border-solstice-border bg-solstice-card px-4 py-3 text-sm font-bold text-solstice-fg hover:border-solstice-accent disabled:opacity-30"
            >
              Stand
            </button>
            <button
              type="button"
              onClick={() => {
                void doAction('double');
              }}
              disabled={busy || !canDouble}
              className="w-full rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm font-bold text-yellow-200 hover:bg-yellow-500/20 disabled:opacity-30"
            >
              Double
            </button>
            <button
              type="button"
              onClick={() => {
                void doAction('split');
              }}
              disabled={busy || !canDoSplit}
              className="w-full rounded-md border border-purple-500/40 bg-purple-500/10 px-4 py-3 text-sm font-bold text-purple-200 hover:bg-purple-500/20 disabled:opacity-30"
            >
              Split
            </button>
          </>
        )}
        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}
      </div>
    </div>
  );
}
