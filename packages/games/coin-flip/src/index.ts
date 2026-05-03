// packages/games/coin-flip/src/index.ts
//
// @solsticebet/game-coin-flip — Coin flip. 1.96:1 payout, 2% house edge.

export { placeCoinFlipBet } from './engine.js';
export {
  assertValidBetInput,
  CoinFlipValidationError,
  MAX_PAYOUT,
  MAX_STAKE,
  MIN_STAKE,
  PAYOUT_MULTIPLIER,
} from './limits.js';
export type { CoinFlipBetInput, CoinFlipBetOutcome, CoinSide } from './types.js';
