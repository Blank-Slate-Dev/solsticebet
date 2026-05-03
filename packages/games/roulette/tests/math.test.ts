// packages/games/roulette/tests/math.test.ts

import { describe, expect, it } from 'vitest';

import { computePayout, THEORETICAL_RTP } from '../src/math.js';

describe('computePayout', () => {
  const ONE = 10n ** 18n;

  it('straight: stake × 36 (35:1 + return stake)', () => {
    expect(computePayout(ONE, 'straight')).toBe(36n * ONE);
  });

  it('split: stake × 18', () => {
    expect(computePayout(ONE, 'split')).toBe(18n * ONE);
  });

  it('street: stake × 12', () => {
    expect(computePayout(ONE, 'street')).toBe(12n * ONE);
  });

  it('corner: stake × 9', () => {
    expect(computePayout(ONE, 'corner')).toBe(9n * ONE);
  });

  it('six_line: stake × 6', () => {
    expect(computePayout(ONE, 'six_line')).toBe(6n * ONE);
  });

  it('column / dozen: stake × 3', () => {
    expect(computePayout(ONE, 'column')).toBe(3n * ONE);
    expect(computePayout(ONE, 'dozen')).toBe(3n * ONE);
  });

  it('even-money: stake × 2', () => {
    for (const t of ['red', 'black', 'even', 'odd', 'low', 'high'] as const) {
      expect(computePayout(ONE, t)).toBe(2n * ONE);
    }
  });

  it('rejects non-positive stake', () => {
    expect(() => computePayout(0n, 'red')).toThrow();
    expect(() => computePayout(-1n, 'red')).toThrow();
  });
});

describe('THEORETICAL_RTP', () => {
  it('is 36/37', () => {
    expect(THEORETICAL_RTP).toBe(36 / 37);
  });
});
