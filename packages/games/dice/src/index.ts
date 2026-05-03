// packages/games/dice/src/index.ts
//
// @solsticebet/game-dice — Dice game engine.
// See docs/DICE.md for the spec.

export { placeDiceBet } from './engine.js';

export {
  computeMultiplier,
  computePayout,
  expectedRtp,
  HOUSE_EDGE,
  isWinningRoll,
  MULTIPLIER_NUMERATOR,
  winChancePercent,
} from './math.js';

export {
  assertValidBetInput,
  assertValidMode,
  assertValidStake,
  assertValidTarget,
  DiceValidationError,
  MAX_PAYOUT,
  MAX_STAKE,
  MAX_TARGET,
  MIN_STAKE,
  MIN_TARGET,
  MODES,
} from './limits.js';

export type { DiceBetInput, DiceBetOutcome, DiceMode } from './types.js';
