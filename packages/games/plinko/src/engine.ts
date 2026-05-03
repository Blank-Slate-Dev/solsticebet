// packages/games/plinko/src/engine.ts
//
// Plinko game engine. Single-action bet, branching settlement based on
// whether the bucket multiplier is >1, =1, or <1.
//
// See docs/PLINKO.md § 4.

import {
  type LedgerRepository,
  recordBetPartialPayout,
  recordBetRefund,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { derivePlinko } from '@solsticebet/rng';

import { assertValidBetInput, MAX_PAYOUT, PlinkoValidationError } from './limits.js';
import { computePayout, multiplierForBucket } from './math.js';
import type { PlinkoBetInput, PlinkoBetOutcome } from './types.js';

/**
 * Places and settles a Plinko bet end-to-end.
 *
 * Pipeline:
 *   1. Validate input
 *   2. Phase 1: stake debit (user → escrow)
 *   3. Derive ball path via RNG
 *   4. Look up multiplier from the (rows, risk) table
 *   5. Phase 2: settle, branching:
 *      - multiplier > 1 → recordBetWin (player profits)
 *      - multiplier == 1 → recordBetRefund (push)
 *      - 0 < multiplier < 1 → recordBetPartialPayout (player gets a fraction back)
 *      - multiplier == 0 → recordBetLoss is structurally equivalent;
 *        but our published tables never have 0× multipliers. Defensive only.
 *
 * Idempotent on betId throughout.
 */
export async function placePlinkoBet(
  ledger: LedgerRepository,
  input: PlinkoBetInput,
): Promise<PlinkoBetOutcome> {
  assertValidBetInput(input);

  // Phase 1: stake debit. Idempotent on betId.
  await recordBetStake(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: input.stake,
    currency: input.currency,
    betId: input.betId,
    metadata: {
      ...(input.metadata ?? {}),
      game: 'plinko',
      rows: input.rows,
      risk: input.risk,
    },
  });

  // Derive the path. Deterministic from inputs.
  const { path, bucket } = derivePlinko(
    input.serverSeed,
    input.clientSeed,
    input.nonce,
    input.rows,
  );

  const multiplier = multiplierForBucket(input.rows, input.risk, bucket);
  const payout = computePayout(input.stake, multiplier);

  /* v8 ignore next 5 -- defensive cap; max-table-multiplier × MAX_STAKE = MAX_PAYOUT exactly */
  if (payout > MAX_PAYOUT) {
    throw new PlinkoValidationError(
      `payout ${payout.toString()} exceeds MAX_PAYOUT ${MAX_PAYOUT.toString()}`,
    );
  }

  const settleMetadata = {
    ...(input.metadata ?? {}),
    game: 'plinko',
    rows: input.rows,
    risk: input.risk,
    bucket,
    multiplier,
  };

  // Branch on multiplier.
  if (payout > input.stake) {
    // Profitable win
    await recordBetWin(ledger, {
      userAccountId: input.userAccountId,
      escrowAccountId: input.escrowAccountId,
      houseAccountId: input.houseAccountId,
      stake: input.stake,
      payout,
      currency: input.currency,
      betId: input.betId,
      metadata: settleMetadata,
    });
    return {
      betId: input.betId,
      path: [...path],
      bucket,
      rows: input.rows,
      risk: input.risk,
      multiplier,
      stake: input.stake,
      payout,
      isWin: true,
    };
  }

  if (payout === input.stake) {
    // Push: full refund
    await recordBetRefund(ledger, {
      userAccountId: input.userAccountId,
      escrowAccountId: input.escrowAccountId,
      stake: input.stake,
      currency: input.currency,
      betId: input.betId,
      reason: 'plinko-push',
      metadata: settleMetadata,
    });
    return {
      betId: input.betId,
      path: [...path],
      bucket,
      rows: input.rows,
      risk: input.risk,
      multiplier,
      stake: input.stake,
      payout,
      isWin: false,
    };
  }

  // Partial: 0 < payout < stake
  /* v8 ignore next 6 -- payout==0 path; published tables never have 0× multipliers. Defensive only. */
  if (payout === 0n) {
    throw new PlinkoValidationError(
      'unexpected zero-multiplier bucket; published tables should never produce this',
    );
  }
  await recordBetPartialPayout(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    houseAccountId: input.houseAccountId,
    stake: input.stake,
    payout,
    currency: input.currency,
    betId: input.betId,
    metadata: settleMetadata,
  });
  return {
    betId: input.betId,
    path: [...path],
    bucket,
    rows: input.rows,
    risk: input.risk,
    multiplier,
    stake: input.stake,
    payout,
    isWin: false,
  };
}
