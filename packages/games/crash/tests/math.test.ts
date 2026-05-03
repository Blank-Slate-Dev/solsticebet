// packages/games/crash/tests/math.test.ts

import { describe, expect, it } from 'vitest';

import { computePayout, isWinningBet } from '../src/math.js';

describe('computePayout', () => {
  const ONE = 10n ** 18n;

  it('1 stake × 2.00 = 2', () => {
    expect(computePayout(ONE, 2.0)).toBe(2n * ONE);
  });

  it('1 stake × 1.50 = 1.5', () => {
    expect(computePayout(ONE, 1.5)).toBe(1500000000000000000n);
  });

  it('100 stake × 1.98 = 198', () => {
    expect(computePayout(ONE * 100n, 1.98)).toBe(198n * ONE);
  });

  it('1 stake × 100 = 100', () => {
    expect(computePayout(ONE, 100)).toBe(100n * ONE);
  });

  it('rejects non-positive stake', () => {
    expect(() => computePayout(0n, 2)).toThrow();
    expect(() => computePayout(-1n, 2)).toThrow();
  });

  it('rejects non-positive multiplier', () => {
    expect(() => computePayout(ONE, 0)).toThrow();
    expect(() => computePayout(ONE, -1)).toThrow();
    expect(() => computePayout(ONE, Number.NaN)).toThrow();
    expect(() => computePayout(ONE, Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('isWinningBet', () => {
  it('wins when bust >= autoCashOut', () => {
    expect(isWinningBet(2.0, 2.0)).toBe(true); // exact equality wins
    expect(isWinningBet(3.0, 2.0)).toBe(true);
    expect(isWinningBet(100, 1.5)).toBe(true);
  });
  it('loses when bust < autoCashOut', () => {
    expect(isWinningBet(1.99, 2.0)).toBe(false);
    expect(isWinningBet(1.0, 2.0)).toBe(false);
    expect(isWinningBet(1.0, 1.01)).toBe(false);
  });
});
