// packages/games/roulette/src/wheel.ts
//
// European roulette wheel definitions and win predicates.
// See docs/ROULETTE.md § 2.3.

import type { PocketColor, RouletteBetType } from './types.js';
import { POCKETS } from './types.js';

/**
 * Standard European red numbers.
 */
const RED_NUMBERS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

/**
 * Returns the colour of a pocket.
 *
 * @throws RangeError if `n` is outside [0, 36]
 */
export function colorOf(n: number): PocketColor {
  assertValidPocket(n);
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

/**
 * Returns the dozen index (1, 2, or 3) for a numbered pocket, or 0 for the
 * zero pocket.
 */
export function dozenOf(n: number): 0 | 1 | 2 | 3 {
  assertValidPocket(n);
  if (n === 0) return 0;
  if (n <= 12) return 1;
  if (n <= 24) return 2;
  return 3;
}

/**
 * Returns the column index (1, 2, or 3) for a numbered pocket, or 0 for the
 * zero pocket.
 *
 * Column 1: numbers where n % 3 == 1 (1, 4, 7, ..., 34)
 * Column 2: numbers where n % 3 == 2 (2, 5, 8, ..., 35)
 * Column 3: numbers where n % 3 == 0 (3, 6, 9, ..., 36) — except 0
 */
export function columnOf(n: number): 0 | 1 | 2 | 3 {
  assertValidPocket(n);
  if (n === 0) return 0;
  const mod = n % 3;
  if (mod === 1) return 1;
  if (mod === 2) return 2;
  return 3;
}

/**
 * Bet payout multipliers (excluding stake return). See docs/ROULETTE.md § 2.2.
 */
export const PAYOUTS: Readonly<Record<RouletteBetType, number>> = {
  straight: 35,
  split: 17,
  street: 11,
  corner: 8,
  six_line: 5,
  column: 2,
  dozen: 2,
  red: 1,
  black: 1,
  even: 1,
  odd: 1,
  low: 1,
  high: 1,
};

/**
 * Asserts a number is a valid pocket index (0..36).
 *
 * @throws RangeError otherwise
 */
export function assertValidPocket(n: number): void {
  if (!Number.isInteger(n) || n < 0 || n >= POCKETS) {
    throw new RangeError(`pocket must be an integer in [0, ${String(POCKETS - 1)}]`);
  }
}

/**
 * Determines whether a bet wins given the spin result.
 *
 * @param type bet type
 * @param target the bet's target (number or array of numbers, depending on type)
 * @param result the spin result (0..36)
 * @returns true if the bet wins
 * @throws RangeError on inputs that don't match the bet type
 */
export function isWinningBet(
  type: RouletteBetType,
  target: number | readonly number[] | undefined,
  result: number,
): boolean {
  assertValidPocket(result);

  switch (type) {
    case 'straight': {
      const t = expectSingleTarget(target, type);
      assertValidPocket(t);
      return t === result;
    }

    case 'split': {
      const arr = expectArrayTarget(target, type, 2);
      arr.forEach(assertValidPocket);
      // Validate adjacency: splits cover two horizontally or vertically adjacent
      // numbers on the betting layout. The layout has 12 rows × 3 columns
      // (numbered 1-36) plus the zero pocket.
      assertSplitAdjacent(arr);
      return arr.includes(result);
    }

    case 'street': {
      // target = lowest number of a row; row covers [t, t+1, t+2]
      const t = expectSingleTarget(target, type);
      assertStreetStart(t);
      return result >= t && result <= t + 2;
    }

    case 'corner': {
      // target = lowest number of a 2x2 square; covers [t, t+1, t+3, t+4]
      const t = expectSingleTarget(target, type);
      assertCornerStart(t);
      return result === t || result === t + 1 || result === t + 3 || result === t + 4;
    }

    case 'six_line': {
      // target = lowest number of a 2-row block; covers [t..t+5]
      const t = expectSingleTarget(target, type);
      assertSixLineStart(t);
      return result >= t && result <= t + 5;
    }

    case 'column': {
      // target = column index 1, 2, or 3
      const t = expectSingleTarget(target, type);
      if (t !== 1 && t !== 2 && t !== 3) {
        throw new RangeError('column target must be 1, 2, or 3');
      }
      return columnOf(result) === t;
    }

    case 'dozen': {
      const t = expectSingleTarget(target, type);
      if (t !== 1 && t !== 2 && t !== 3) {
        throw new RangeError('dozen target must be 1, 2, or 3');
      }
      return dozenOf(result) === t;
    }

    case 'red':
      return colorOf(result) === 'red';
    case 'black':
      return colorOf(result) === 'black';
    case 'even':
      return result !== 0 && result % 2 === 0;
    case 'odd':
      return result !== 0 && result % 2 === 1;
    case 'low':
      return result >= 1 && result <= 18;
    case 'high':
      return result >= 19 && result <= 36;
  }
}

// ─── target validation helpers ──────────────────────────────────────────

function expectSingleTarget(
  target: number | readonly number[] | undefined,
  type: RouletteBetType,
): number {
  if (typeof target !== 'number' || !Number.isInteger(target)) {
    throw new RangeError(`bet type '${type}' requires a single integer target`);
  }
  return target;
}

function expectArrayTarget(
  target: number | readonly number[] | undefined,
  type: RouletteBetType,
  length: number,
): readonly number[] {
  if (!Array.isArray(target) || target.length !== length) {
    throw new RangeError(`bet type '${type}' requires an array target of length ${String(length)}`);
  }
  return target as readonly number[];
}

function assertSplitAdjacent(arr: readonly number[]): void {
  const a = arr[0];
  const b = arr[1];
  if (a === undefined || b === undefined || a === b) {
    throw new RangeError('split must contain two distinct numbers');
  }
  const [lo, hi] = a < b ? [a, b] : [b, a];

  // The zero pocket has special-case splits (with 1, 2, or 3) used by some
  // operators. We do not support zero-splits in v1 to keep the rules clean.
  if (lo === 0) {
    throw new RangeError('zero-splits are not supported in v1');
  }

  // Horizontal adjacency: same row, columns differ by 1.
  // Rows are 1..3, 4..6, 7..9, ... — three numbers each, ascending column→row.
  // Two numbers are horizontally adjacent if floor((n-1)/3) is equal AND
  // they differ by 1.
  if (Math.floor((lo - 1) / 3) === Math.floor((hi - 1) / 3) && hi - lo === 1) {
    return;
  }
  // Vertical adjacency: differ by 3 (same column, consecutive rows).
  if (hi - lo === 3) {
    return;
  }
  throw new RangeError(
    `split numbers ${String(lo)} and ${String(hi)} are not adjacent on the layout`,
  );
}

function assertStreetStart(t: number): void {
  // A street starts on a column-1 number: 1, 4, 7, ..., 34
  if (t < 1 || t > 34 || (t - 1) % 3 !== 0) {
    throw new RangeError(`street target must be 1, 4, 7, ..., or 34 (got ${String(t)})`);
  }
}

function assertCornerStart(t: number): void {
  // A 2x2 corner starts on a column-1 or column-2 number, in rows 1..11.
  // Valid starts: 1, 2, 4, 5, 7, 8, ..., 31, 32.
  if (t < 1 || t > 32) {
    throw new RangeError(`corner target out of range (got ${String(t)})`);
  }
  const col = ((t - 1) % 3) + 1;
  if (col === 3) {
    throw new RangeError(`corner target must be in column 1 or 2 (got column ${String(col)})`);
  }
}

function assertSixLineStart(t: number): void {
  // A six-line starts on a column-1 number in rows 1..11: 1, 4, 7, ..., 31.
  if (t < 1 || t > 31 || (t - 1) % 3 !== 0) {
    throw new RangeError(`six_line target must be 1, 4, 7, ..., or 31 (got ${String(t)})`);
  }
}
