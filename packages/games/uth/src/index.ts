// packages/games/uth/src/index.ts
//
// @solsticebet/game-uth — Ultimate Texas Hold'em engine.
// See docs/UTH.md.

export {
  checkFlop,
  checkPreflop,
  fold,
  raise1x,
  raise2x,
  raise3x,
  raise4x,
  startCoup,
} from './engine.js';

export { bestOfSeven, evaluateFive } from './evaluator.js';

export {
  assertValidAnte,
  assertValidStartInput,
  assertValidTrips,
  MAX_ANTE,
  MAX_COUP_PAYOUT,
  MAX_COUP_STAKE,
  MAX_TRIPS,
  MIN_ANTE,
  MIN_TRIPS,
  UthValidationError,
} from './limits.js';

export { BLIND_PAYTABLE, computePayout, TRIPS_PAYTABLE } from './math.js';

export {
  CoupNotFoundError,
  DuplicateCoupError,
  InMemoryUthCoupRepository,
  UthCoupError,
} from './repository.js';
export type { UthCoupRepository } from './repository.js';

export type {
  BetSettlement,
  BetState,
  HandRankName,
  HandScore,
  StartUthCoupInput,
  UthAction,
  UthCoup,
  UthPhase,
} from './types.js';
