// packages/games/dice/tests/math.test.ts

import { describe, expect, it } from 'vitest';

import {
  computeMultiplier,
  computePayout,
  expectedRtp,
  HOUSE_EDGE,
  isWinningRoll,
  MULTIPLIER_NUMERATOR,
  winChancePercent,
} from '../src/math.js';

describe('HOUSE_EDGE constants', () => {
  it('HOUSE_EDGE is 1%', () => {
    expect(HOUSE_EDGE).toBe(0.01);
  });

  it('MULTIPLIER_NUMERATOR is 99', () => {
    expect(MULTIPLIER_NUMERATOR).toBe(99);
  });
});

describe('winChancePercent', () => {
  it('under: T → T', () => {
    expect(winChancePercent(50, 'under')).toBe(50);
    expect(winChancePercent(2, 'under')).toBe(2);
    expect(winChancePercent(98, 'under')).toBe(98);
  });

  it('over: T → 100 - T', () => {
    expect(winChancePercent(50, 'over')).toBe(50);
    expect(winChancePercent(2, 'over')).toBe(98);
    expect(winChancePercent(98, 'over')).toBe(2);
  });

  it('rejects target <= 0', () => {
    expect(() => winChancePercent(0, 'under')).toThrow(/target/);
    expect(() => winChancePercent(-1, 'under')).toThrow(/target/);
  });

  it('rejects target >= 100', () => {
    expect(() => winChancePercent(100, 'under')).toThrow(/target/);
    expect(() => winChancePercent(100.5, 'under')).toThrow(/target/);
  });

  it('rejects non-finite target', () => {
    expect(() => winChancePercent(Number.NaN, 'under')).toThrow(/target/);
    expect(() => winChancePercent(Number.POSITIVE_INFINITY, 'over')).toThrow(/target/);
  });
});

describe('computeMultiplier', () => {
  it('matches the spec table', () => {
    // From docs/DICE.md § 2.3
    expect(computeMultiplier(50, 'under')).toBe(1.98);
    expect(computeMultiplier(50, 'over')).toBe(1.98);
    expect(computeMultiplier(25, 'under')).toBe(3.96);
    expect(computeMultiplier(75, 'over')).toBe(3.96);
    expect(computeMultiplier(10, 'under')).toBe(9.9);
    expect(computeMultiplier(90, 'over')).toBe(9.9);
    expect(computeMultiplier(2, 'under')).toBe(49.5);
    expect(computeMultiplier(98, 'over')).toBe(49.5);
  });

  it('is symmetric: under(T) === over(100-T)', () => {
    for (const t of [2, 5, 10, 25, 50, 75, 90, 98]) {
      expect(computeMultiplier(t, 'under')).toBe(computeMultiplier(100 - t, 'over'));
    }
  });

  it('decreases monotonically as winChance increases (under)', () => {
    let prev = Infinity;
    for (let t = 2; t <= 98; t += 1) {
      const m = computeMultiplier(t, 'under');
      expect(m).toBeLessThanOrEqual(prev);
      prev = m;
    }
  });

  it('rounds to 4 decimal places', () => {
    // 99 / 33 = 3.0 exactly; 99 / 7 ≈ 14.142857... should round to 14.1429
    expect(computeMultiplier(33, 'under')).toBe(3);
    expect(computeMultiplier(7, 'under')).toBe(14.1429);
  });
});

describe('isWinningRoll', () => {
  it('under: roll < target wins', () => {
    expect(isWinningRoll(49.99, 50, 'under')).toBe(true);
    expect(isWinningRoll(0, 50, 'under')).toBe(true);
    expect(isWinningRoll(50, 50, 'under')).toBe(false); // equality is loss
    expect(isWinningRoll(50.01, 50, 'under')).toBe(false);
    expect(isWinningRoll(99.99, 50, 'under')).toBe(false);
  });

  it('over: roll > target wins', () => {
    expect(isWinningRoll(50.01, 50, 'over')).toBe(true);
    expect(isWinningRoll(99.99, 50, 'over')).toBe(true);
    expect(isWinningRoll(50, 50, 'over')).toBe(false); // equality is loss
    expect(isWinningRoll(49.99, 50, 'over')).toBe(false);
    expect(isWinningRoll(0, 50, 'over')).toBe(false);
  });

  it('rejects non-finite roll as a loss (defensive)', () => {
    expect(isWinningRoll(Number.NaN, 50, 'under')).toBe(false);
    expect(isWinningRoll(Number.POSITIVE_INFINITY, 50, 'under')).toBe(false);
  });
});

describe('computePayout', () => {
  // Recall: stake/payout are bigints with 18 implied decimal places.
  // 10n^18n = 1.0 INTERNAL_USDT.
  const ONE = 10n ** 18n;

  it('1 stake × 1.98 multiplier = 1.98', () => {
    // 1 * 1.98 = 1.98 → at SCALE_FACTOR → 1980000000000000000
    expect(computePayout(ONE, 1.98)).toBe(1980000000000000000n);
  });

  it('100 stake × 1.98 = 198', () => {
    expect(computePayout(ONE * 100n, 1.98)).toBe(198n * ONE);
  });

  it('1 stake × 49.5 = 49.5', () => {
    expect(computePayout(ONE, 49.5)).toBe(49500000000000000000n);
  });

  it('rejects non-positive stake', () => {
    expect(() => computePayout(0n, 1.98)).toThrow(/stake/);
    expect(() => computePayout(-1n, 1.98)).toThrow(/stake/);
  });

  it('rejects non-positive or non-finite multiplier', () => {
    expect(() => computePayout(ONE, 0)).toThrow();
    expect(() => computePayout(ONE, -1)).toThrow();
    expect(() => computePayout(ONE, Number.NaN)).toThrow();
    expect(() => computePayout(ONE, Number.POSITIVE_INFINITY)).toThrow();
  });

  it('floors to 18 decimal places', () => {
    // A small stake at high multiplier should not produce fractions of 1 unit.
    // 1 unit (smallest representable) × 1.5 = 1.5, floored = 1
    expect(computePayout(1n, 1.5)).toBe(1n);
    // 1 unit × 0.5 wouldn't actually pay out (loss path), but floor gives 0
    expect(computePayout(1n, 0.5)).toBe(0n);
  });
});

describe('expectedRtp', () => {
  it('always returns 99% within float precision, regardless of target/mode', () => {
    for (const target of [2, 5, 10, 25, 33, 50, 67, 75, 90, 95, 98]) {
      for (const mode of ['under', 'over'] as const) {
        const rtp = expectedRtp(target, mode);
        expect(rtp).toBeGreaterThan(0.989);
        expect(rtp).toBeLessThan(0.991);
      }
    }
  });

  it('a roll-the-table simulation converges to 99% RTP (deterministic)', () => {
    // Simulate the full population of possible rolls (0.00 .. 99.99 in 0.01 steps).
    // For under-50: 5000 rolls win at 1.98×; 5000 rolls lose at 0×.
    // RTP = (5000 / 10000) * 1.98 = 0.99 = 99%.
    const target = 50;
    const mode = 'under' as const;
    const m = computeMultiplier(target, mode);
    let totalReturn = 0;
    let count = 0;
    for (let r = 0; r < 10000; r++) {
      const roll = r / 100;
      const won = isWinningRoll(roll, target, mode);
      totalReturn += won ? m : 0;
      count += 1;
    }
    const rtp = totalReturn / count;
    // Within float-precision drift across 10000 accumulations.
    expect(rtp).toBeCloseTo(0.99, 6);
  });
});
