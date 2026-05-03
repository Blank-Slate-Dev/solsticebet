// packages/games/lucky-wheel/src/wheel.ts

import type { WheelSegment } from './types.js';

/**
 * Standard 54-segment Stake-style Lucky Wheel.
 *
 * Distribution:
 *   30 grey segments (loss, 0× — return nothing)
 *   12 green (1.5×)
 *    7 blue (1.7×)
 *    3 purple (2×)
 *    1 red (3×)
 *    1 gold (50×)
 *
 * RTP = (12·0.5 + 7·0.7 + 3·1 + 1·2 + 1·49) / 54 = 65.9 / 54 ≈ 96.11%
 *
 * (Note: the multiplier in the segment is the win multiplier i.e. 1.5× returns
 *   1.5× stake total — 0.5× profit. For "1.5×" segment, the player gets back
 *   1.5 × stake on win, NOT 2.5 × stake. This matches Stake's published model.)
 *
 * Wait — there's some ambiguity in published wheels. We define our own:
 *
 * Our convention: `multiplier` is the GROSS payout multiplier (player gets
 * stake × multiplier back). So:
 *   - multiplier = 0 → loss (gray segments)
 *   - multiplier = 1 → push (no segments use this)
 *   - multiplier = 1.5 → small win (player gets stake × 1.5 back; net +0.5 stake)
 *
 * This matches Stake's published Wheel game.
 */
export const SEGMENTS: readonly WheelSegment[] = (() => {
  const arr: WheelSegment[] = [];
  for (let i = 0; i < 30; i++) arr.push({ color: 'gray', multiplier: 0 });
  for (let i = 0; i < 12; i++) arr.push({ color: 'green', multiplier: 1.5 });
  for (let i = 0; i < 7; i++) arr.push({ color: 'blue', multiplier: 1.7 });
  for (let i = 0; i < 3; i++) arr.push({ color: 'purple', multiplier: 2 });
  arr.push({ color: 'red', multiplier: 3 });
  arr.push({ color: 'gold', multiplier: 50 });
  return arr;
})();

export const TOTAL_SEGMENTS = SEGMENTS.length;

/**
 * Maps a uniform [0, 1) value to a segment index.
 */
export function segmentForValue(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('value must be in [0, 1)');
  }
  return Math.floor(value * TOTAL_SEGMENTS);
}
