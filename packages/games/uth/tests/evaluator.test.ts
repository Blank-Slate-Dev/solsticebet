// packages/games/uth/tests/evaluator.test.ts

import { describe, expect, it } from 'vitest';

import type { UthCard } from '@solsticebet/rng';

import { bestOfSeven, evaluateFive } from '../src/evaluator.js';

const c = (rank: number, suit: number): UthCard => ({ rank, suit });

describe('evaluateFive — hand classification', () => {
  it('royal flush', () => {
    // 10, J, Q, K, A all hearts (suit 0)
    const h = evaluateFive([c(9, 0), c(10, 0), c(11, 0), c(12, 0), c(0, 0)]);
    expect(h.rank).toBe('royal_flush');
  });

  it('straight flush (not royal)', () => {
    // 5,6,7,8,9 of hearts
    const h = evaluateFive([c(4, 0), c(5, 0), c(6, 0), c(7, 0), c(8, 0)]);
    expect(h.rank).toBe('straight_flush');
  });

  it('wheel straight flush (A-2-3-4-5)', () => {
    const h = evaluateFive([c(0, 0), c(1, 0), c(2, 0), c(3, 0), c(4, 0)]);
    expect(h.rank).toBe('straight_flush');
  });

  it('four of a kind', () => {
    const h = evaluateFive([c(8, 0), c(8, 1), c(8, 2), c(8, 3), c(0, 0)]);
    expect(h.rank).toBe('four_kind');
  });

  it('full house (three Aces over pair Kings)', () => {
    const h = evaluateFive([c(0, 0), c(0, 1), c(0, 2), c(12, 0), c(12, 1)]);
    expect(h.rank).toBe('full_house');
  });

  it('flush (5 of one suit, not consecutive)', () => {
    // 2,5,8,J,K all hearts
    const h = evaluateFive([c(1, 0), c(4, 0), c(7, 0), c(10, 0), c(12, 0)]);
    expect(h.rank).toBe('flush');
  });

  it('straight (mixed suits)', () => {
    const h = evaluateFive([c(4, 0), c(5, 1), c(6, 2), c(7, 3), c(8, 0)]);
    expect(h.rank).toBe('straight');
  });

  it('wheel straight A-2-3-4-5 (mixed suits)', () => {
    const h = evaluateFive([c(0, 0), c(1, 1), c(2, 2), c(3, 3), c(4, 0)]);
    expect(h.rank).toBe('straight');
  });

  it('three of a kind', () => {
    const h = evaluateFive([c(8, 0), c(8, 1), c(8, 2), c(2, 0), c(12, 0)]);
    expect(h.rank).toBe('three_kind');
  });

  it('two pair', () => {
    const h = evaluateFive([c(8, 0), c(8, 1), c(2, 0), c(2, 1), c(12, 0)]);
    expect(h.rank).toBe('two_pair');
  });

  it('pair', () => {
    const h = evaluateFive([c(8, 0), c(8, 1), c(2, 0), c(5, 1), c(12, 0)]);
    expect(h.rank).toBe('pair');
  });

  it('high card', () => {
    const h = evaluateFive([c(0, 0), c(2, 1), c(5, 2), c(8, 3), c(11, 0)]);
    expect(h.rank).toBe('high_card');
  });

  it('rejects non-5 input', () => {
    expect(() => evaluateFive([c(0, 0)])).toThrow();
    expect(() => evaluateFive([c(0, 0), c(1, 0), c(2, 0), c(3, 0), c(4, 0), c(5, 0)])).toThrow();
  });
});

describe('evaluateFive — tie breaking', () => {
  it('higher pair beats lower pair', () => {
    const high = evaluateFive([c(11, 0), c(11, 1), c(2, 0), c(5, 1), c(8, 0)]); // QQ
    const low = evaluateFive([c(8, 0), c(8, 1), c(2, 0), c(5, 1), c(11, 0)]); // 99 with Q kicker
    expect(high.score).toBeGreaterThan(low.score);
  });

  it('higher straight beats lower straight', () => {
    const high = evaluateFive([c(8, 0), c(9, 1), c(10, 2), c(11, 3), c(12, 0)]); // 9-K
    const low = evaluateFive([c(4, 0), c(5, 1), c(6, 2), c(7, 3), c(8, 0)]); // 5-9
    expect(high.score).toBeGreaterThan(low.score);
  });

  it('A-high straight beats wheel', () => {
    const ahigh = evaluateFive([c(9, 0), c(10, 1), c(11, 2), c(12, 3), c(0, 0)]); // 10-A
    const wheel = evaluateFive([c(0, 0), c(1, 1), c(2, 2), c(3, 3), c(4, 0)]);
    expect(ahigh.score).toBeGreaterThan(wheel.score);
  });

  it('full house: higher trips wins', () => {
    const aces = evaluateFive([c(0, 0), c(0, 1), c(0, 2), c(12, 0), c(12, 1)]); // AAAKK
    const kings = evaluateFive([c(12, 0), c(12, 1), c(12, 2), c(0, 0), c(0, 1)]); // KKKAA
    expect(aces.score).toBeGreaterThan(kings.score);
  });
});

describe('bestOfSeven', () => {
  it('finds the best 5-card hand from 7 cards', () => {
    // Player has AA hole cards, community AAAQ X — gives AAAA quads
    const cards = [
      c(0, 0),
      c(0, 1), // hole: AA
      c(0, 2),
      c(0, 3),
      c(8, 0),
      c(11, 1),
      c(12, 2), // community: AA9QK
    ];
    const best = bestOfSeven(cards);
    expect(best.rank).toBe('four_kind');
  });

  it('finds a flush from mixed 7 cards', () => {
    const cards = [
      c(1, 0),
      c(4, 0), // hole: 2♥ 5♥
      c(7, 0),
      c(10, 0),
      c(12, 0),
      c(2, 1),
      c(5, 2), // community: 8♥ J♥ K♥ 3♣ 6♦
    ];
    const best = bestOfSeven(cards);
    expect(best.rank).toBe('flush');
  });

  it('rejects non-7 input', () => {
    expect(() => bestOfSeven([c(0, 0)])).toThrow();
  });
});
