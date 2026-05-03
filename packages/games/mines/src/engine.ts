// packages/games/mines/src/engine.ts
//
// Mines game engine. Orchestrates round lifecycle:
//   startRound → revealTile (× N) → cashOut | bust
//
// See docs/MINES.md § 5 for the canonical action API.

import {
  type LedgerRepository,
  recordBetLoss,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { deriveMines } from '@solsticebet/rng';

import {
  assertValidStartInput,
  assertValidTileIndex,
  MAX_PAYOUT,
  MinesValidationError,
} from './limits.js';
import { computePayout, multiplierFor, TOTAL_TILES } from './math.js';
import { RoundNotFoundError, type MinesRoundRepository } from './repository.js';
import type { MinesActionOutcome, MinesRound, StartMinesRoundInput } from './types.js';

/**
 * Starts a new Mines round.
 *
 * - Validates input
 * - Debits stake from user → escrow (idempotent on roundId)
 * - Pre-computes the mine layout via the RNG
 * - Persists the round in `active` state
 *
 * Idempotency: calling twice with the same roundId returns the existing
 * round. Stake is not re-debited (the ledger's idempotency on bet_stake
 * guarantees this).
 */
export async function startRound(
  ledger: LedgerRepository,
  rounds: MinesRoundRepository,
  input: StartMinesRoundInput,
): Promise<MinesRound> {
  assertValidStartInput(input);

  // If the round already exists, return it (idempotent restart).
  const existing = await rounds.load(input.roundId);
  if (existing !== null) {
    return existing;
  }

  // Phase 1: stake debit. Idempotent on roundId.
  await recordBetStake(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: input.stake,
    currency: input.currency,
    betId: input.roundId,
    metadata: {
      ...(input.metadata ?? {}),
      game: 'mines',
      mineCount: input.mineCount,
    },
  });

  // Pre-compute the mine layout. Deterministic from (serverSeed, clientSeed, nonce).
  const { tilePermutation } = deriveMines(input.serverSeed, input.clientSeed, input.nonce);

  const now = new Date();
  const round: MinesRound = {
    roundId: input.roundId,
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    houseAccountId: input.houseAccountId,
    stake: input.stake,
    mineCount: input.mineCount,
    currency: input.currency,
    serverSeed: input.serverSeed,
    clientSeed: input.clientSeed,
    nonce: input.nonce,
    mineLayout: [...tilePermutation],
    revealed: [],
    state: 'active',
    payout: null,
    finalMultiplier: null,
    createdAt: now,
    updatedAt: now,
    metadata: { ...(input.metadata ?? {}) },
  };
  await rounds.create(round);
  return round;
}

/**
 * Reveals a tile in an active round.
 *
 * - Rejects if the round is not active
 * - Rejects if the tile index is out of bounds
 * - If the tile is already revealed, returns the current round unchanged (idempotent)
 * - If the revealed tile is a mine, transitions to `busted` and writes a loss
 * - If the revealed tile is safe, increments safe count
 * - If all safe tiles are now revealed, auto-cashes-out at max multiplier
 */
