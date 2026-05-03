// apps/demo-web/src/components/UthGame.tsx

'use client';

import { useState } from 'react';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import {
  checkFlop,
  checkPreflop,
  fold,
  raise1x,
  raise2x,
  raise3x,
  raise4x,
  startCoup,
  type HandRankName,
  type UthCoup,
} from '@solsticebet/game-uth';
import type { UthCard } from '@solsticebet/rng';

import { useSession } from '@/lib/session-context';

const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
const SUIT_GLYPHS = ['♠', '♥', '♦', '♣'] as const;

function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? '?';
}

function suitGlyph(suit: number): string {
  return SUIT_GLYPHS[suit] ?? '?';
}

function isRedSuit(suit: number): boolean {
  return suit === 1 || suit === 2; // hearts, diamonds
}

function PlayingCard({
  card,
  faceDown = false,
  highlight = false,
  size = 'md',
}: {
  card: UthCard | null;
  faceDown?: boolean;
  highlight?: boolean;
  size?: 'md' | 'lg';
}) {
  const widthClass = size === 'lg' ? 'h-24 w-16' : 'h-20 w-14';
  const rankSize = size === 'lg' ? 'text-base' : 'text-sm';
  const suitSize = size === 'lg' ? 'text-3xl' : 'text-2xl';

  if (faceDown || card === null) {
    return (
      <div className="perspective-[800px]">
        <div
          className={`card-flip-in flex ${widthClass} items-center justify-center rounded-md border border-solstice-border bg-gradient-to-br from-solstice-accent-deep to-solstice-bg shadow-md`}
        >
          <div className="h-12 w-8 rounded border border-solstice-accent/40 bg-solstice-accent/10" />
        </div>
      </div>
    );
  }

  const red = isRedSuit(card.suit);
  return (
    <div className="perspective-[800px]">
      <div
        className={`card-flip-in flex ${widthClass} flex-col items-center justify-between rounded-md border bg-white p-1 text-black shadow-md ${
          highlight ? 'border-solstice-accent ring-2 ring-solstice-accent/50' : 'border-zinc-300'
        }`}
      >
        <div className={`${rankSize} font-bold ${red ? 'text-red-600' : 'text-zinc-900'}`}>
          {rankLabel(card.rank)}
        </div>
        <div className={`${suitSize} ${red ? 'text-red-600' : 'text-zinc-900'}`}>
          {suitGlyph(card.suit)}
        </div>
        <div
          className={`rotate-180 ${rankSize} font-bold ${red ? 'text-red-600' : 'text-zinc-900'}`}
        >
          {rankLabel(card.rank)}
        </div>
      </div>
    </div>
  );
}

function BetCircle({
  label,
  payRatio,
  amount,
  settlement,
  highlight = false,
}: {
  label: string;
  payRatio?: string;
  amount: bigint;
  settlement?: { state: 'win' | 'loss' | 'push'; payout: bigint } | null;
  highlight?: boolean;
}) {
  let stateClass = 'border-solstice-border bg-solstice-card/40';
  let labelColor = 'text-solstice-muted';
  if (settlement) {
    if (settlement.state === 'win') {
      stateClass = 'border-solstice-win bg-solstice-win/10';
      labelColor = 'text-solstice-win';
    } else if (settlement.state === 'push') {
      stateClass = 'border-yellow-500 bg-yellow-500/10';
      labelColor = 'text-yellow-300';
    } else {
      stateClass = 'border-solstice-loss/40 bg-solstice-loss/5';
      labelColor = 'text-solstice-loss';
    }
  } else if (highlight && amount > 0n) {
    stateClass = 'border-solstice-accent bg-solstice-accent/5';
    labelColor = 'text-solstice-accent';
  }

  return (
    <div className={`rounded-md border p-2 text-center ${stateClass}`}>
      <div className={`text-[10px] uppercase tracking-widest ${labelColor}`}>{label}</div>
      <div className="font-mono text-sm font-bold tabular-nums">
        {amount > 0n ? formatAmountDisplay(amount) : '—'}
      </div>
      {payRatio !== undefined && amount > 0n && (
        <div className="text-[9px] text-solstice-muted">{payRatio}</div>
      )}
      {settlement && settlement.state === 'win' && (
        <div className="mt-1 font-mono text-[10px] text-solstice-win">
          +{formatAmountDisplay(settlement.payout - amount)}
        </div>
      )}
      {settlement && settlement.state === 'push' && (
        <div className="mt-1 text-[10px] text-yellow-300">push</div>
      )}
      {settlement && settlement.state === 'loss' && amount > 0n && (
        <div className="mt-1 text-[10px] text-solstice-loss">−{formatAmountDisplay(amount)}</div>
      )}
    </div>
  );
}

