// packages/games/keno/src/engine.ts

import {
  type LedgerRepository,
  recordBetLoss,
  recordBetPartialPayout,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { deriveKeno } from '@solsticebet/rng';

import { assertValidBetInput, KenoValidationError, MAX_PAYOUT } from './limits.js';
import { multiplierFor } from './tables.js';
import type { KenoBetInput, KenoBetOutcome } from './types.js';

const SCALE = 10000;

function computePayout(stake: bigint, multiplier: number): bigint {
  const scaledMul = BigInt(Math.round(multiplier * SCALE));
  return (stake * scaledMul) / BigInt(SCALE);
}

export async function placeKenoBet(
  ledger: LedgerRepository,
  input: KenoBetInput,
): Promise<KenoBetOutcome> {
  assertValidBetInput(input);

  await recordBetStake(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: input.stake,
    currency: input.currency,
    betId: input.betId,
    metadata: {
      ...(input.metadata ?? {}),
      game: 'keno',
      picks: [...input.picks],
      risk: input.risk,
    },
  });

  const { drawn } = deriveKeno(input.serverSeed, input.clientSeed, input.nonce);
  const drawnSet = new Set(drawn);
  let hits = 0;
  for (const p of input.picks) {
    if (drawnSet.has(p)) hits += 1;
  }

  const multiplier = multiplierFor(input.picks.length, hits, input.risk);
  const payout = multiplier > 0 ? computePayout(input.stake, multiplier) : 0n;
  const isWin = payout > input.stake;

  /* v8 ignore next 5 -- defence in depth */
  if (payout > MAX_PAYOUT) {
    throw new KenoValidationError(`payout ${payout.toString()} exceeds MAX_PAYOUT`);
  }

  const drawnArr: number[] = drawn.map((n) => n);
  const picksArr: number[] = input.picks.map((n) => n);
  const settleMetadata = {
    ...(input.metadata ?? {}),
    game: 'keno',
    drawn: drawnArr,
    picks: picksArr,
    hits,
    multiplier,
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
  } else if (payout > 0n && payout < input.stake) {
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
  } else if (payout === input.stake) {
    // Edge case: 0 hits on a 1-pick (1.85x) — unreachable since 1.85 > 1.
    // Reaching here would mean a 1× refund. Safe to call refund recipe...
    // but cleaner to log loss as gray-zone. We treat exact stake-equality as
    // partial payout since it's not technically a "push" in Keno semantics.
    await recordBetPartialPayout(ledger, {
      userAccountId: input.userAccountId,
      escrowAccountId: input.escrowAccountId,
      houseAccountId: input.houseAccountId,
      stake: input.stake,
      payout: input.stake - 1n,
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
    drawn: drawnArr,
    picks: picksArr,
    hits,
    multiplier,
    stake: input.stake,
    isWin,
    payout,
  };
}
