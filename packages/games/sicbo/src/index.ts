// packages/games/sicbo/src/index.ts
//
// @solsticebet/game-sicbo — Sic Bo engine.
// See docs/SICBO.md.

export { placeSicBoRoll } from './engine.js';

export {
  assertValidBet,
  assertValidRollInput,
  MAX_BETS_PER_ROLL,
  MAX_BET_STAKE,
  MAX_ROLL_PAYOUT,
  MAX_ROLL_STAKE,
  MIN_BET_STAKE,
  SicBoValidationError,
} from './limits.js';

export { computePayout } from './math.js';

export { FIXED_PAYOUTS, maxWinMultiplier, TOTAL_PAYOUTS, winMultiplierFor } from './wheel.js';

export type {
  SicBoBet,
  SicBoBetOutcome,
  SicBoBetType,
  SicBoRollInput,
  SicBoRollOutcome,
} from './types.js';
