// packages/games/lucky-wheel/src/index.ts

export { placeLuckyWheelBet } from './engine.js';
export {
  assertValidBetInput,
  LuckyWheelValidationError,
  MAX_PAYOUT,
  MAX_STAKE,
  MIN_STAKE,
} from './limits.js';
export type { LuckyWheelBetInput, LuckyWheelBetOutcome, WheelSegment } from './types.js';
export { SEGMENTS, TOTAL_SEGMENTS, segmentForValue } from './wheel.js';