const HAND_RANK_LABEL: Readonly<Record<HandRankName, string>> = {
  high_card: 'High card',
  pair: 'Pair',
  two_pair: 'Two pair',
  three_kind: 'Three of a kind',
  straight: 'Straight',
  flush: 'Flush',
  full_house: 'Full house',
  four_kind: 'Four of a kind',
  straight_flush: 'Straight flush',
  royal_flush: 'Royal flush',
};

export function UthGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [ante, setAnte] = useState('1');
  const [trips, setTrips] = useState('0');
  const [coup, setCoup] = useState<UthCoup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSettled = coup?.phase === 'settled';
  const phase = coup?.phase ?? 'idle';

  // Card layout — UTH RNG outputs:
  // [0,1] player hole; [2,3,4] flop; [5] turn; [6] river; [7,8] dealer hole
  const allCards = coup?.cards ?? [];
  const playerHole: readonly UthCard[] = allCards.slice(0, 2);
  const flop: readonly UthCard[] = allCards.slice(2, 5);
  const turn: UthCard | null = allCards[5] ?? null;
  const river: UthCard | null = allCards[6] ?? null;
  const dealerHole: readonly UthCard[] = allCards.slice(7, 9);

  // Visibility logic per phase
  const showFlop = phase === 'flop' || phase === 'river' || isSettled;
  const showTurnRiver = phase === 'river' || isSettled;
  const showDealer = isSettled;

  const startNew = async () => {
    if (session === null) return;
    setError(null);
    setBusy(true);
    try {
      const anteBig = parseAmount(ante);
      const tripsBig = parseAmount(trips);
      const num = bumpBetCount();
      const c = await startCoup(session.ledger, session.uthCoups, {
        coupId: `uth-${String(num)}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        ante: anteBig,
        trips: tripsBig,
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.uthNonce,
      });
      bumpNonce('uth');
      setCoup(c);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doAction = async (
    action:
      | 'raise_4x'
      | 'raise_3x'
      | 'check_preflop'
      | 'raise_2x'
      | 'check_flop'
      | 'raise_1x'
      | 'fold',
  ) => {
    if (session === null || coup === null) return;
    setError(null);
    setBusy(true);
    try {
      let updated: UthCoup;
      if (action === 'raise_4x') {
        updated = await raise4x(session.ledger, session.uthCoups, coup.coupId);
      } else if (action === 'raise_3x') {
        updated = await raise3x(session.ledger, session.uthCoups, coup.coupId);
      } else if (action === 'check_preflop') {
        updated = await checkPreflop(session.ledger, session.uthCoups, coup.coupId);
      } else if (action === 'raise_2x') {
        updated = await raise2x(session.ledger, session.uthCoups, coup.coupId);
      } else if (action === 'check_flop') {
        updated = await checkFlop(session.ledger, session.uthCoups, coup.coupId);
      } else if (action === 'raise_1x') {
        updated = await raise1x(session.ledger, session.uthCoups, coup.coupId);
      } else {
        updated = await fold(session.ledger, session.uthCoups, coup.coupId);
      }
      setCoup(updated);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setCoup(null);
    setError(null);
  };

  // Highlight cards that form the player's best hand at settle time
  const playerBestCards = isSettled ? (coup.playerHand?.cards ?? []) : [];
  const dealerBestCards = isSettled ? (coup.dealerHand?.cards ?? []) : [];
  const isPlayerBestCard = (card: UthCard): boolean =>
    playerBestCards.some((c) => c.rank === card.rank && c.suit === card.suit);
  const isDealerBestCard = (card: UthCard): boolean =>
    dealerBestCards.some((c) => c.rank === card.rank && c.suit === card.suit);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      {/* Table layout */}
      <div className="space-y-4 rounded-lg border border-solstice-border bg-solstice-bg/40 p-4">
        {coup === null ? (
          <p className="py-12 text-center text-sm text-solstice-muted">
            Set your Ante (Blind matches automatically) and optional Trips, then deal.
          </p>
        ) : (
          <>
            {/* Dealer hand */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
                  Dealer{' '}
                  {isSettled && coup.dealerHand && (
                    <span className="ml-2 font-bold text-solstice-fg">
                      {HAND_RANK_LABEL[coup.dealerHand.rank]}
                    </span>
                  )}
                </div>
                {isSettled && coup.dealerQualifies !== null && (
                  <span
                    className={`text-[10px] font-bold ${
                      coup.dealerQualifies === true ? 'text-solstice-fg' : 'text-yellow-300'
                    }`}
                  >
                    {coup.dealerQualifies === true ? 'qualifies' : 'does not qualify'}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {dealerHole.map((card, i) => (
                  <PlayingCard
                    key={i}
                    card={showDealer ? card : null}
                    faceDown={!showDealer}
                    highlight={isSettled && isDealerBestCard(card)}
                  />
                ))}
              </div>
            </div>

            {/* Community */}
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-widest text-solstice-muted">
                Community
              </div>
              <div className="flex gap-2">
                {flop.map((card, i) => (
                  <PlayingCard
                    key={`flop-${String(i)}`}
                    card={showFlop ? card : null}
                    faceDown={!showFlop}
                    highlight={isSettled && (isPlayerBestCard(card) || isDealerBestCard(card))}
                  />
                ))}
                <PlayingCard
                  card={showTurnRiver ? turn : null}
                  faceDown={!showTurnRiver}
                  highlight={
                    isSettled && turn !== null && (isPlayerBestCard(turn) || isDealerBestCard(turn))
                  }
                />
                <PlayingCard
                  card={showTurnRiver ? river : null}
                  faceDown={!showTurnRiver}
                  highlight={
                    isSettled &&
                    river !== null &&
                    (isPlayerBestCard(river) || isDealerBestCard(river))
                  }
                />
              </div>
            </div>

            {/* Player hand */}
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-widest text-solstice-muted">
                Player{' '}
                {isSettled && coup.playerHand && (
                  <span className="ml-2 font-bold text-solstice-fg">
                    {HAND_RANK_LABEL[coup.playerHand.rank]}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {playerHole.map((card, i) => (
                  <PlayingCard
                    key={i}
                    card={card}
                    highlight={isSettled && isPlayerBestCard(card)}
                  />
                ))}
              </div>
            </div>

            {/* Bet circles */}
            <div className="grid grid-cols-4 gap-2 border-t border-solstice-border pt-3">
              <BetCircle
                label="Ante"
                amount={coup.ante}
                settlement={
                  coup.anteSettlement
                    ? {
                        state: coup.anteSettlement.state as 'win' | 'loss' | 'push',
                        payout: coup.anteSettlement.payout,
                      }
                    : null
                }
              />
              <BetCircle
                label="Blind"
                payRatio="up to 500:1"
                amount={coup.blind}
                settlement={
                  coup.blindSettlement
                    ? {
                        state: coup.blindSettlement.state as 'win' | 'loss' | 'push',
                        payout: coup.blindSettlement.payout,
                      }
                    : null
                }
              />
              <BetCircle
                label="Play"
                amount={coup.play}
                highlight={phase === 'preflop' || phase === 'flop' || phase === 'river'}
                settlement={
                  coup.playSettlement
                    ? {
                        state: coup.playSettlement.state as 'win' | 'loss' | 'push',
                        payout: coup.playSettlement.payout,
                      }
                    : null
                }
              />
              <BetCircle
                label="Trips"
                payRatio="up to 50:1"
                amount={coup.trips}
                settlement={
                  coup.tripsSettlement && coup.trips > 0n
                    ? {
                        state: coup.tripsSettlement.state as 'win' | 'loss' | 'push',
                        payout: coup.tripsSettlement.payout,
                      }
                    : null
                }
              />
            </div>

            {isSettled && (
              <div className="rounded-md border border-solstice-border bg-solstice-card/40 p-3 text-center">
                <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
                  Round result
                </div>
                <div
                  className={`mt-1 font-mono text-lg font-bold ${
                    (coup.totalPayout ?? 0n) > coup.totalCommitted
                      ? 'text-solstice-win'
                      : (coup.totalPayout ?? 0n) === coup.totalCommitted
                        ? 'text-yellow-300'
                        : 'text-solstice-loss'
                  }`}
                >
                  Net {(coup.totalPayout ?? 0n) >= coup.totalCommitted ? '+' : ''}
                  {formatAmountDisplay((coup.totalPayout ?? 0n) - coup.totalCommitted)} USDT
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {coup === null || isSettled ? (
          <>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-solstice-muted">
                Ante (Blind matches)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={ante}
                onChange={(e) => {
                  setAnte(e.target.value);
                }}
                disabled={busy}
                className="w-full rounded-md border border-solstice-border bg-solstice-bg px-3 py-2 font-mono text-sm text-solstice-fg focus:border-solstice-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-solstice-muted">
                Trips (optional, 0 to skip)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={trips}
                onChange={(e) => {
                  setTrips(e.target.value);
                }}
                disabled={busy}
                className="w-full rounded-md border border-solstice-border bg-solstice-bg px-3 py-2 font-mono text-sm text-solstice-fg focus:border-solstice-accent focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={
                isSettled
                  ? reset
                  : () => {
                      void startNew();
                    }
              }
              disabled={busy || session === null}
              className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Dealing...' : isSettled ? 'New hand' : 'Deal'}
            </button>
          </>
        ) : (
          <>
            <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3 text-xs">
              <div className="text-solstice-muted">Phase</div>
              <div className="font-mono text-solstice-fg capitalize">{phase}</div>
            </div>

            {phase === 'preflop' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void doAction('raise_4x');
                  }}
                  disabled={busy}
                  className="w-full rounded-md border border-solstice-accent bg-solstice-accent/10 px-4 py-3 text-sm font-bold text-solstice-accent hover:bg-solstice-accent/20 disabled:opacity-50"
                >
                  Raise 4×
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void doAction('raise_3x');
                  }}
                  disabled={busy}
                  className="w-full rounded-md border border-solstice-accent/60 bg-solstice-accent/5 px-4 py-3 text-sm font-bold text-solstice-accent hover:bg-solstice-accent/10 disabled:opacity-50"
                >
                  Raise 3×
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void doAction('check_preflop');
                  }}
                  disabled={busy}
                  className="w-full rounded-md border border-solstice-border bg-solstice-card px-4 py-3 text-sm font-bold text-solstice-fg hover:border-solstice-accent disabled:opacity-50"
                >
                  Check
                </button>
              </>
            )}

            {phase === 'flop' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void doAction('raise_2x');
                  }}
                  disabled={busy}
                  className="w-full rounded-md border border-solstice-accent bg-solstice-accent/10 px-4 py-3 text-sm font-bold text-solstice-accent hover:bg-solstice-accent/20 disabled:opacity-50"
                >
                  Raise 2×
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void doAction('check_flop');
                  }}
                  disabled={busy}
                  className="w-full rounded-md border border-solstice-border bg-solstice-card px-4 py-3 text-sm font-bold text-solstice-fg hover:border-solstice-accent disabled:opacity-50"
                >
                  Check
                </button>
              </>
            )}

            {phase === 'river' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void doAction('raise_1x');
                  }}
                  disabled={busy}
                  className="w-full rounded-md border border-solstice-accent bg-solstice-accent/10 px-4 py-3 text-sm font-bold text-solstice-accent hover:bg-solstice-accent/20 disabled:opacity-50"
                >
                  Raise 1×
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void doAction('fold');
                  }}
                  disabled={busy}
                  className="w-full rounded-md border border-solstice-loss/40 bg-solstice-loss/5 px-4 py-3 text-sm font-bold text-solstice-loss hover:bg-solstice-loss/10 disabled:opacity-50"
                >
                  Fold
                </button>
              </>
            )}
          </>
        )}

        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}

        <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3 text-[11px] text-solstice-muted">
          <p className="mb-1 font-semibold text-solstice-fg">UTH at a glance</p>
          <p>
            Make the best 5-card poker hand from your 2 hole cards + 5 community cards. Beat the
            dealer to win Ante + Play. The Blind pays bonus on big hands. Dealer needs at least a
            pair to qualify.
          </p>
        </div>
      </div>
    </div>
  );
}
