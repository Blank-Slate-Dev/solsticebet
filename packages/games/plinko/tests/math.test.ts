// packages/games/plinko/tests/math.test.ts

import { describe, expect, it } from 'vitest';

import { binomial, computePayout, multiplierForBucket, rtpFor } from '../src/math.js';
import { getTable, maxMultiplier } from '../src/tables.js';
import { ROWS_VALUES, RISK_VALUES } from '../src/limits.js';

describe('binomial', () => {
  it('matches known values', () => {
    expect(binomial(8, 0)).toBe(1);
    expect(binomial(8, 8)).toBe(1);
    expect(binomial(8, 4)).toBe(70);
    expect(binomial(12, 6)).toBe(924);
    expect(binomial(16, 8)).toBe(12870);
  });

  it('returns 0 for out-of-bounds k', () => {
    expect(binomial(5, -1)).toBe(0);
    expect(binomial(5, 6)).toBe(0);
  });

  it('is symmetric: C(n, k) === C(n, n-k)', () => {
    for (let n = 0; n <= 20; n++) {
      for (let k = 0; k <= n; k++) {
        expect(binomial(n, k)).toBe(binomial(n, n - k));
      }
    }
  });
});

describe('getTable', () => {
  it('returns a table of length rows + 1 for every (rows, risk)', () => {
    for (const rows of ROWS_VALUES) {
      for (const risk of RISK_VALUES) {
        const t = getTable(rows, risk);
        expect(t).toHaveLength(rows + 1);
      }
    }
  });

  it('is symmetric: table[k] === table[rows - k]', () => {
    for (const rows of ROWS_VALUES) {
      for (const risk of RISK_VALUES) {
        const t = getTable(rows, risk);
        for (let k = 0; k <= rows; k++) {
          expect(t[k]).toBe(t[rows - k]);
        }
      }
    }
  });

  it('has the highest multipliers at the edges (high risk only)', () => {
    // For high risk, table[0] should be the largest entry.
    for (const rows of ROWS_VALUES) {
      const t = getTable(rows, 'high');
      const max = Math.max(...t);
      expect(t[0]).toBe(max);
    }
  });

  it('all multipliers are non-negative', () => {
    for (const rows of ROWS_VALUES) {
      for (const risk of RISK_VALUES) {
        for (const m of getTable(rows, risk)) {
          expect(m).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('rtpFor', () => {
  it('every (rows, risk) configuration has RTP within [0.985, 1.0]', () => {
    for (const rows of ROWS_VALUES) {
      for (const risk of RISK_VALUES) {
        const rtp = rtpFor(rows, risk);
        expect(rtp).toBeGreaterThanOrEqual(0.985);
        expect(rtp).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it('matches known computed values for spot-checks', () => {
    expect(rtpFor(8, 'low')).toBeCloseTo(0.9898, 3);
    expect(rtpFor(16, 'high')).toBeCloseTo(0.9898, 3);
    expect(rtpFor(12, 'medium')).toBeCloseTo(0.9899, 3);
  });
});

describe('multiplierForBucket', () => {
  it('matches the table at every bucket', () => {
    for (const rows of ROWS_VALUES) {
      for (const risk of RISK_VALUES) {
        const t = getTable(rows, risk);
        for (let k = 0; k <= rows; k++) {
          expect(multiplierForBucket(rows, risk, k)).toBe(t[k]);
        }
      }
    }
  });

  it('rejects out-of-range bucket', () => {
    expect(() => multiplierForBucket(8, 'low', -1)).toThrow();
    expect(() => multiplierForBucket(8, 'low', 9)).toThrow();
    expect(() => multiplierForBucket(16, 'high', 17)).toThrow();
  });

  it('rejects fractional bucket', () => {
    expect(() => multiplierForBucket(8, 'low', 4.5)).toThrow();
  });
});

describe('maxMultiplier', () => {
  it('returns the table maximum', () => {
    for (const rows of ROWS_VALUES) {
      for (const risk of RISK_VALUES) {
        const expected = Math.max(...getTable(rows, risk));
        expect(maxMultiplier(rows, risk)).toBe(expected);
      }
    }
  });

  it('matches the documented headline values', () => {
    expect(maxMultiplier(8, 'high')).toBe(29);
    expect(maxMultiplier(12, 'high')).toBe(170);
    expect(maxMultiplier(16, 'high')).toBe(1000);
    expect(maxMultiplier(8, 'low')).toBe(5.6);
    expect(maxMultiplier(16, 'low')).toBe(16);
  });
});

describe('computePayout', () => {
  const ONE = 10n ** 18n;

  it('1 stake × 5.6 = 5.6', () => {
    expect(computePayout(ONE, 5.6)).toBe(5600000000000000000n);
  });

  it('1 stake × 0.5 = 0.5 (partial payback)', () => {
    expect(computePayout(ONE, 0.5)).toBe(500000000000000000n);
  });

  it('1 stake × 1000 = 1000', () => {
    expect(computePayout(ONE, 1000)).toBe(1000n * ONE);
  });

  it('rejects non-positive stake', () => {
    expect(() => computePayout(0n, 1)).toThrow();
    expect(() => computePayout(-1n, 1)).toThrow();
  });

  it('rejects negative or non-finite multiplier', () => {
    expect(() => computePayout(ONE, -1)).toThrow();
    expect(() => computePayout(ONE, Number.NaN)).toThrow();
    expect(() => computePayout(ONE, Number.POSITIVE_INFINITY)).toThrow();
  });

  it('multiplier === 0 yields zero payout (allowed by computePayout)', () => {
    expect(computePayout(ONE, 0)).toBe(0n);
  });
});
