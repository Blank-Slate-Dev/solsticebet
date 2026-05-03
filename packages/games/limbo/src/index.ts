// packages/games/limbo/src/index.ts

export { placeLimboBet } from './engine.js';
export {
  assertValidBetInput,
  LimboValidationError,
  MAX_PAYOUT,
  MAX_STAKE,
  MAX_TARGET,
  MIN_STAKE,
  MIN_TARGET,
} from './limits.js';
export type { LimboBetInput, LimboBetOutcome } from './types.js';
