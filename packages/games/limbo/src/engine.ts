// packages/games/limbo/src/engine.ts

import {
  type LedgerRepository,
  recordBetLoss,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { deriveLimbo } from '@solsticebet/rng';

import { assertValidBetInput, LimboValidationError, MAX_PAYOUT } from './limits.js';
import type { LimboBetInput, LimboBetOutcome } from './types.js';

const SCALE = 10000;

function computePayout(stake: bigint, multiplier: number): bigint {
  const scaledMul = BigInt(Math.round(multiplier * SCALE));
  return (stake * scaledMul) / BigInt(SCALE);
}

export async function placeLimboBet(
  ledger: LedgerRepository,
  input: LimboBetInput,
): Promise<LimboBetOutcome> {
  assertValidBetInput(input);

  const potentialPayout = computePayout(input.stake, input.target);
  if (potentialPayout > MAX_PAYOUT) {
    throw new LimboValidationError(
      `potential payout ${potentialPayout.toString()} exceeds MAX_PAYOUT`,
    );
  }

  await recordBetStake(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: input.stake,
    currency: input.currency,
    betId: input.betId,
    metadata: { ...(input.metadata ?? {}), game: 'limbo', target: input.target },
  });

  const { result } = deriveLimbo(input.serverSeed, input.clientSeed, input.nonce);
  const isWin = result >= input.target;

  if (isWin) {
    const payout = computePayout(input.stake, input.target);
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
        game: 'limbo',
        result,
        target: input.target,
      },
    });
    return {
      betId: input.betId,
      result,
      target: input.target,
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
    metadata: { ...(input.metadata ?? {}), game: 'limbo', result, target: input.target },
  });
  return {
    betId: input.betId,
    result,
    target: input.target,
    stake: input.stake,
    isWin: false,
    payout: 0n,
  };
}
