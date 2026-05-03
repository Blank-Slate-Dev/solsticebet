// packages/games/baccarat/tests/cards.test.ts

import { describe, expect, it } from 'vitest';

import { handTotal, pointValueOf, RANKS } from '../src/cards.js';

describe('pointValueOf', () => {
  it('Ace (rank 0) is worth 1', () => {
    expect(pointValueOf(0)).toBe(1);
  });
  it('2..9 (ranks 1..8) are worth their face value', () => {
    expect(pointValueOf(1)).toBe(2);
    expect(pointValueOf(2)).toBe(3);
    expect(pointValueOf(3)).toBe(4);
    expect(pointValueOf(4)).toBe(5);
    expect(pointValueOf(5)).toBe(6);
    expect(pointValueOf(6)).toBe(7);
    expect(pointValueOf(7)).toBe(8);
    expect(pointValueOf(8)).toBe(9);
  });
  it('10/J/Q/K (ranks 9..12) are worth 0', () => {
    expect(pointValueOf(9)).toBe(0);
    expect(pointValueOf(10)).toBe(0);
    expect(pointValueOf(11)).toBe(0);
    expect(pointValueOf(12)).toBe(0);
  });
  it('rejects out-of-range ranks', () => {
    expect(() => pointValueOf(-1)).toThrow();
    expect(() => pointValueOf(13)).toThrow();
    expect(() => pointValueOf(1.5)).toThrow();
  });

  it('RANKS is 13', () => {
    expect(RANKS).toBe(13);
  });
});

describe('handTotal', () => {
  it('empty hand has total 0', () => {
    expect(handTotal([])).toBe(0);
  });
  it('sums two cards mod 10', () => {
    expect(handTotal([6, 7])).toBe((7 + 8) % 10); // 5
    expect(handTotal([4, 4])).toBe((5 + 5) % 10); // 0
  });
  it('three-card total still mod 10', () => {
    // 9 + 9 + 9 = 27 → 7
    expect(handTotal([8, 8, 8])).toBe(7);
  });
  it('faces (10/J/Q/K) contribute 0', () => {
    expect(handTotal([9, 10, 11])).toBe(0);
  });
  it('Ace + face = 1', () => {
    expect(handTotal([0, 9])).toBe(1);
  });
});
