// packages/games/dice/src/engine.ts
//
// Dice game engine. Orchestrates the full bet pipeline:
//   validate → stake debit → RNG outcome → settle → return result
//
// See docs/DICE.md § 4 for the canonical flow.

import {
  type LedgerRepository,
  recordBetLoss,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { deriveDice } from '@solsticebet/rng';

import { assertValidBetInput, DiceValidationError, MAX_PAYOUT } from './limits.js';
import { computeMultiplier, computePayout, isWinningRoll } from './math.js';
import type { DiceBetInput, DiceBetOutcome } from './types.js';

/**
 * Places and settles a single Dice bet end-to-end.
 *
 * Pipeline:
 *   1. Validate input
 *   2. Compute multiplier; reject if potential payout exceeds MAX_PAYOUT
 *   3. Phase 1: stake debit (user → escrow)
 *   4. Derive roll via RNG (deterministic from inputs)
 *   5. Determine win/loss
 *   6. Phase 2: settle (win → user; loss → house)
 *   7. Return outcome
 *
 * Every ledger write is idempotent on betId. If this function is retried
 * with the same input, the user's balance changes by the same net amount.
 *
 * @throws DiceValidationError on invalid input
 * @throws RangeError if the configured multiplier would exceed MAX_PAYOUT
 * @throws errors from the underlying repository (insufficient balance, etc.)
 */
export async function placeDiceBet(
  repo: LedgerRepository,
  input: DiceBetInput,
): Promise<DiceBetOutcome> {
  assertValidBetInput(input);

  const multiplier = computeMultiplier(input.target, input.mode);
  const potentialPayout = computePayout(input.stake, multiplier);

  /* v8 ignore next 8 -- defensive cap; unreachable given MAX_STAKE * max-multiplier === MAX_PAYOUT */
  if (potentialPayout > MAX_PAYOUT) {
    // The single-bet payout cap is a defence-in-depth check.
    // Targets at the edges combined with high stakes can approach this; we
    // refuse to place the bet rather than risk a runaway payout.
    throw new DiceValidationError(
      `potential payout ${potentialPayout.toString()} exceeds MAX_PAYOUT ${MAX_PAYOUT.toString()}`,
    );
  }

  // Phase 1: debit the user, credit escrow. Idempotent on betId.
  await recordBetStake(repo, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: input.stake,
    currency: input.currency,
    betId: input.betId,
    metadata: {
      ...(input.metadata ?? {}),
      game: 'dice',
      target: input.target,
      mode: input.mode,
    },
  });

  // Derive the roll. Deterministic given (serverSeed, clientSeed, nonce).
  const { roll } = deriveDice(input.serverSeed, input.clientSeed, input.nonce);
  const isWin = isWinningRoll(roll, input.target, input.mode);

  // Phase 2: settle.
  if (isWin) {
    const payout = computePayout(input.stake, multiplier);
    await recordBetWin(repo, {
      userAccountId: input.userAccountId,
      escrowAccountId: input.escrowAccountId,
      houseAccountId: input.houseAccountId,
      stake: input.stake,
      payout,
      currency: input.currency,
      betId: input.betId,
      metadata: {
        ...(input.metadata ?? {}),
        game: 'dice',
        roll,
        target: input.target,
        mode: input.mode,
        multiplier,
      },
    });
    return {
      betId: input.betId,
      roll,
      target: input.target,
      mode: input.mode,
      multiplier,
      isWin: true,
      payout,
      stake: input.stake,
    };
  }

  await recordBetLoss(repo, {
    escrowAccountId: input.escrowAccountId,
    houseAccountId: input.houseAccountId,
    stake: input.stake,
    currency: input.currency,
    betId: input.betId,
    metadata: {
      ...(input.metadata ?? {}),
      game: 'dice',
      roll,
      target: input.target,
      mode: input.mode,
    },
  });
  return {
    betId: input.betId,
    roll,
    target: input.target,
    mode: input.mode,
    multiplier,
    isWin: false,
    payout: 0n,
    stake: input.stake,
  };
}
