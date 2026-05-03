// packages/games/crash/src/engine.ts
//
// Crash game engine — single-player v1.
// See docs/CRASH.md § 4.

import {
  type LedgerRepository,
  recordBetLoss,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { deriveCrash } from '@solsticebet/rng';

import { assertValidBetInput, CrashValidationError, MAX_PAYOUT } from './limits.js';
import { computePayout, isWinningBet } from './math.js';
import type { CrashBetInput, CrashBetOutcome } from './types.js';

/**
 * Places and settles a single Crash bet end-to-end.
 *
 * Pipeline:
 *   1. Validate input
 *   2. Reject if max-payout cap would be exceeded
 *   3. Phase 1: stake debit (user → escrow)
 *   4. Derive bust multiplier via RNG
 *   5. Phase 2: settle (win or loss)
 *
 * Idempotent on betId throughout.
 */
export async function placeCrashBet(
  ledger: LedgerRepository,
  input: CrashBetInput,
): Promise<CrashBetOutcome> {
  assertValidBetInput(input);

  // Pre-compute potential payout to enforce MAX_PAYOUT cap before any ledger write.
  const potentialPayout = computePayout(input.stake, input.autoCashOut);
  if (potentialPayout > MAX_PAYOUT) {
    throw new CrashValidationError(
      `potential payout ${potentialPayout.toString()} exceeds MAX_PAYOUT ${MAX_PAYOUT.toString()}`,
    );
  }

  // Phase 1: stake debit. Idempotent on betId.
  await recordBetStake(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: input.stake,
    currency: input.currency,
    betId: input.betId,
    metadata: {
      ...(input.metadata ?? {}),
      game: 'crash',
      autoCashOut: input.autoCashOut,
    },
  });

  // Derive the bust point. Deterministic from inputs.
  const { bustAt } = deriveCrash(input.serverSeed, input.clientSeed, input.nonce);
  const isWin = isWinningBet(bustAt, input.autoCashOut);

  if (isWin) {
    const payout = computePayout(input.stake, input.autoCashOut);
    await recordBetWin(ledger, {
      userAccountId: input.userAccountId,
      escrowAccountId: input.escrowAccountId,
      houseAccountId: input.houseAccountId,
      stake: input.stake,
      payout,
      currency: input.currency,
      betId: input.betId,
      metadata: {
        ...(input.metadata ?? {}),
        game: 'crash',
        bustAt,
        autoCashOut: input.autoCashOut,
      },
    });
    return {
      betId: input.betId,
      bustAt,
      autoCashOut: input.autoCashOut,
      stake: input.stake,
      isWin: true,
      payout,
    };
  }

  await recordBetLoss(ledger, {
    escrowAccountId: input.escrowAccountId,
    houseAccountId: input.houseAccountId,
    stake: input.stake,
    currency: input.currency,
    betId: input.betId,
    metadata: {
      ...(input.metadata ?? {}),
      game: 'crash',
      bustAt,
      autoCashOut: input.autoCashOut,
    },
  });
  return {
    betId: input.betId,
    bustAt,
    autoCashOut: input.autoCashOut,
    stake: input.stake,
    isWin: false,
    payout: 0n,
  };
}
