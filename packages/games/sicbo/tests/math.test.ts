// packages/games/sicbo/tests/math.test.ts

import { describe, expect, it } from 'vitest';

import { computePayout } from '../src/math.js';

describe('computePayout', () => {
  const ONE = 10n ** 18n;

  it('1 stake @ 1:1 = 2', () => {
    expect(computePayout(ONE, 1)).toBe(2n * ONE);
  });

  it('1 stake @ 60:1 (total 4 or 17) = 61', () => {
    expect(computePayout(ONE, 60)).toBe(61n * ONE);
  });

  it('1 stake @ 180:1 (specific triple) = 181', () => {
    expect(computePayout(ONE, 180)).toBe(181n * ONE);
  });

  it('1 stake @ 0 throws (caller should not call on losses)', () => {
    expect(computePayout(ONE, 0)).toBe(ONE);
  });

  it('rejects non-positive stake', () => {
    expect(() => computePayout(0n, 1)).toThrow();
    expect(() => computePayout(-1n, 1)).toThrow();
  });

  it('rejects non-integer / negative multiplier', () => {
    expect(() => computePayout(ONE, -1)).toThrow();
    expect(() => computePayout(ONE, 1.5)).toThrow();
    expect(() => computePayout(ONE, Number.NaN)).toThrow();
  });
});
