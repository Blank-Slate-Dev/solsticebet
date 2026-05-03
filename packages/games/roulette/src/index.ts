// packages/games/roulette/src/index.ts
//
// @solsticebet/game-roulette — European Roulette engine.
// See docs/ROULETTE.md.

export { placeRouletteSpin } from './engine.js';

export { computePayout, THEORETICAL_RTP } from './math.js';

export {
  assertValidBet,
  assertValidSpinInput,
  MAX_BETS_PER_SPIN,
  MAX_BET_STAKE,
  MAX_SPIN_PAYOUT,
  MAX_SPIN_STAKE,
  MIN_BET_STAKE,
  RouletteValidationError,
} from './limits.js';

export { assertValidPocket, colorOf, columnOf, dozenOf, isWinningBet, PAYOUTS } from './wheel.js';

export type {
  PocketColor,
  RouletteBet,
  RouletteBetOutcome,
  RouletteBetType,
  RouletteSpinInput,
  RouletteSpinOutcome,
} from './types.js';
export { POCKETS } from './types.js';
