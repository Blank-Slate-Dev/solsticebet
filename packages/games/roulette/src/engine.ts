// packages/games/roulette/src/engine.ts
//
// Roulette spin engine. Single deterministic spin settles N bets atomically.
//
// See docs/ROULETTE.md § 4.

import {
  type LedgerRepository,
  recordBetLoss,
  recordBetPartialPayout,
  recordBetRefund,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { deriveRoulette } from '@solsticebet/rng';

import { assertValidSpinInput, MAX_SPIN_PAYOUT, RouletteValidationError } from './limits.js';
import { computePayout } from './math.js';
import type { RouletteBetOutcome, RouletteSpinInput, RouletteSpinOutcome } from './types.js';
import { colorOf, isWinningBet, PAYOUTS } from './wheel.js';

/**
 * Places a multi-bet Roulette spin and settles all bets atomically.
 *
 * Pipeline:
 *   1. Validate spin input
 *   2. Sum total stake across all bets; debit user → escrow (one ledger tx)
 *   3. Derive the spin result via RNG
 *   4. Compute per-bet outcome (win/loss/payout)
 *   5. Sum total gross payout across winning bets
 *   6. Settle: branch on totalPayout vs totalStake
 *      - totalPayout > totalStake: recordBetWin (player profits)
 *      - totalPayout == totalStake: recordBetRefund (push)
 *      - 0 < totalPayout < totalStake: recordBetPartialPayout
 *      - totalPayout == 0: recordBetLoss
 *
 * Idempotent on spinId throughout.
 */
export async function placeRouletteSpin(
  ledger: LedgerRepository,
  input: RouletteSpinInput,
): Promise<RouletteSpinOutcome> {
  assertValidSpinInput(input);

  // For each bet, validate the (type, target) pair by trial-evaluating against
  // a placeholder result. We'd rather fail before any ledger write than discover
  // a malformed bet during settlement. Use result=0 — every win-predicate either
  // accepts or rejects this without affecting later math.
  for (const bet of input.bets) {
    // The win predicate throws on malformed inputs; we ignore the boolean.
    isWinningBet(bet.type, bet.target, 0);
  }

  const totalStake = input.bets.reduce((sum, bet) => sum + bet.stake, 0n);

  // Phase 1: stake debit. Idempotent on spinId via the ledger recipe.
  await recordBetStake(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: totalStake,
    currency: input.currency,
    betId: input.spinId,
    metadata: {
      ...(input.metadata ?? {}),
      game: 'roulette',
      betCount: input.bets.length,
    },
  });

  // Outcome
  const { result } = deriveRoulette(input.serverSeed, input.clientSeed, input.nonce);

  // Compute per-bet outcomes and total payout
  const betOutcomes: RouletteBetOutcome[] = input.bets.map((bet) => {
    const won = isWinningBet(bet.type, bet.target, result);
    const multiplier = PAYOUTS[bet.type];
    const payout = won ? computePayout(bet.stake, bet.type) : 0n;
    return {
      type: bet.type,
      stake: bet.stake,
      target: bet.target ?? null,
      multiplier,
      isWin: won,
      payout,
    };
  });

  const totalPayout = betOutcomes.reduce((sum, o) => sum + o.payout, 0n);

  /* v8 ignore next 5 -- defence in depth; per-bet caps guarantee this */
  if (totalPayout > MAX_SPIN_PAYOUT) {
    throw new RouletteValidationError(
      `spin payout ${totalPayout.toString()} exceeds MAX_SPIN_PAYOUT`,
    );
  }

  const settleMetadata = {
    ...(input.metadata ?? {}),
    game: 'roulette',
    result,
    color: colorOf(result),
    winningBets: betOutcomes.filter((o) => o.isWin).length,
  };

  // Phase 2: settle based on the net outcome of the spin.
  if (totalPayout > totalStake) {
    await recordBetWin(ledger, {
      userAccountId: input.userAccountId,
      escrowAccountId: input.escrowAccountId,
      houseAccountId: input.houseAccountId,
      stake: totalStake,
      payout: totalPayout,
      currency: input.currency,
      betId: input.spinId,
      metadata: settleMetadata,
    });
  } else if (totalPayout === totalStake) {
    await recordBetRefund(ledger, {
      userAccountId: input.userAccountId,
      escrowAccountId: input.escrowAccountId,
      stake: totalStake,
      currency: input.currency,
      betId: input.spinId,
      reason: 'roulette-push',
      metadata: settleMetadata,
    });
  } else if (totalPayout > 0n) {
    await recordBetPartialPayout(ledger, {
      userAccountId: input.userAccountId,
      escrowAccountId: input.escrowAccountId,
      houseAccountId: input.houseAccountId,
      stake: totalStake,
      payout: totalPayout,
      currency: input.currency,
      betId: input.spinId,
      metadata: settleMetadata,
    });
  } else {
    await recordBetLoss(ledger, {
      escrowAccountId: input.escrowAccountId,
      houseAccountId: input.houseAccountId,
      stake: totalStake,
      currency: input.currency,
      betId: input.spinId,
      metadata: settleMetadata,
    });
  }

  return {
    spinId: input.spinId,
    result,
    resultColor: colorOf(result),
    bets: betOutcomes,
    totalStake,
    totalPayout,
  };
}
