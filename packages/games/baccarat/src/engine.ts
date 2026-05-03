// packages/games/baccarat/src/engine.ts
//
// Baccarat coup engine. Punto Banco rules.
//
// See docs/BACCARAT.md § 4.

import {
  type LedgerRepository,
  recordBetLoss,
  recordBetPartialPayout,
  recordBetRefund,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { deriveBaccarat } from '@solsticebet/rng';

import { assertValidCoupInput, BaccaratValidationError, MAX_COUP_PAYOUT } from './limits.js';
import { computePayout } from './math.js';
import { playTableau } from './tableau.js';
import type { BaccaratBetOutcome, BaccaratCoupInput, BaccaratCoupOutcome } from './types.js';

/**
 * Plays a single Baccarat coup and settles all bets atomically.
 *
 * Pipeline:
 *   1. Validate coup input
 *   2. Sum total stake; debit user → escrow
 *   3. Derive cards via RNG, run the tableau to determine winner
 *   4. Compute per-bet outcome:
 *      - matching bet wins (player→player, banker→banker, tie→tie)
 *      - non-Tie bets on a Tie outcome push (full stake refund)
 *      - all other bets lose
 *   5. Settle (branch on totalPayout vs totalStake, same as Roulette/Plinko)
 *
 * Idempotent on coupId throughout.
 */
export async function placeBaccaratCoup(
  ledger: LedgerRepository,
  input: BaccaratCoupInput,
): Promise<BaccaratCoupOutcome> {
  assertValidCoupInput(input);

  const totalStake = input.bets.reduce((sum, bet) => sum + bet.stake, 0n);

  // Phase 1: stake debit. Idempotent on coupId.
  await recordBetStake(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: totalStake,
    currency: input.currency,
    betId: input.coupId,
    metadata: {
      ...(input.metadata ?? {}),
      game: 'baccarat',
      betCount: input.bets.length,
    },
  });

  // Deal + tableau
  const { cards } = deriveBaccarat(input.serverSeed, input.clientSeed, input.nonce);
  const deal = playTableau(cards);

  // Settle each bet
  const betOutcomes: BaccaratBetOutcome[] = input.bets.map((bet) => {
    if (bet.type === deal.winner) {
      return {
        type: bet.type,
        stake: bet.stake,
        state: 'win' as const,
        payout: computePayout(bet.stake, bet.type),
      };
    }
    if (deal.winner === 'tie' && bet.type !== 'tie') {
      // Push: refund stake to non-Tie bets
      return {
        type: bet.type,
        stake: bet.stake,
        state: 'push' as const,
        payout: bet.stake,
      };
    }
    return {
      type: bet.type,
      stake: bet.stake,
      state: 'loss' as const,
      payout: 0n,
    };
  });

  const totalPayout = betOutcomes.reduce((sum, o) => sum + o.payout, 0n);

  /* v8 ignore next 5 -- defence in depth; per-bet caps guarantee this */
  if (totalPayout > MAX_COUP_PAYOUT) {
    throw new BaccaratValidationError(
      `coup payout ${totalPayout.toString()} exceeds MAX_COUP_PAYOUT`,
    );
  }

  const settleMetadata = {
    ...(input.metadata ?? {}),
    game: 'baccarat',
    winner: deal.winner,
    playerTotal: deal.player.total,
    bankerTotal: deal.banker.total,
    natural: deal.natural,
  };

  // Phase 2: settle based on net outcome
  if (totalPayout > totalStake) {
    await recordBetWin(ledger, {
      userAccountId: input.userAccountId,
      escrowAccountId: input.escrowAccountId,
      houseAccountId: input.houseAccountId,
      stake: totalStake,
      payout: totalPayout,
      currency: input.currency,
      betId: input.coupId,
      metadata: settleMetadata,
    });
  } else if (totalPayout === totalStake) {
    await recordBetRefund(ledger, {
      userAccountId: input.userAccountId,
      escrowAccountId: input.escrowAccountId,
      stake: totalStake,
      currency: input.currency,
      betId: input.coupId,
      reason: 'baccarat-push',
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
      betId: input.coupId,
      metadata: settleMetadata,
    });
  } else {
    await recordBetLoss(ledger, {
      escrowAccountId: input.escrowAccountId,
      houseAccountId: input.houseAccountId,
      stake: totalStake,
      currency: input.currency,
      betId: input.coupId,
      metadata: settleMetadata,
    });
  }

  return {
    coupId: input.coupId,
    deal,
    bets: betOutcomes,
    totalStake,
    totalPayout,
  };
}
