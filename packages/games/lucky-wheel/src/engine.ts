// packages/games/lucky-wheel/src/engine.ts

import {
  type LedgerRepository,
  recordBetLoss,
  recordBetPartialPayout,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { deriveWheel } from '@solsticebet/rng';

import { assertValidBetInput } from './limits.js';
import type { LuckyWheelBetInput, LuckyWheelBetOutcome } from './types.js';
import { SEGMENTS, segmentForValue } from './wheel.js';

const SCALE = 10000;

function computePayout(stake: bigint, multiplier: number): bigint {
  const scaledMul = BigInt(Math.round(multiplier * SCALE));
  return (stake * scaledMul) / BigInt(SCALE);
}

export async function placeLuckyWheelBet(
  ledger: LedgerRepository,
  input: LuckyWheelBetInput,
): Promise<LuckyWheelBetOutcome> {
  assertValidBetInput(input);

  await recordBetStake(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: input.stake,
    currency: input.currency,
    betId: input.betId,
    metadata: { ...(input.metadata ?? {}), game: 'lucky-wheel' },
  });

  const { value } = deriveWheel(input.serverSeed, input.clientSeed, input.nonce);
  const segmentIndex = segmentForValue(value);
  const segment = SEGMENTS[segmentIndex];
  /* v8 ignore next 3 -- bounds-checked by segmentForValue */
  if (segment === undefined) {
    throw new Error('invariant: segment lookup failed');
  }
  const payout = segment.multiplier > 0 ? computePayout(input.stake, segment.multiplier) : 0n;
  const isWin = payout > input.stake;

  const settleMetadata = {
    ...(input.metadata ?? {}),
    game: 'lucky-wheel',
    segment: segment.color,
    multiplier: segment.multiplier,
  };

  if (payout > input.stake) {
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
  } else if (payout > 0n) {
    // Partial: gray segments are 0× so won't hit this; reserved if we add 0.5× later.
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
  } else {
    await recordBetLoss(ledger, {
      escrowAccountId: input.escrowAccountId,
      houseAccountId: input.houseAccountId,
      stake: input.stake,
      currency: input.currency,
      betId: input.betId,
      metadata: settleMetadata,
    });
  }

  return {
    betId: input.betId,
    segmentIndex,
    segment,
    stake: input.stake,
    isWin,
    payout,
  };
}
