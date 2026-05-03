// packages/rng/tests/games.test.ts

import { describe, expect, it } from 'vitest';

import {
  deriveBaccarat,
  deriveBlackjack,
  deriveDice,
  deriveMines,
  derivePlinko,
  deriveRoulette,
  MINES_TILE_COUNT,
  ROULETTE_POCKETS,
} from '../src/games.js';
import { generateServerSeed } from '../src/seed.js';

describe('deriveDice', () => {
  it('returns a roll in [0.00, 99.99]', () => {
    for (let n = 0; n < 1000; n++) {
      const { roll } = deriveDice('0'.repeat(64), 'dice-test', n);
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThanOrEqual(99.99);
    }
  });

  it('returns rolls quantised to 0.01', () => {
    for (let n = 0; n < 100; n++) {
      const { roll } = deriveDice('0'.repeat(64), 'q-test', n);
      // Multiply by 100 and check it's an integer (within float precision).
      const scaled = Math.round(roll * 100);
      expect(Math.abs(scaled / 100 - roll)).toBeLessThan(1e-9);
    }
  });

  it('is deterministic', () => {
    const a = deriveDice('0'.repeat(64), 'd-test', 42);
    const b = deriveDice('0'.repeat(64), 'd-test', 42);
    expect(a).toEqual(b);
  });

  it('different nonces produce different rolls (high probability)', () => {
    const rolls = new Set<number>();
    for (let n = 0; n < 100; n++) {
      rolls.add(deriveDice('0'.repeat(64), 'spread', n).roll);
    }
    // 100 samples from a 10000-bucket space — collisions are statistically rare.
    // Loosely: expect at least 95 unique values out of 100.
    expect(rolls.size).toBeGreaterThanOrEqual(95);
  });

  it('mean over a large sample is approximately 50 (uniform distribution)', () => {
    const seed = generateServerSeed();
    let sum = 0;
    const N = 5000;
    for (let n = 0; n < N; n++) {
      sum += deriveDice(seed, 'mean-test', n).roll;
    }
    const mean = sum / N;
    // Uniform [0, 100) has mean 49.995; allow ±1.5 for sample size.
    expect(mean).toBeGreaterThan(48.5);
    expect(mean).toBeLessThan(51.5);
  });
});

describe('deriveMines', () => {
  it('returns a permutation of [0, 25)', () => {
    const { tilePermutation } = deriveMines('0'.repeat(64), 'mines-test', 0);
    expect(tilePermutation).toHaveLength(MINES_TILE_COUNT);
    const sorted = [...tilePermutation].sort((a, b) => a - b);
    for (let i = 0; i < MINES_TILE_COUNT; i++) {
      expect(sorted[i]).toBe(i);
    }
  });

  it('is deterministic', () => {
    const a = deriveMines('0'.repeat(64), 'm-test', 7);
    const b = deriveMines('0'.repeat(64), 'm-test', 7);
    expect(a).toEqual(b);
  });

  it('different nonces produce different permutations (high probability)', () => {
    const seen = new Set<string>();
    for (let n = 0; n < 200; n++) {
      const { tilePermutation } = deriveMines('0'.repeat(64), 'spread', n);
      seen.add(tilePermutation.join(','));
    }
    // 200 samples from 25! permutations — collisions vanishingly unlikely.
    expect(seen.size).toBe(200);
  });

  it('first position is uniformly distributed across many samples', () => {
    // Run a large sample; count how often each tile shows up at index 0.
    // Each tile should appear ~1/25 of the time.
    const counts = new Array<number>(MINES_TILE_COUNT).fill(0);
    const N = 5000;
    const seed = generateServerSeed();
    for (let n = 0; n < N; n++) {
      const { tilePermutation } = deriveMines(seed, 'first-pos', n);
      const first = tilePermutation[0];
      if (first === undefined) throw new Error('unreachable');
      counts[first] = (counts[first] ?? 0) + 1;
    }
    const expected = N / MINES_TILE_COUNT;
    // Each bucket should land within ±35% of expected at this sample size.
    // (Loose tolerance to keep the test reliable; statistical correctness
    // is gated more strictly in the integration suite.)
    for (const c of counts) {
      expect(c).toBeGreaterThan(expected * 0.65);
      expect(c).toBeLessThan(expected * 1.35);
    }
  });
});

