// packages/games/blackjack/src/index.ts
//
// @solsticebet/game-blackjack — Blackjack engine.
// See docs/BLACKJACK.md.

export { canSplit, cardValue, handTotal, isAce, isBlackjack, isTenValue, RANKS } from './cards.js';
export type { HandTotal } from './cards.js';

export { dealerShouldHit, playDealer } from './dealer.js';

export { doubleDown, hit, split, stand, startRound } from './engine.js';

export {
  assertValidStake,
  assertValidStartInput,
  BlackjackValidationError,
  MAX_HANDS,
  MAX_PAYOUT,
  MAX_STAKE,
  MAX_TOTAL_STAKE,
  MIN_STAKE,
} from './limits.js';

export { BLACKJACK_PAYOUT_MULTIPLIER, computeWinPayout } from './math.js';

export {
  BlackjackRoundError,
  DuplicateRoundError,
  InMemoryBlackjackRoundRepository,
  RoundNotFoundError,
} from './repository.js';
export type { BlackjackRoundRepository } from './repository.js';

export type {
  BlackjackAction,
  BlackjackActionOutcome,
  BlackjackDealerHand,
  BlackjackHand,
  BlackjackHandSettle,
  BlackjackHandState,
  BlackjackRound,
  BlackjackRoundState,
  StartBlackjackRoundInput,
} from './types.js';
