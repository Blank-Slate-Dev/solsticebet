// packages/games/mines/tests/math.test.ts

import { describe, expect, it } from 'vitest';

import {
  assertValidMineState,
  computePayout,
  fairMultiplier,
  HOUSE_EDGE,
  maxMultiplierFor,
  multiplierFor,
  TOTAL_TILES,
} from '../src/math.js';

describe('constants', () => {
  it('TOTAL_TILES is 25', () => {
    expect(TOTAL_TILES).toBe(25);
  });

  it('HOUSE_EDGE is 3%', () => {
    expect(HOUSE_EDGE).toBe(0.03);
  });
});

describe('fairMultiplier', () => {
  it('1 mine, 1 reveal: 25/24 ≈ 1.0417', () => {
    expect(fairMultiplier(1, 1)).toBeCloseTo(25 / 24, 6);
  });

  it('1 mine, 24 reveals: 25/1 = 25', () => {
    expect(fairMultiplier(1, 24)).toBeCloseTo(25, 6);
  });

  it('24 mines, 1 reveal: 25/1 = 25', () => {
    expect(fairMultiplier(24, 1)).toBeCloseTo(25, 6);
  });

  it('strictly increases with each safe reveal (M=3)', () => {
    let prev = 0;
    for (let n = 1; n <= 22; n++) {
      const m = fairMultiplier(3, n);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
  });

  it('strictly increases with mine count at fixed N=1', () => {
    let prev = 0;
    for (let mines = 1; mines <= 24; mines++) {
      const m = fairMultiplier(mines, 1);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
  });

  it('M=1, N=1: matches docs/MINES.md spec table (1.0417)', () => {
    expect(fairMultiplier(1, 1)).toBeCloseTo(1.0417, 4);
  });

  it('M=12, N=1: 25/13 ≈ 1.9231', () => {
    expect(fairMultiplier(12, 1)).toBeCloseTo(1.9231, 4);
  });
});

describe('multiplierFor', () => {
  it('returns 1.0 with no reveals', () => {
    for (let m = 1; m <= 24; m++) {
      expect(multiplierFor(m, 0)).toBe(1.0);
    }
  });

  it('applies the 3% house edge', () => {
    // M=1, N=1: fair = 25/24 ≈ 1.04167; with edge = 0.97 × 1.04167 ≈ 1.0104
    expect(multiplierFor(1, 1)).toBe(1.0104);
  });

  it('matches the docs/MINES.md spec table (M=1, N=24)', () => {
    // fair = 25; with edge = 24.25
    expect(multiplierFor(1, 24)).toBe(24.25);
  });

  it('matches the docs/MINES.md spec table (M=24, N=1)', () => {
    expect(multiplierFor(24, 1)).toBe(24.25);
  });

  it('rounds to 4 decimal places', () => {
    // For any (M, N), result should have at most 4 decimal places.
    // Allow tiny float-precision drift (well under one ULP at the relevant scale).
    for (let m = 1; m <= 24; m++) {
      for (let n = 0; n <= TOTAL_TILES - m; n++) {
        const v = multiplierFor(m, n);
        const scaled = v * 10000;
        expect(Math.abs(scaled - Math.round(scaled))).toBeLessThan(1e-6);
      }
    }
  });

  it('strictly increases with each safe reveal (M=5)', () => {
    let prev = 0;
    for (let n = 1; n <= 20; n++) {
      const m = multiplierFor(5, n);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
  });
});

describe('maxMultiplierFor', () => {
  it('M=1: max is 24.25× (revealing 24 safe tiles)', () => {
    expect(maxMultiplierFor(1)).toBe(24.25);
  });

  it('M=24: max is 24.25× (revealing the single safe tile)', () => {
    expect(maxMultiplierFor(24)).toBe(24.25);
  });

  it('grows enormously for medium mine counts', () => {
    // M=12, N=13 max safe: enormous multiplier (millions)
    expect(maxMultiplierFor(12)).toBeGreaterThan(1000);
  });
});

describe('computePayout', () => {
  const ONE = 10n ** 18n;

  it('1 stake × 1.98 = 1.98', () => {
    expect(computePayout(ONE, 1.98)).toBe(1980000000000000000n);
  });

  it('100 stake × 24.25 = 2425', () => {
    expect(computePayout(ONE * 100n, 24.25)).toBe(2425n * ONE);
  });

  it('rejects non-positive stake', () => {
    expect(() => computePayout(0n, 1.98)).toThrow();
    expect(() => computePayout(-1n, 1.98)).toThrow();
  });

  it('rejects non-positive multiplier', () => {
    expect(() => computePayout(ONE, 0)).toThrow();
    expect(() => computePayout(ONE, -1)).toThrow();
    expect(() => computePayout(ONE, Number.NaN)).toThrow();
    expect(() => computePayout(ONE, Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('assertValidMineState', () => {
  it('accepts in-bounds (mineCount, safeRevealed)', () => {
    expect(() => {
      assertValidMineState(1, 0);
    }).not.toThrow();
    expect(() => {
      assertValidMineState(12, 13);
    }).not.toThrow();
    expect(() => {
      assertValidMineState(24, 1);
    }).not.toThrow();
    expect(() => {
      assertValidMineState(1, 24);
    }).not.toThrow();
  });

  it('rejects mineCount out of [1, 24]', () => {
    expect(() => {
      assertValidMineState(0, 0);
    }).toThrow();
    expect(() => {
      assertValidMineState(25, 0);
    }).toThrow();
    expect(() => {
      assertValidMineState(1.5, 0);
    }).toThrow();
  });

  it('rejects negative safeRevealed', () => {
    expect(() => {
      assertValidMineState(1, -1);
    }).toThrow();
  });

  it('rejects safeRevealed > total safe tiles', () => {
    expect(() => {
      assertValidMineState(1, 25);
    }).toThrow();
    expect(() => {
      assertValidMineState(12, 14);
    }).toThrow();
  });

  it('rejects fractional safeRevealed', () => {
    expect(() => {
      assertValidMineState(1, 1.5);
    }).toThrow();
  });
});

describe('RTP property', () => {
  // Simulate a player who always cashes out at exactly K safe reveals.
  // Empirical RTP across all possible outcomes should be 97% within
  // float-precision drift. This is the "any policy → 97% RTP" property.
  it('always-cash-at-K policy gives 97% RTP for any K', () => {
    for (const M of [1, 3, 5, 12, 24]) {
      for (let K = 1; K <= TOTAL_TILES - M; K++) {
        // P(reach K safe reveals without busting) × multiplier(M, K)
        let pSurvive = 1;
        for (let k = 0; k < K; k++) {
          pSurvive *= (TOTAL_TILES - M - k) / (TOTAL_TILES - k);
        }
        const mul = multiplierFor(M, K);
        const rtp = pSurvive * mul;
        // Expect within 0.5pp due to multiplier rounding to 4dp.
        expect(rtp).toBeGreaterThan(0.965);
        expect(rtp).toBeLessThan(0.975);
      }
    }
  });
});
