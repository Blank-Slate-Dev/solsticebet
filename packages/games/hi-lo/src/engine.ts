// packages/games/hi-lo/src/engine.ts

import {
  type LedgerRepository,
  recordBetLoss,
  recordBetPartialPayout,
  recordBetRefund,
  recordBetStake,
  recordBetWin,
} from '@solsticebet/ledger';
import { deriveHiLoCard } from '@solsticebet/rng';

import { assertValidStartInput, HiLoValidationError, MAX_PAYOUT, MAX_PICKS } from './limits.js';
import {
  availablePicks,
  computePayout,
  isWinningPick,
  pickMultiplier,
  pickProbability,
} from './math.js';
import { type HiLoRoundRepository, RoundNotFoundError } from './repository.js';
import type { HiLoPick, HiLoRound, StartHiLoRoundInput } from './types.js';

export async function startRound(
  ledger: LedgerRepository,
  rounds: HiLoRoundRepository,
  input: StartHiLoRoundInput,
): Promise<HiLoRound> {
  assertValidStartInput(input);

  const existing = await rounds.load(input.roundId);
  if (existing !== null) return existing;

  await recordBetStake(ledger, {
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    stake: input.stake,
    currency: input.currency,
    betId: input.roundId,
    metadata: { ...(input.metadata ?? {}), game: 'hi-lo' },
  });

  // Draw the starting card (drawIndex 0).
  const { rank: startRank } = deriveHiLoCard(input.serverSeed, input.clientSeed, input.nonce, 0);

  const now = new Date();
  const round: HiLoRound = {
    roundId: input.roundId,
    userAccountId: input.userAccountId,
    escrowAccountId: input.escrowAccountId,
    houseAccountId: input.houseAccountId,
    stake: input.stake,
    currency: input.currency,
    serverSeed: input.serverSeed,
    clientSeed: input.clientSeed,
    nonce: input.nonce,
    cards: [startRank],
    picks: [],
    currentMultiplier: 1.0,
    state: 'active',
    payout: null,
    createdAt: now,
    updatedAt: now,
    metadata: { ...(input.metadata ?? {}) },
  };
  await rounds.create(round);
  return round;
}

async function loadActive(rounds: HiLoRoundRepository, roundId: string): Promise<HiLoRound> {
  const round = await rounds.load(roundId);
  if (round === null) throw new RoundNotFoundError(roundId);
  if (round.state !== 'active') {
    throw new HiLoValidationError(`round in state '${round.state}' has no actions`);
  }
  return round;
}

/**
 * Player makes a pick. Engine draws the next card and updates the round.
 * If the pick wins → multiplier grows, round stays active (or auto-busts on
 * MAX_PICKS reached). If the pick loses → round busted.
 */
export async function pick(
  ledger: LedgerRepository,
  rounds: HiLoRoundRepository,
  roundId: string,
  pickType: HiLoPick,
): Promise<HiLoRound> {
  const round = await loadActive(rounds, roundId);
  const pickU = pickType as unknown as string;
  if (pickU !== 'higher_or_equal' && pickU !== 'lower_or_equal') {
    throw new HiLoValidationError("pick must be 'higher_or_equal' or 'lower_or_equal'");
  }
  if (round.picks.length >= MAX_PICKS) {
    throw new HiLoValidationError(`max picks (${String(MAX_PICKS)}) reached`);
  }

  const currentRank = round.cards[round.cards.length - 1];
  /* v8 ignore next 1 -- always present after start */
  if (currentRank === undefined) throw new Error('invariant: no current card');

  // Reject picks that aren't available at this rank.
  if (!availablePicks(currentRank).includes(pickType)) {
    throw new HiLoValidationError(
      `pick '${pickType}' is not available at rank ${String(currentRank)}`,
    );
  }

  const { rank: nextRank } = deriveHiLoCard(
    round.serverSeed,
    round.clientSeed,
    round.nonce,
    round.cards.length,
  );

  const probability = pickProbability(currentRank, pickType);
  const stepMul = pickMultiplier(probability);
  const won = isWinningPick(currentRank, nextRank, pickType);

  const newCards = [...round.cards, nextRank];
  const newPicks = [...round.picks, pickType];

  if (!won) {
    // Bust: settle as full loss.
    await recordBetLoss(ledger, {
      escrowAccountId: round.escrowAccountId,
      houseAccountId: round.houseAccountId,
      stake: round.stake,
      currency: round.currency,
      betId: round.roundId,
      metadata: { ...round.metadata, game: 'hi-lo', reason: 'bust', cards: newCards },
    });
    const updated: HiLoRound = {
      ...round,
      cards: newCards,
      picks: newPicks,
      state: 'busted',
      payout: 0n,
      updatedAt: new Date(),
    };
    await rounds.update(updated);
    return updated;
  }

  // Won the pick. Multiplier grows.
  const newMultiplier = round.currentMultiplier * stepMul;
  const updated: HiLoRound = {
    ...round,
    cards: newCards,
    picks: newPicks,
    currentMultiplier: newMultiplier,
    updatedAt: new Date(),
  };
  await rounds.update(updated);
  return updated;
}

export async function cashOut(
  ledger: LedgerRepository,
  rounds: HiLoRoundRepository,
  roundId: string,
): Promise<HiLoRound> {
  const round = await loadActive(rounds, roundId);
  if (round.picks.length === 0) {
    throw new HiLoValidationError('cannot cash out before making a pick');
  }
  const payout = computePayout(round.stake, round.currentMultiplier);
  /* v8 ignore next 5 -- defence in depth */
  if (payout > MAX_PAYOUT) {
    throw new HiLoValidationError(`payout ${payout.toString()} exceeds MAX_PAYOUT`);
  }
  await ((): Promise<unknown> => {
    if (payout > round.stake) {
      return recordBetWin(ledger, {
        userAccountId: round.userAccountId,
        escrowAccountId: round.escrowAccountId,
        houseAccountId: round.houseAccountId,
        stake: round.stake,
        payout,
        currency: round.currency,
        betId: round.roundId,
        metadata: {
          ...round.metadata,
          game: 'hi-lo',
          finalMultiplier: round.currentMultiplier,
          cards: [...round.cards],
        },
      });
    }
    if (payout === round.stake) {
      return recordBetRefund(ledger, {
        userAccountId: round.userAccountId,
        escrowAccountId: round.escrowAccountId,
        stake: round.stake,
        currency: round.currency,
        betId: round.roundId,
        reason: 'hi-lo-push',
        metadata: {
          ...round.metadata,
          game: 'hi-lo',
          finalMultiplier: round.currentMultiplier,
        },
      });
    }
    // payout < stake — partial payout
    return recordBetPartialPayout(ledger, {
      userAccountId: round.userAccountId,
      escrowAccountId: round.escrowAccountId,
      houseAccountId: round.houseAccountId,
      stake: round.stake,
      payout,
      currency: round.currency,
      betId: round.roundId,
      metadata: {
        ...round.metadata,
        game: 'hi-lo',
        finalMultiplier: round.currentMultiplier,
      },
    });
  })();
  const updated: HiLoRound = {
    ...round,
    state: 'cashed_out',
    payout,
    updatedAt: new Date(),
  };
  await rounds.update(updated);
  return updated;
}
