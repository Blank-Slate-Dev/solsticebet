// packages/games/sicbo/src/engine.ts
//
// Sic Bo roll engine. Single deterministic roll settles N bets atomically.
//
// See docs/SICBO.md § 4.

import {
  type LedgerRepository,
  recordBetLoss,
  recordBetPartialPayout,
  recordBetRefund,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { deriveSicBo } from '@solsticebet/rng';

import { assertValidRollInput, MAX_ROLL_PAYOUT, SicBoValidationError } from './limits.js';
import { computePayout } from './math.js';
import type { SicBoBetOutcome, SicBoRollInput, SicBoRollOutcome } from './types.js';
import { winMultiplierFor } from './wheel.js';

/**
 * Places a multi-bet Sic Bo roll and settles all bets atomically.
 *
 * Pipeline:
 *   1. Validate roll input (and trial-evaluate every bet to catch malformed targets)
 *   2. Sum total stake; debit user → escrow
 *   3. Derive 3 dice via RNG
 *   4. Compute per-bet outcome (win/loss + multiplier)
 *   5. Settle: branch on totalPayout vs totalStake (win/refund/partial/loss)
 *
 * Idempotent on rollId throughout.
 */
export async function placeSicBoRoll(
  ledger: LedgerRepository,
  input: SicBoRollInput,
): Promise<SicBoRollOutcome> {
  assertValidRollInput(input);

  // Trial-evaluate every bet against a placeholder roll [1,1,1] to catch
  // malformed (type, target) pairs before any ledger write. The boolean is
  // ignored — we just want the throw.
  for (const bet of input.bets) {
    winMultiplierFor(bet.type, bet.target, [1, 1, 1]);
  }

  const totalStake = input.bets.reduce((sum, bet) => sum + bet.stake, 0n);

  // Phase 1: stake debit
  await recordBetStake(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: totalStake,
    currency: input.currency,
    betId: input.rollId,
    metadata: {
      ...(input.metadata ?? {}),
      game: 'sicbo',
      betCount: input.bets.length,
    },
  });

  // Outcome
  const { dice } = deriveSicBo(input.serverSeed, input.clientSeed, input.nonce);
  const total = dice[0] + dice[1] + dice[2];

  // Per-bet settlements
  const betOutcomes: SicBoBetOutcome[] = input.bets.map((bet) => {
    const mul = winMultiplierFor(bet.type, bet.target, dice);
    const isWin = mul > 0;
    const payout = isWin ? computePayout(bet.stake, mul) : 0n;
    return {
      type: bet.type,
      stake: bet.stake,
      target: bet.target ?? null,
      winMultiplier: mul,
      isWin,
      payout,
    };
  });

  const totalPayout = betOutcomes.reduce((sum, o) => sum + o.payout, 0n);

  /* v8 ignore next 5 -- defence in depth */
  if (totalPayout > MAX_ROLL_PAYOUT) {
    throw new SicBoValidationError(`roll payout ${totalPayout.toString()} exceeds MAX_ROLL_PAYOUT`);
  }

  const settleMetadata = {
    ...(input.metadata ?? {}),
    game: 'sicbo',
    dice: [...dice],
    total,
    winningBets: betOutcomes.filter((o) => o.isWin).length,
  };

  // Phase 2: settle
  if (totalPayout > totalStake) {
    await recordBetWin(ledger, {
      userAccountId: input.userAccountId,
      escrowAccountId: input.escrowAccountId,
      houseAccountId: input.houseAccountId,
      stake: totalStake,
      payout: totalPayout,
      currency: input.currency,
      betId: input.rollId,
      metadata: settleMetadata,
    });
  } else if (totalPayout === totalStake) {
    await recordBetRefund(ledger, {
      userAccountId: input.userAccountId,
      escrowAccountId: input.escrowAccountId,
      stake: totalStake,
      currency: input.currency,
      betId: input.rollId,
      reason: 'sicbo-push',
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
      betId: input.rollId,
      metadata: settleMetadata,
    });
  } else {
    await recordBetLoss(ledger, {
      escrowAccountId: input.escrowAccountId,
      houseAccountId: input.houseAccountId,
      stake: totalStake,
      currency: input.currency,
      betId: input.rollId,
      metadata: settleMetadata,
    });
  }

  return {
    rollId: input.rollId,
    dice,
    total,
    bets: betOutcomes,
    totalStake,
    totalPayout,
  };
}
