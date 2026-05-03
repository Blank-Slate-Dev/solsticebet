// packages/games/baccarat/src/index.ts
//
// @solsticebet/game-baccarat — Punto Banco engine.
// See docs/BACCARAT.md.

export { handTotal, pointValueOf, RANKS } from './cards.js';

export { placeBaccaratCoup } from './engine.js';

export {
  assertValidBet,
  assertValidCoupInput,
  BaccaratValidationError,
  MAX_BETS_PER_COUP,
  MAX_BET_STAKE,
  MAX_COUP_PAYOUT,
  MAX_COUP_STAKE,
  MIN_BET_STAKE,
} from './limits.js';

export { computePayout, PAYOUTS } from './math.js';

export { playTableau } from './tableau.js';

export type {
  BaccaratBet,
  BaccaratBetOutcome,
  BaccaratBetState,
  BaccaratBetType,
  BaccaratCoupInput,
  BaccaratCoupOutcome,
  BaccaratDeal,
  BaccaratHand,
  BaccaratWinner,
} from './types.js';
