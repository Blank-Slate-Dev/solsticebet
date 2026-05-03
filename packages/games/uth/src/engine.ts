// packages/games/uth/src/engine.ts
//
// UTH coup engine. Multi-stage state machine for player decisions.
// See docs/UTH.md § 6.

import {
  type LedgerRepository,
  recordBetLoss,
  recordBetPartialPayout,
  recordBetRefund,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { deriveUth, type UthCard } from '@solsticebet/rng';

import { bestOfSeven } from './evaluator.js';
import { assertValidStartInput, MAX_COUP_PAYOUT, UthValidationError } from './limits.js';
import { BLIND_PAYTABLE, computePayout, TRIPS_PAYTABLE } from './math.js';
import { CoupNotFoundError, type UthCoupRepository } from './repository.js';
import type { BetSettlement, HandScore, StartUthCoupInput, UthCoup } from './types.js';

// ─── helpers ─────────────────────────────────────────────────────────────

function dealerQualifies(hand: HandScore): boolean {
  // Dealer qualifies with a pair or better.
  if (hand.rank === 'high_card') return false;
  return true;
}

function settleAnte(
  coup: UthCoup,
  playerWins: boolean,
  dealerQ: boolean,
  tie: boolean,
): BetSettlement {
  if (coup.folded) {
    return { state: 'loss', stake: coup.ante, winMultiplier: 0, payout: 0n };
  }
  if (!dealerQ) {
    // Ante pushes regardless of hand comparison
    return { state: 'push', stake: coup.ante, winMultiplier: 0, payout: coup.ante };
  }
  if (tie) {
    return { state: 'push', stake: coup.ante, winMultiplier: 0, payout: coup.ante };
  }
  if (playerWins) {
    return { state: 'win', stake: coup.ante, winMultiplier: 1, payout: coup.ante * 2n };
  }
  return { state: 'loss', stake: coup.ante, winMultiplier: 0, payout: 0n };
}

function settleBlind(
  coup: UthCoup,
  playerHand: HandScore | null,
  playerWins: boolean,
  tie: boolean,
): BetSettlement {
  if (coup.folded || playerHand === null) {
    return { state: 'loss', stake: coup.blind, winMultiplier: 0, payout: 0n };
  }
  if (tie) {
    return { state: 'push', stake: coup.blind, winMultiplier: 0, payout: coup.blind };
  }
  if (!playerWins) {
    return { state: 'loss', stake: coup.blind, winMultiplier: 0, payout: 0n };
  }
  // Player won: pay per the Blind table
  const mul = BLIND_PAYTABLE[playerHand.rank];
  const payout = computePayout(coup.blind, mul);
  return { state: 'win', stake: coup.blind, winMultiplier: mul, payout };
}

function settlePlay(coup: UthCoup, playerWins: boolean, tie: boolean): BetSettlement {
  if (coup.folded || coup.play === 0n) {
    return { state: 'loss', stake: coup.play, winMultiplier: 0, payout: 0n };
  }
  if (tie) {
    return { state: 'push', stake: coup.play, winMultiplier: 0, payout: coup.play };
  }
  if (playerWins) {
    return { state: 'win', stake: coup.play, winMultiplier: 1, payout: coup.play * 2n };
  }
  return { state: 'loss', stake: coup.play, winMultiplier: 0, payout: 0n };
}

function settleTrips(coup: UthCoup, playerHand: HandScore | null): BetSettlement {
  if (coup.trips === 0n) {
    return { state: 'loss', stake: 0n, winMultiplier: 0, payout: 0n };
  }
  // Trips settles regardless of fold (it's a side bet) — but if folded we
  // never have a player hand to evaluate. We dealt the player's 2 cards
  // and have all 5 community cards (always 5 cards even on fold), so we
  // can still build the hand. In strict folds, the player's two hole
  // cards combined with the community is still a valid 7-card pool.
  if (playerHand === null) {
    // Defensive — shouldn't reach here since we always evaluate on settle
    return { state: 'loss', stake: coup.trips, winMultiplier: 0, payout: 0n };
  }
  const mul = TRIPS_PAYTABLE[playerHand.rank];
  if (mul === 0) {
    return { state: 'loss', stake: coup.trips, winMultiplier: 0, payout: 0n };
  }
  const payout = computePayout(coup.trips, mul);
  return { state: 'win', stake: coup.trips, winMultiplier: mul, payout };
}

// ─── settlement ──────────────────────────────────────────────────────────

async function finaliseCoup(ledger: LedgerRepository, coup: UthCoup): Promise<UthCoup> {
  // Build hands. Cards layout:
  // [0..1]: player hole
  // [2..6]: community (flop = 2,3,4; turn = 5; river = 6)
  // [7..8]: dealer hole
  const c = coup.cards;
  const playerSeven: UthCard[] = [c[0], c[1], c[2], c[3], c[4], c[5], c[6]].filter(
    (x): x is UthCard => x !== undefined,
  );
  const dealerSeven: UthCard[] = [c[7], c[8], c[2], c[3], c[4], c[5], c[6]].filter(
    (x): x is UthCard => x !== undefined,
  );
  /* v8 ignore next 3 -- defensive; cards array always has 9 entries */
  if (playerSeven.length !== 7 || dealerSeven.length !== 7) {
    throw new Error('invariant: UTH cards array malformed');
  }

  const playerHand = bestOfSeven(playerSeven);
  const dealerHand = bestOfSeven(dealerSeven);
  const dealerQ = dealerQualifies(dealerHand);

  let playerWins = false;
  let tie = false;
  if (!coup.folded) {
    if (playerHand.score > dealerHand.score) playerWins = true;
    else if (playerHand.score === dealerHand.score) tie = true;
  }

  const ante = settleAnte(coup, playerWins, dealerQ, tie);
  const blind = settleBlind(coup, playerHand, playerWins, tie);
  const play = settlePlay(coup, playerWins, tie);
  const trips = settleTrips(coup, playerHand);

  const totalPayout = ante.payout + blind.payout + play.payout + trips.payout;

  /* v8 ignore next 5 -- defence in depth */
  if (totalPayout > MAX_COUP_PAYOUT) {
    throw new UthValidationError(`coup payout ${totalPayout.toString()} exceeds MAX_COUP_PAYOUT`);
  }

  const settleMetadata = {
    ...coup.metadata,
    game: 'uth',
    playerHand: playerHand.rank,
    dealerHand: dealerHand.rank,
    dealerQualifies: dealerQ,
    playerWins,
    tie,
    folded: coup.folded,
  };

  // Branch on net payout vs total committed
  if (totalPayout > coup.totalCommitted) {
    await recordBetWin(ledger, {
      userAccountId: coup.userAccountId,
      escrowAccountId: coup.escrowAccountId,
      houseAccountId: coup.houseAccountId,
      stake: coup.totalCommitted,
      payout: totalPayout,
      currency: coup.currency,
      betId: coup.coupId,
      metadata: settleMetadata,
    });
  } else if (totalPayout === coup.totalCommitted) {
    await recordBetRefund(ledger, {
      userAccountId: coup.userAccountId,
      escrowAccountId: coup.escrowAccountId,
      stake: coup.totalCommitted,
      currency: coup.currency,
      betId: coup.coupId,
      reason: 'uth-push',
      metadata: settleMetadata,
    });
  } else if (totalPayout > 0n) {
    await recordBetPartialPayout(ledger, {
      userAccountId: coup.userAccountId,
      escrowAccountId: coup.escrowAccountId,
      houseAccountId: coup.houseAccountId,
      stake: coup.totalCommitted,
      payout: totalPayout,
      currency: coup.currency,
      betId: coup.coupId,
      metadata: settleMetadata,
    });
  } else {
    await recordBetLoss(ledger, {
      escrowAccountId: coup.escrowAccountId,
      houseAccountId: coup.houseAccountId,
      stake: coup.totalCommitted,
      currency: coup.currency,
      betId: coup.coupId,
      metadata: settleMetadata,
    });
  }

  return {
    ...coup,
    phase: 'settled',
    playerHand,
    dealerHand,
    dealerQualifies: dealerQ,
    anteSettlement: ante,
    blindSettlement: blind,
    playSettlement: play,
    tripsSettlement: trips,
    totalPayout,
    updatedAt: new Date(),
  };
}

// ─── public API ──────────────────────────────────────────────────────────

/**
 * Starts a new UTH coup: places Ante + Blind + optional Trips, deals all 9 cards.
 * Round phase begins at 'preflop' awaiting the player's 4× / 3× / check decision.
 */
export async function startCoup(
  ledger: LedgerRepository,
  coups: UthCoupRepository,
  input: StartUthCoupInput,
): Promise<UthCoup> {
  assertValidStartInput(input);

  const existing = await coups.load(input.coupId);
  if (existing !== null) return existing;

  const totalInitial = input.ante + input.ante + input.trips; // ante + blind + trips
  await recordBetStake(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: totalInitial,
    currency: input.currency,
    betId: input.coupId,
    metadata: {
      ...(input.metadata ?? {}),
      game: 'uth',
      ante: input.ante.toString(),
      trips: input.trips.toString(),
    },
  });

  const { cards } = deriveUth(input.serverSeed, input.clientSeed, input.nonce);

  const now = new Date();
  const coup: UthCoup = {
    coupId: input.coupId,
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    houseAccountId: input.houseAccountId,
    currency: input.currency,
    serverSeed: input.serverSeed,
    clientSeed: input.clientSeed,
    nonce: input.nonce,
    cards: [...cards],
    ante: input.ante,
    blind: input.ante,
    trips: input.trips,
    play: 0n,
    playMultiplier: 0,
    totalCommitted: totalInitial,
    folded: false,
    phase: 'preflop',
    playerHand: null,
    dealerHand: null,
    dealerQualifies: null,
    anteSettlement: null,
    blindSettlement: null,
    playSettlement: null,
    tripsSettlement: null,
    totalPayout: null,
    createdAt: now,
    updatedAt: now,
    metadata: { ...(input.metadata ?? {}) },
  };
  await coups.create(coup);
  return coup;
}