describe('derivePlinko', () => {
  it('default 8 rows: path length 8, bucket in [0, 8]', () => {
    const { path, bucket } = derivePlinko('0'.repeat(64), 'p', 0);
    expect(path).toHaveLength(8);
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThanOrEqual(8);
  });

  it('bucket equals number of "right" decisions', () => {
    const { path, bucket } = derivePlinko('0'.repeat(64), 'p', 5);
    const rightCount = path.filter((d) => d === 'right').length;
    expect(bucket).toBe(rightCount);
  });

  it('supports 12 and 16 row variants', () => {
    const r12 = derivePlinko('0'.repeat(64), 'p', 0, 12);
    expect(r12.path).toHaveLength(12);
    expect(r12.bucket).toBeGreaterThanOrEqual(0);
    expect(r12.bucket).toBeLessThanOrEqual(12);

    const r16 = derivePlinko('0'.repeat(64), 'p', 0, 16);
    expect(r16.path).toHaveLength(16);
    expect(r16.bucket).toBeGreaterThanOrEqual(0);
    expect(r16.bucket).toBeLessThanOrEqual(16);
  });

  it('is deterministic', () => {
    const a = derivePlinko('0'.repeat(64), 'p', 99);
    const b = derivePlinko('0'.repeat(64), 'p', 99);
    expect(a).toEqual(b);
  });

  it('bucket distribution is approximately binomial across many samples', () => {
    // For a fair Plinko with 8 rows, P(bucket = k) = C(8, k) / 256.
    // Bucket 4 is the mode at 70/256 ≈ 0.273.
    // We check that bucket 4 is the most common across a large sample.
    const N = 5000;
    const counts = new Array<number>(9).fill(0);
    const seed = generateServerSeed();
    for (let n = 0; n < N; n++) {
      const { bucket } = derivePlinko(seed, 'distribution', n);
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    // Mode should be at bucket 4 (or its immediate neighbours due to sampling).
    let max = 0;
    let argmax = -1;
    for (let i = 0; i < counts.length; i++) {
      const c = counts[i] ?? 0;
      if (c > max) {
        max = c;
        argmax = i;
      }
    }
    expect([3, 4, 5]).toContain(argmax);
  });
});

describe('deriveRoulette', () => {
  it('returns a result in [0, 36] inclusive', () => {
    for (let n = 0; n < 1000; n++) {
      const { result } = deriveRoulette('0'.repeat(64), 'roulette-test', n);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(ROULETTE_POCKETS);
    }
  });

  it('is deterministic', () => {
    const a = deriveRoulette('0'.repeat(64), 'r-test', 42);
    const b = deriveRoulette('0'.repeat(64), 'r-test', 42);
    expect(a).toEqual(b);
  });

  it('different nonces produce different outcomes (high probability)', () => {
    const seen = new Set<number>();
    for (let n = 0; n < 200; n++) {
      seen.add(deriveRoulette('0'.repeat(64), 'spread', n).result);
    }
    // 200 samples across 37 buckets — should hit at least 30 distinct values.
    expect(seen.size).toBeGreaterThan(30);
  });

  it('every pocket appears at roughly 1/37 frequency in a large sample', () => {
    const counts = new Array<number>(ROULETTE_POCKETS).fill(0);
    const N = 5000;
    for (let n = 0; n < N; n++) {
      const { result } = deriveRoulette('0'.repeat(64), 'distribution', n);
      counts[result] = (counts[result] ?? 0) + 1;
    }
    const expected = N / ROULETTE_POCKETS;
    // Each pocket should land within ±40% of expected at this sample size.
    for (const c of counts) {
      expect(c).toBeGreaterThan(expected * 0.6);
      expect(c).toBeLessThan(expected * 1.4);
    }
  });
});

describe('deriveBaccarat', () => {
  it('returns 6 cards, each a rank in [0, 13)', () => {
    const { cards } = deriveBaccarat('0'.repeat(64), 'baccarat-test', 0);
    expect(cards).toHaveLength(6);
    for (const c of cards) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(13);
    }
  });

  it('is deterministic', () => {
    const a = deriveBaccarat('0'.repeat(64), 'b-test', 42);
    const b = deriveBaccarat('0'.repeat(64), 'b-test', 42);
    expect(a).toEqual(b);
  });

  it('different nonces produce different deals', () => {
    const seen = new Set<string>();
    for (let n = 0; n < 100; n++) {
      const { cards } = deriveBaccarat('0'.repeat(64), 'b-spread', n);
      seen.add(cards.join(','));
    }
    // 100 samples from 13^6 = ~4.8M possible deals; collisions should be near zero.
    expect(seen.size).toBe(100);
  });

  it('rank distribution is roughly uniform over a large sample', () => {
    const counts = new Array<number>(13).fill(0);
    const N = 1000;
    for (let n = 0; n < N; n++) {
      const { cards } = deriveBaccarat('0'.repeat(64), 'b-dist', n);
      for (const c of cards) {
        counts[c] = (counts[c] ?? 0) + 1;
      }
    }
    // 6000 cards across 13 ranks; each rank expected ~462. Allow ±35%.
    const expected = (N * 6) / 13;
    for (const c of counts) {
      expect(c).toBeGreaterThan(expected * 0.65);
      expect(c).toBeLessThan(expected * 1.35);
    }
  });
});

describe('deriveBlackjack', () => {
  it('returns 32 cards, each a rank in [0, 13)', () => {
    const { cards } = deriveBlackjack('0'.repeat(64), 'bj-test', 0);
    expect(cards).toHaveLength(32);
    for (const c of cards) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(13);
    }
  });

  it('is deterministic', () => {
    const a = deriveBlackjack('0'.repeat(64), 'bj-test', 99);
    const b = deriveBlackjack('0'.repeat(64), 'bj-test', 99);
    expect(a).toEqual(b);
  });

  it('different nonces produce different deals', () => {
    const seen = new Set<string>();
    for (let n = 0; n < 50; n++) {
      const { cards } = deriveBlackjack('0'.repeat(64), 'bj-spread', n);
      seen.add(cards.join(','));
    }
    expect(seen.size).toBe(50);
  });
});
