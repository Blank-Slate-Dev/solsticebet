// packages/games/crash/src/index.ts
//
// @solsticebet/game-crash — Crash engine (single-player v1).
// See docs/CRASH.md.

export { placeCrashBet } from './engine.js';

export { computePayout, isWinningBet } from './math.js';

export {
  assertValidAutoCashOut,
  assertValidBetInput,
  assertValidStake,
  CrashValidationError,
  MAX_AUTO_CASHOUT,
  MAX_PAYOUT,
  MAX_STAKE,
  MIN_AUTO_CASHOUT,
  MIN_STAKE,
} from './limits.js';

export type { CrashBetInput, CrashBetOutcome } from './types.js';