async function loadActive(coups: UthCoupRepository, coupId: string): Promise<UthCoup> {
  const coup = await coups.load(coupId);
  if (coup === null) throw new CoupNotFoundError(coupId);
  if (coup.phase === 'settled') {
    throw new UthValidationError('coup already settled');
  }
  return coup;
}

async function placePlayBet(
  ledger: LedgerRepository,
  coup: UthCoup,
  multiplier: 1 | 2 | 3 | 4,
): Promise<UthCoup> {
  const playStake = coup.ante * BigInt(multiplier);
  await recordBetStake(ledger, {
    userAccountId: coup.userAccountId,
    escrowAccountId: coup.escrowAccountId,
    stake: playStake,
    currency: coup.currency,
    betId: `${coup.coupId}-play-${String(multiplier)}x`,
    metadata: { ...coup.metadata, game: 'uth', sub: 'play', multiplier },
  });
  return {
    ...coup,
    play: playStake,
    playMultiplier: multiplier,
    totalCommitted: coup.totalCommitted + playStake,
    updatedAt: new Date(),
  };
}

/**
 * Pre-flop: player raises 4× Ante.
 */
export async function raise4x(
  ledger: LedgerRepository,
  coups: UthCoupRepository,
  coupId: string,
): Promise<UthCoup> {
  const coup = await loadActive(coups, coupId);
  if (coup.phase !== 'preflop') {
    throw new UthValidationError(`raise_4x only valid pre-flop (phase=${coup.phase})`);
  }
  let updated = await placePlayBet(ledger, coup, 4);
  // Move directly to settlement after 4× raise — all decisions are made.
  updated = await finaliseCoup(ledger, updated);
  await coups.update(updated);
  return updated;
}

