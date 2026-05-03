// packages/games/blackjack/tests/math.test.ts

import { describe, expect, it } from 'vitest';

import { computeWinPayout } from '../src/math.js';

describe('computeWinPayout', () => {
  const ONE = 10n ** 18n;

  it('regular win pays 2× stake', () => {
    expect(computeWinPayout(ONE, false)).toBe(2n * ONE);
    expect(computeWinPayout(100n * ONE, false)).toBe(200n * ONE);
  });

  it('blackjack pays 2.5× stake (3:2)', () => {
    expect(computeWinPayout(ONE, true)).toBe(2500000000000000000n);
    expect(computeWinPayout(100n * ONE, true)).toBe(250n * ONE);
  });

  it('rejects non-positive stake', () => {
    expect(() => computeWinPayout(0n, false)).toThrow();
    expect(() => computeWinPayout(-1n, true)).toThrow();
  });
});
