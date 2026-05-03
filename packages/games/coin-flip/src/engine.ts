// packages/games/coin-flip/src/engine.ts

import {
  type LedgerRepository,
  recordBetLoss,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { deriveCoinFlip } from '@solsticebet/rng';

import { assertValidBetInput, PAYOUT_MULTIPLIER } from './limits.js';
import type { CoinFlipBetInput, CoinFlipBetOutcome } from './types.js';

const SCALE = 10000;

function computePayout(stake: bigint): bigint {
  const scaled = BigInt(Math.round(PAYOUT_MULTIPLIER * SCALE));
  return (stake * scaled) / BigInt(SCALE);
}

export async function placeCoinFlipBet(
  ledger: LedgerRepository,
  input: CoinFlipBetInput,
): Promise<CoinFlipBetOutcome> {
  assertValidBetInput(input);

  await recordBetStake(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: input.stake,
    currency: input.currency,
    betId: input.betId,
    metadata: { ...(input.metadata ?? {}), game: 'coin-flip', pick: input.pick },
  });

  const { side: result } = deriveCoinFlip(input.serverSeed, input.clientSeed, input.nonce);
  const isWin = result === input.pick;

  if (isWin) {
    const payout = computePayout(input.stake);
    await recordBetWin(ledger, {
      userAccountId: input.userAccountId,
      escrowAccountId: input.escrowAccountId,
      houseAccountId: input.houseAccountId,
      stake: input.stake,
      payout,
      currency: input.currency,
      betId: input.betId,
      metadata: { ...(input.metadata ?? {}), game: 'coin-flip', result, pick: input.pick },
    });
    return {
      betId: input.betId,
      result,
      pick: input.pick,
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
    metadata: { ...(input.metadata ?? {}), game: 'coin-flip', result, pick: input.pick },
  });
  return {
    betId: input.betId,
    result,
    pick: input.pick,
    stake: input.stake,
    isWin: false,
    payout: 0n,
  };
}
