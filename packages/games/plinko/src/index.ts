// packages/games/plinko/src/index.ts
//
// @solsticebet/game-plinko — Plinko game engine.
// See docs/PLINKO.md.

export { placePlinkoBet } from './engine.js';

export { binomial, computePayout, multiplierForBucket, rtpFor } from './math.js';

export { getTable, maxMultiplier } from './tables.js';

export {
  assertValidBetInput,
  assertValidRisk,
  assertValidRows,
  assertValidStake,
  MAX_PAYOUT,
  MAX_STAKE,
  MIN_STAKE,
  PlinkoValidationError,
  RISK_VALUES,
  ROWS_VALUES,
} from './limits.js';

export type { PlinkoBetInput, PlinkoBetOutcome, PlinkoRisk, PlinkoRows } from './types.js';
