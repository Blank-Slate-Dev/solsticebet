// packages/games/baccarat/tests/math.test.ts

import { describe, expect, it } from 'vitest';

import { computePayout, PAYOUTS } from '../src/math.js';

describe('PAYOUTS', () => {
  it('player 1:1', () => {
    expect(PAYOUTS.player).toBe(1);
  });
  it('banker 0.95:1 (5% commission)', () => {
    expect(PAYOUTS.banker).toBe(0.95);
  });
  it('tie 8:1', () => {
    expect(PAYOUTS.tie).toBe(8);
  });
});

describe('computePayout', () => {
  const ONE = 10n ** 18n;

  it('player win pays 2× stake', () => {
    expect(computePayout(ONE, 'player')).toBe(2n * ONE);
  });

  it('banker win pays 1.95× stake (commission baked in)', () => {
    // 1 × 1.95 = 1.95 → at SCALE → 1950000000000000000
    expect(computePayout(ONE, 'banker')).toBe(1950000000000000000n);
  });

  it('tie win pays 9× stake', () => {
    expect(computePayout(ONE, 'tie')).toBe(9n * ONE);
  });

  it('larger stake scales linearly', () => {
    expect(computePayout(ONE * 100n, 'player')).toBe(200n * ONE);
    expect(computePayout(ONE * 100n, 'banker')).toBe(195n * ONE);
    expect(computePayout(ONE * 100n, 'tie')).toBe(900n * ONE);
  });

  it('rejects non-positive stake', () => {
    expect(() => computePayout(0n, 'player')).toThrow();
    expect(() => computePayout(-1n, 'banker')).toThrow();
  });
});