/**
 * Pre-flop: player raises 3× Ante.
 */
export async function raise3x(
  ledger: LedgerRepository,
  coups: UthCoupRepository,
  coupId: string,
): Promise<UthCoup> {
  const coup = await loadActive(coups, coupId);
  if (coup.phase !== 'preflop') {
    throw new UthValidationError(`raise_3x only valid pre-flop (phase=${coup.phase})`);
  }
  let updated = await placePlayBet(ledger, coup, 3);
  updated = await finaliseCoup(ledger, updated);
  await coups.update(updated);
  return updated;
}

/**
 * Pre-flop: player checks (defers decision to flop).
 */
export async function checkPreflop(
  ledger: LedgerRepository,
  coups: UthCoupRepository,
  coupId: string,
): Promise<UthCoup> {
  const coup = await loadActive(coups, coupId);
  if (coup.phase !== 'preflop') {
    throw new UthValidationError(`check_preflop only valid pre-flop`);
  }
  const updated: UthCoup = { ...coup, phase: 'flop', updatedAt: new Date() };
  await coups.update(updated);
  void ledger; // unused at this step
  return updated;
}

/**
 * Flop: player raises 2× Ante.
 */
export async function raise2x(
  ledger: LedgerRepository,
  coups: UthCoupRepository,
  coupId: string,
): Promise<UthCoup> {
  const coup = await loadActive(coups, coupId);
  if (coup.phase !== 'flop') {
    throw new UthValidationError(`raise_2x only valid post-flop (phase=${coup.phase})`);
  }
  let updated = await placePlayBet(ledger, coup, 2);
  updated = await finaliseCoup(ledger, updated);
  await coups.update(updated);
  return updated;
}

/**
 * Flop: player checks (defers decision to river).
 */
export async function checkFlop(
  ledger: LedgerRepository,
  coups: UthCoupRepository,
  coupId: string,
): Promise<UthCoup> {
  const coup = await loadActive(coups, coupId);
  if (coup.phase !== 'flop') {
    throw new UthValidationError(`check_flop only valid post-flop`);
  }
  const updated: UthCoup = { ...coup, phase: 'river', updatedAt: new Date() };
  await coups.update(updated);
  void ledger;
  return updated;
}

/**
 * River: player raises 1× Ante (the final raise option).
 */
export async function raise1x(
  ledger: LedgerRepository,
  coups: UthCoupRepository,
  coupId: string,
): Promise<UthCoup> {
  const coup = await loadActive(coups, coupId);
  if (coup.phase !== 'river') {
    throw new UthValidationError(`raise_1x only valid on the river (phase=${coup.phase})`);
  }
  let updated = await placePlayBet(ledger, coup, 1);
  updated = await finaliseCoup(ledger, updated);
  await coups.update(updated);
  return updated;
}

/**
 * River: player folds. Forfeits Ante and Blind. Trips still settles.
 */
export async function fold(
  ledger: LedgerRepository,
  coups: UthCoupRepository,
  coupId: string,
): Promise<UthCoup> {
  const coup = await loadActive(coups, coupId);
  if (coup.phase !== 'river') {
    throw new UthValidationError(`fold only valid on the river (phase=${coup.phase})`);
  }
  const folded: UthCoup = { ...coup, folded: true, updatedAt: new Date() };
  const settled = await finaliseCoup(ledger, folded);
  await coups.update(settled);
  return settled;
}
