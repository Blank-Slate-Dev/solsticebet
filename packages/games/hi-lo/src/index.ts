// packages/games/hi-lo/src/index.ts

export { cashOut, pick, startRound } from './engine.js';
export {
  assertValidStartInput,
  HiLoValidationError,
  MAX_PAYOUT,
  MAX_PICKS,
  MAX_STAKE,
  MIN_STAKE,
} from './limits.js';
export {
  availablePicks,
  computePayout,
  isWinningPick,
  pickMultiplier,
  pickProbability,
} from './math.js';
export {
  DuplicateRoundError,
  HiLoRoundError,
  InMemoryHiLoRoundRepository,
  RoundNotFoundError,
} from './repository.js';
export type { HiLoRoundRepository } from './repository.js';
export type { HiLoPick, HiLoRound, HiLoRoundState, StartHiLoRoundInput } from './types.js';