export async function revealTile(
  ledger: LedgerRepository,
  rounds: MinesRoundRepository,
  roundId: string,
  tileIndex: number,
): Promise<MinesActionOutcome> {
  assertValidTileIndex(tileIndex);

  const round = await rounds.load(roundId);
  if (round === null) {
    throw new RoundNotFoundError(roundId);
  }

  // Idempotent re-reveal: if already revealed, return current state.
  if (round.revealed.includes(tileIndex)) {
    return {
      round,
      currentMultiplier:
        round.finalMultiplier ?? multiplierFor(round.mineCount, round.revealed.length),
      // wasMine is omitted; not meaningful on a no-op replay.
    };
  }

  // Terminal-state reject (only after we've checked idempotent replay).
  if (round.state !== 'active') {
    throw new MinesValidationError(`cannot reveal: round is in terminal state '${round.state}'`);
  }

  const minePositions = new Set(round.mineLayout.slice(0, round.mineCount));
  const isMine = minePositions.has(tileIndex);

  const newRevealed = [...round.revealed, tileIndex];

  if (isMine) {
    // Settle as loss. Idempotent on roundId.
    await recordBetLoss(ledger, {
      escrowAccountId: round.escrowAccountId,
      houseAccountId: round.houseAccountId,
      stake: round.stake,
      currency: round.currency,
      betId: round.roundId,
      metadata: {
        ...round.metadata,
        game: 'mines',
        bustedAt: tileIndex,
        revealsBeforeBust: round.revealed.length,
      },
    });

    const updated: MinesRound = {
      ...round,
      revealed: newRevealed,
      state: 'busted',
      payout: 0n,
      finalMultiplier: 0,
      updatedAt: new Date(),
    };
    await rounds.update(updated);
    return { round: updated, wasMine: true, currentMultiplier: 0 };
  }

  // Safe reveal.
  const safeCountAfter = newRevealed.length;
  const totalSafe = TOTAL_TILES - round.mineCount;

  // Auto-cash-out when every safe tile has been revealed.
  if (safeCountAfter === totalSafe) {
    const multiplier = multiplierFor(round.mineCount, safeCountAfter);
    const payout = computePayout(round.stake, multiplier);
    /* v8 ignore next 5 -- defensive cap; auto-cash multiplier × MAX_STAKE stays under MAX_PAYOUT for mineCount ≤ 24 */
    if (payout > MAX_PAYOUT) {
      throw new MinesValidationError(`auto-cashout payout ${payout.toString()} exceeds MAX_PAYOUT`);
    }
    await recordBetWin(ledger, {
      userAccountId: round.userAccountId,
      escrowAccountId: round.escrowAccountId,
      houseAccountId: round.houseAccountId,
      stake: round.stake,
      payout,
      currency: round.currency,
      betId: round.roundId,
      metadata: {
        ...round.metadata,
        game: 'mines',
        outcome: 'auto-cash',
        safeRevealed: safeCountAfter,
        multiplier,
      },
    });

    const updated: MinesRound = {
      ...round,
      revealed: newRevealed,
      state: 'cashed_out',
      payout,
      finalMultiplier: multiplier,
      updatedAt: new Date(),
    };
    await rounds.update(updated);
    return {
      round: updated,
      wasMine: false,
      currentMultiplier: multiplier,
    };
  }

  // Plain safe reveal — round continues.
  const updated: MinesRound = {
    ...round,
    revealed: newRevealed,
    updatedAt: new Date(),
  };
  await rounds.update(updated);
  return {
    round: updated,
    wasMine: false,
    currentMultiplier: multiplierFor(round.mineCount, safeCountAfter),
  };
}

/**
 * Cash out an active round.
 *
 * - Rejects if round not active
 * - Rejects if no safe tiles have been revealed (no winnable multiplier)
 * - Otherwise: pays out stake × current multiplier, transitions to cashed_out
 *
 * Idempotent: re-calling on a cashed-out round returns the round unchanged.
 */
export async function cashOut(
  ledger: LedgerRepository,
  rounds: MinesRoundRepository,
  roundId: string,
): Promise<MinesActionOutcome> {
  const round = await rounds.load(roundId);
  if (round === null) {
    throw new RoundNotFoundError(roundId);
  }

  // Idempotent: already cashed out.
  if (round.state === 'cashed_out') {
    return {
      round,
      /* v8 ignore next -- finalMultiplier is non-null on cashed_out by construction */
      currentMultiplier: round.finalMultiplier ?? 0,
    };
  }

  if (round.state !== 'active') {
    throw new MinesValidationError(`cannot cash out: round is in terminal state '${round.state}'`);
  }

  if (round.revealed.length === 0) {
    throw new MinesValidationError('cannot cash out before revealing at least one safe tile');
  }

  const multiplier = multiplierFor(round.mineCount, round.revealed.length);
  const payout = computePayout(round.stake, multiplier);
  /* v8 ignore next 5 -- defensive cap; unreachable for mineCount ≤ 24 and MAX_STAKE */
  if (payout > MAX_PAYOUT) {
    throw new MinesValidationError(`cashout payout ${payout.toString()} exceeds MAX_PAYOUT`);
  }

  await recordBetWin(ledger, {
    userAccountId: round.userAccountId,
    escrowAccountId: round.escrowAccountId,
    houseAccountId: round.houseAccountId,
    stake: round.stake,
    payout,
    currency: round.currency,
    betId: round.roundId,
    metadata: {
      ...round.metadata,
      game: 'mines',
      outcome: 'cashout',
      safeRevealed: round.revealed.length,
      multiplier,
    },
  });

  const updated: MinesRound = {
    ...round,
    state: 'cashed_out',
    payout,
    finalMultiplier: multiplier,
    updatedAt: new Date(),
  };
  await rounds.update(updated);
  return { round: updated, currentMultiplier: multiplier };
}
