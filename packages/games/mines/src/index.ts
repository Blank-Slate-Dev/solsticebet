// packages/games/mines/src/index.ts
//
// @solsticebet/game-mines — Mines game engine.
// See docs/MINES.md for the spec.

export { cashOut, revealTile, startRound } from './engine.js';

export {
  assertValidMineState,
  computePayout,
  fairMultiplier,
  HOUSE_EDGE,
  maxMultiplierFor,
  multiplierFor,
  TOTAL_TILES,
} from './math.js';

export {
  assertValidMineCount,
  assertValidStake,
  assertValidStartInput,
  assertValidTileIndex,
  GRID_SIZE,
  MAX_MINE_COUNT,
  MAX_PAYOUT,
  MAX_STAKE,
  MIN_MINE_COUNT,
  MIN_STAKE,
  MinesValidationError,
} from './limits.js';

export {
  DuplicateRoundError,
  InMemoryMinesRoundRepository,
  MinesRoundError,
  RoundNotFoundError,
} from './repository.js';
export type { MinesRoundRepository } from './repository.js';

export type {
  MinesActionOutcome,
  MinesRound,
  MinesRoundState,
  StartMinesRoundInput,
} from './types.js';
