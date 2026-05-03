// packages/games/blackjack/src/engine.ts
//
// Blackjack game engine. State machine driven by player actions.
//
// See docs/BLACKJACK.md § 3.

import {
  type LedgerRepository,
  recordBetLoss,
  recordBetPartialPayout,
  recordBetRefund,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { deriveBlackjack } from '@solsticebet/rng';

import { canSplit, handTotal, isAce, isBlackjack as cardsIsBlackjack } from './cards.js';
import { playDealer } from './dealer.js';
import {
  assertValidStartInput,
  BlackjackValidationError,
  MAX_HANDS,
  MAX_PAYOUT,
} from './limits.js';
import { computeWinPayout } from './math.js';
import { RoundNotFoundError, type BlackjackRoundRepository } from './repository.js';
import type {
  BlackjackHand,
  BlackjackHandSettle,
  BlackjackHandState,
  BlackjackRound,
  StartBlackjackRoundInput,
} from './types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Mutates a hand state to reflect its current condition (active vs busted vs natural blackjack).
 * Blackjack only counts on a 2-card hand that wasn't created by a split.
 */
function evaluateHandState(cards: readonly number[], isInitialDeal: boolean): BlackjackHandState {
  const t = handTotal(cards);
  if (t.isBust) return 'busted';
  if (isInitialDeal && cardsIsBlackjack(cards)) return 'blackjack';
  return 'active';
}

function drawCard(round: BlackjackRound): { card: number; nextCursor: number } {
  const card = round.deck[round.deckCursor];
  /* v8 ignore next 3 -- defensive; deck pre-derived to 32 cards exceeds any realistic round usage */
  if (card === undefined) {
    throw new RangeError('blackjack ran out of cards in the shoe');
  }
  return { card, nextCursor: round.deckCursor + 1 };
}

function findNextActiveHandIndex(hands: readonly BlackjackHand[], fromIndex: number): number {
  for (let i = fromIndex; i < hands.length; i++) {
    if (hands[i]?.state === 'active') return i;
  }
  return -1; // no more active hands → dealer phase
}

// ─── Settlement ───────────────────────────────────────────────────────────

/**
 * Runs the dealer phase and settles every player hand. Writes the appropriate
 * ledger entry (win/refund/partial/loss) based on net round outcome. Updates
 * round state to 'settled' and returns it.
 */
async function settleRound(
  ledger: LedgerRepository,
  round: BlackjackRound,
): Promise<BlackjackRound> {
  // Decide whether dealer needs to play. If every hand busted or we're already
  // settled, dealer's hidden card is revealed but dealer doesn't draw.
  const someoneNeedsDealer = round.playerHands.some((h) => h.state !== 'busted');

  let dealerCards: readonly number[] = round.dealer.cards;
  let cursor = round.deckCursor;
  if (someoneNeedsDealer) {
    const result = playDealer(round.dealer.cards, round.deck, cursor);
    dealerCards = result.cards;
    cursor = result.cursor;
  }

  const dealerTotal = handTotal(dealerCards);
  const dealerHasBlackjack =
    round.dealer.cards.length === 2 && cardsIsBlackjack(round.dealer.cards);

  // Settle each hand
  const settledHands: BlackjackHand[] = round.playerHands.map((hand) => {
    let settle: BlackjackHandSettle;
    let payout: bigint;

    const playerTotal = handTotal(hand.cards);
    const playerBlackjack = hand.state === 'blackjack';

    if (hand.state === 'busted') {
      settle = 'loss';
      payout = 0n;
    } else if (playerBlackjack && dealerHasBlackjack) {
      settle = 'push';
      payout = hand.stake;
    } else if (playerBlackjack) {
      settle = 'win_blackjack';
      payout = computeWinPayout(hand.stake, true);
    } else if (dealerHasBlackjack) {
      settle = 'loss';
      payout = 0n;
    } else if (dealerTotal.isBust) {
      settle = 'win';
      payout = computeWinPayout(hand.stake, false);
    } else if (playerTotal.total > dealerTotal.total) {
      settle = 'win';
      payout = computeWinPayout(hand.stake, false);
    } else if (playerTotal.total < dealerTotal.total) {
      settle = 'loss';
      payout = 0n;
    } else {
      settle = 'push';
      payout = hand.stake;
    }

    return { ...hand, settle, payout };
  });

  const totalPayout = settledHands.reduce((sum, h) => sum + (h.payout ?? 0n), 0n);

  /* v8 ignore next 5 -- defence in depth */
  if (totalPayout > MAX_PAYOUT) {
    throw new BlackjackValidationError(`round payout ${totalPayout.toString()} exceeds MAX_PAYOUT`);
  }

  const settleMetadata = {
    ...round.metadata,
    game: 'blackjack',
    dealerTotal: dealerTotal.total,
    dealerCards: [...dealerCards],
    handCount: settledHands.length,
  };

  // Settle via the ledger using the same branching pattern as Roulette/Plinko.
  if (totalPayout > round.totalCommitted) {
    await recordBetWin(ledger, {
      userAccountId: round.userAccountId,
      escrowAccountId: round.escrowAccountId,
      houseAccountId: round.houseAccountId,
      stake: round.totalCommitted,
      payout: totalPayout,
      currency: round.currency,
      betId: round.roundId,
      metadata: settleMetadata,
    });
  } else if (totalPayout === round.totalCommitted) {
    await recordBetRefund(ledger, {
      userAccountId: round.userAccountId,
      escrowAccountId: round.escrowAccountId,
      stake: round.totalCommitted,
      currency: round.currency,
      betId: round.roundId,
      reason: 'blackjack-push',
      metadata: settleMetadata,
    });
  } else if (totalPayout > 0n) {
    await recordBetPartialPayout(ledger, {
      userAccountId: round.userAccountId,
      escrowAccountId: round.escrowAccountId,
      houseAccountId: round.houseAccountId,
      stake: round.totalCommitted,
      payout: totalPayout,
      currency: round.currency,
      betId: round.roundId,
      metadata: settleMetadata,
    });
  } else {
    await recordBetLoss(ledger, {
      escrowAccountId: round.escrowAccountId,
      houseAccountId: round.houseAccountId,
      stake: round.totalCommitted,
      currency: round.currency,
      betId: round.roundId,
      metadata: settleMetadata,
    });
  }

  return {
    ...round,
    deckCursor: cursor,
    playerHands: settledHands,
    dealer: { cards: dealerCards, final: true },
    state: 'settled',
    totalPayout,
    updatedAt: new Date(),
  };
}

/**
 * Advances the active hand to the next active one. If no active hands remain,
 * runs the dealer phase and settles.
 */
async function advanceOrSettle(
  ledger: LedgerRepository,
  rounds: BlackjackRoundRepository,
  round: BlackjackRound,
): Promise<BlackjackRound> {
  const next = findNextActiveHandIndex(round.playerHands, round.activeHandIndex + 1);
  if (next >= 0) {
    const updated: BlackjackRound = {
      ...round,
      activeHandIndex: next,
      updatedAt: new Date(),
    };
    await rounds.update(updated);
    return updated;
  }
  // No more active hands → settle.
  const settled = await settleRound(ledger, round);
  await rounds.update(settled);
  return settled;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Starts a new Blackjack round.
 *
 * - Validates input
 * - Debits initial stake (idempotent on roundId)
 * - Pre-derives the 32-card shoe via RNG
 * - Deals 2 cards to player + 2 to dealer (4 cards consumed)
 * - Evaluates initial state — if either has blackjack, the round may be
 *   immediately settleable (player BJ + no dealer BJ → instant win;
 *   both BJ → push; dealer BJ + no player BJ → instant loss)
 *
 * Returns the round in either 'player_turn' or 'settled' state.
 */
export async function startRound(
  ledger: LedgerRepository,
  rounds: BlackjackRoundRepository,
  input: StartBlackjackRoundInput,
): Promise<BlackjackRound> {
  assertValidStartInput(input);

  const existing = await rounds.load(input.roundId);
  if (existing !== null) {
    return existing;
  }

  // Phase 1: stake debit
  await recordBetStake(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: input.stake,
    currency: input.currency,
    betId: input.roundId,
    metadata: {
      ...(input.metadata ?? {}),
      game: 'blackjack',
    },
  });

  // Pre-derive the deck
  const { cards } = deriveBlackjack(input.serverSeed, input.clientSeed, input.nonce);
  // Initial deal: P/D/P/D
  // Indexed access on a length-32 array; we know cards[0..3] are present.
  const c0 = cards[0];
  const c1 = cards[1];
  const c2 = cards[2];
  const c3 = cards[3];
  /* v8 ignore next 3 -- defensive; deck is pre-derived to 32 cards */
  if (c0 === undefined || c1 === undefined || c2 === undefined || c3 === undefined) {
    throw new Error('invariant: blackjack deck is too short');
  }
  const playerCards = [c0, c2];
  const dealerCards = [c1, c3];

  const playerInitialState = evaluateHandState(playerCards, true);

  const now = new Date();
  let round: BlackjackRound = {
    roundId: input.roundId,
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    houseAccountId: input.houseAccountId,
    originalStake: input.stake,
    totalCommitted: input.stake,
    currency: input.currency,
    serverSeed: input.serverSeed,
    clientSeed: input.clientSeed,
    nonce: input.nonce,
    deck: [...cards],
    deckCursor: 4,
    playerHands: [
      {
        cards: playerCards,
        stake: input.stake,
        state: playerInitialState,
        settle: null,
        payout: null,
      },
    ],
    activeHandIndex: 0,
    dealer: { cards: dealerCards, final: false },
    state: 'player_turn',
    totalPayout: null,
    createdAt: now,
    updatedAt: now,
    metadata: { ...(input.metadata ?? {}) },
  };

  // If player has natural blackjack, or dealer's upcard is Ace/10 and we should
  // settle immediately — for simplicity, settle when player has BJ. Dealer-BJ
  // peek would require an insurance offer, which we don't support; we just
  // resolve at settlement time.
  const dealerHasBJ = cardsIsBlackjack(dealerCards);
  if (playerInitialState === 'blackjack' || dealerHasBJ) {
    // Both end the player's turn immediately; settle now.
    round = await settleRound(ledger, round);
  }

  await rounds.create(round);
  return round;
}

/**
 * Player hits the active hand: draws one card.
 */
export async function hit(
  ledger: LedgerRepository,
  rounds: BlackjackRoundRepository,
  roundId: string,
): Promise<BlackjackRound> {
  const round = await loadActive(rounds, roundId);
  const idx = round.activeHandIndex;
  const hand = round.playerHands[idx];
  /* v8 ignore next 3 -- guarded by loadActive */
  if (hand === undefined) {
    throw new BlackjackValidationError('no active hand');
  }
  if (hand.state !== 'active') {
    throw new BlackjackValidationError(`cannot hit on hand in state '${hand.state}'`);
  }

  const { card, nextCursor } = drawCard(round);
  const newCards = [...hand.cards, card];
  const newState = evaluateHandState(newCards, false);

  const updatedHand: BlackjackHand = {
    ...hand,
    cards: newCards,
    state: newState,
  };
  const updatedHands = round.playerHands.map((h, i) => (i === idx ? updatedHand : h));
  let updated: BlackjackRound = {
    ...round,
    deck: round.deck,
    deckCursor: nextCursor,
    playerHands: updatedHands,
    updatedAt: new Date(),
  };

  if (newState !== 'active') {
    updated = await advanceOrSettle(ledger, rounds, updated);
  } else {
    await rounds.update(updated);
  }
  return updated;
}

/**
 * Player stands on the active hand.
 */
export async function stand(
  ledger: LedgerRepository,
  rounds: BlackjackRoundRepository,
  roundId: string,
): Promise<BlackjackRound> {
  const round = await loadActive(rounds, roundId);
  const idx = round.activeHandIndex;
  const hand = round.playerHands[idx];
  /* v8 ignore next 3 -- guarded by loadActive */
  if (hand === undefined) {
    throw new BlackjackValidationError('no active hand');
  }
  if (hand.state !== 'active') {
    throw new BlackjackValidationError(`cannot stand on hand in state '${hand.state}'`);
  }

  const updatedHand: BlackjackHand = { ...hand, state: 'stood' };
  const updatedHands = round.playerHands.map((h, i) => (i === idx ? updatedHand : h));
  const updated: BlackjackRound = {
    ...round,
    playerHands: updatedHands,
    updatedAt: new Date(),
  };

  return advanceOrSettle(ledger, rounds, updated);
}

/**
 * Player doubles down on the active hand: stake doubles, draws exactly one
 * card, hand auto-stands.
 *
 * Only allowed on a 2-card active hand.
 */
export async function doubleDown(
  ledger: LedgerRepository,
  rounds: BlackjackRoundRepository,
  roundId: string,
): Promise<BlackjackRound> {
  const round = await loadActive(rounds, roundId);
  const idx = round.activeHandIndex;
  const hand = round.playerHands[idx];
  /* v8 ignore next 3 -- guarded by loadActive */
  if (hand === undefined) {
    throw new BlackjackValidationError('no active hand');
  }
  if (hand.state !== 'active' || hand.cards.length !== 2) {
    throw new BlackjackValidationError('double only allowed on a 2-card active hand');
  }

  // Debit additional stake into escrow. We use a sub-betId so each lifecycle
  // step is idempotent on its own.
  await recordBetStake(ledger, {
    userAccountId: round.userAccountId,
    escrowAccountId: round.escrowAccountId,
    stake: hand.stake,
    currency: round.currency,
    betId: `${round.roundId}-double-${String(idx)}`,
    metadata: { ...round.metadata, game: 'blackjack', sub: 'double', hand: idx },
  });

  const { card, nextCursor } = drawCard(round);
  const newCards = [...hand.cards, card];
  const isBust = handTotal(newCards).isBust;
  const newState: BlackjackHandState = isBust ? 'busted' : 'doubled';

  const updatedHand: BlackjackHand = {
    ...hand,
    cards: newCards,
    stake: hand.stake * 2n,
    state: newState,
  };
  const updatedHands = round.playerHands.map((h, i) => (i === idx ? updatedHand : h));
  const updated: BlackjackRound = {
    ...round,
    deckCursor: nextCursor,
    playerHands: updatedHands,
    totalCommitted: round.totalCommitted + hand.stake,
    updatedAt: new Date(),
  };

  return advanceOrSettle(ledger, rounds, updated);
}

/**
 * Player splits the active hand into two hands. Each new hand gets one of the
 * original cards plus a fresh draw.
 *
 * Only allowed on 2-card matching-rank hands.
 */
export async function split(
  ledger: LedgerRepository,
  rounds: BlackjackRoundRepository,
  roundId: string,
): Promise<BlackjackRound> {
  const round = await loadActive(rounds, roundId);
  const idx = round.activeHandIndex;
  const hand = round.playerHands[idx];
  /* v8 ignore next 3 -- guarded by loadActive */
  if (hand === undefined) {
    throw new BlackjackValidationError('no active hand');
  }
  if (hand.state !== 'active' || !canSplit(hand.cards)) {
    throw new BlackjackValidationError('split only allowed on a matching-rank 2-card hand');
  }
  if (round.playerHands.length >= MAX_HANDS) {
    throw new BlackjackValidationError(`cannot split: max ${String(MAX_HANDS)} hands reached`);
  }

  await recordBetStake(ledger, {
    userAccountId: round.userAccountId,
    escrowAccountId: round.escrowAccountId,
    stake: hand.stake,
    currency: round.currency,
    betId: `${round.roundId}-split-${String(idx)}`,
    metadata: { ...round.metadata, game: 'blackjack', sub: 'split', hand: idx },
  });

  const card1 = hand.cards[0];
  const card2 = hand.cards[1];
  /* v8 ignore next 3 -- canSplit guarantees length 2 */
  if (card1 === undefined || card2 === undefined) {
    throw new Error('invariant: split hand cards undefined');
  }
  const splittingAces = isAce(card1);

  const drawA = drawCard(round);
  const drawB = drawCard({ ...round, deckCursor: drawA.nextCursor });

  // Build the two new hands. Split-Aces auto-stand after 1 card each.
  const handA: BlackjackHand = {
    cards: [card1, drawA.card],
    stake: hand.stake,
    state: splittingAces ? 'split_ace' : evaluateHandState([card1, drawA.card], false),
    settle: null,
    payout: null,
  };
  const handB: BlackjackHand = {
    cards: [card2, drawB.card],
    stake: hand.stake,
    state: splittingAces ? 'split_ace' : evaluateHandState([card2, drawB.card], false),
    settle: null,
    payout: null,
  };

  // Replace the active hand with handA, append handB.
  const newHands: BlackjackHand[] = [];
  for (let i = 0; i < round.playerHands.length; i++) {
    if (i === idx) {
      newHands.push(handA);
    } else {
      const original = round.playerHands[i];
      /* v8 ignore next -- iteration over fixed array */
      if (original !== undefined) newHands.push(original);
    }
  }
  newHands.push(handB);

  const updated: BlackjackRound = {
    ...round,
    deckCursor: drawB.nextCursor,
    playerHands: newHands,
    totalCommitted: round.totalCommitted + hand.stake,
    updatedAt: new Date(),
  };

  // After a split, handA is current. If split-aces, auto-advance.
  if (splittingAces) {
    return advanceOrSettle(ledger, rounds, updated);
  }
  if (handA.state !== 'active') {
    // E.g., hit a 21 on the new draw — auto-advance.
    return advanceOrSettle(ledger, rounds, updated);
  }
  await rounds.update(updated);
  return updated;
}

// ─── Internal helpers ─────────────────────────────────────────────────────

async function loadActive(
  rounds: BlackjackRoundRepository,
  roundId: string,
): Promise<BlackjackRound> {
  const round = await rounds.load(roundId);
  if (round === null) {
    throw new RoundNotFoundError(roundId);
  }
  if (round.state !== 'player_turn') {
    throw new BlackjackValidationError(`round is in state '${round.state}', no actions allowed`);
  }
  return round;
}
