// packages/games/sicbo/src/wheel.ts
//
// Sic Bo bet win predicates and pay tables.
// See docs/SICBO.md § 2.

import type { SicBoBetType } from './types.js';

/**
 * Pay table for "Total = N" bets, indexed by sum 4..17.
 * See docs/SICBO.md § 2.2.
 */
export const TOTAL_PAYOUTS: Readonly<Record<number, number>> = {
  4: 60,
  5: 30,
  6: 17,
  7: 12,
  8: 8,
  9: 6,
  10: 6,
  11: 6,
  12: 6,
  13: 8,
  14: 12,
  15: 17,
  16: 30,
  17: 60,
};

/**
 * Pay table for fixed-payout bets.
 * Single die and Total bets have payouts that depend on context — handled in
 * `winMultiplierFor`.
 */
export const FIXED_PAYOUTS: Readonly<Record<string, number>> = {
  small: 1,
  big: 1,
  even: 1,
  odd: 1,
  any_triple: 30,
  specific_triple: 180,
  specific_double: 10,
  two_dice_combo: 5,
};

/**
 * Returns true if all three dice match (a triple).
 */
function isTriple(dice: readonly [number, number, number]): boolean {
  return dice[0] === dice[1] && dice[1] === dice[2];
}

/**
 * Counts how many dice show the given face value.
 */
function countFace(dice: readonly [number, number, number], face: number): number {
  let count = 0;
  for (const d of dice) {
    if (d === face) count += 1;
  }
  return count;
}

/**
 * Asserts a face value is in [1, 6].
 */
function assertValidFace(face: number): void {
  if (!Number.isInteger(face) || face < 1 || face > 6) {
    throw new RangeError(`face must be an integer in [1, 6] (got ${String(face)})`);
  }
}

/**
 * Asserts a total is in [4, 17].
 */
function assertValidTotal(total: number): void {
  if (!Number.isInteger(total) || total < 4 || total > 17) {
    throw new RangeError(`total must be an integer in [4, 17] (got ${String(total)})`);
  }
}

/**
 * Asserts target is a [low, high] tuple of distinct faces 1..6.
 */
function assertValidPair(target: unknown): asserts target is readonly [number, number] {
  if (!Array.isArray(target) || target.length !== 2) {
    throw new RangeError('two_dice_combo target must be a 2-element array');
  }
  const a = target[0] as number;
  const b = target[1] as number;
  assertValidFace(a);
  assertValidFace(b);
  if (a === b) {
    throw new RangeError('two_dice_combo target must contain two distinct faces');
  }
}

/**
 * Computes the win multiplier (winnings:1) for a bet given the dice result.
 * Returns 0 for a losing bet.
 *
 * @throws RangeError on invalid bet type/target combinations
 */
export function winMultiplierFor(
  type: SicBoBetType,
  target: number | readonly [number, number] | undefined,
  dice: readonly [number, number, number],
): number {
  const total = dice[0] + dice[1] + dice[2];
  const triple = isTriple(dice);

  switch (type) {
    case 'small':
      if (triple) return 0;
      return total >= 4 && total <= 10 ? 1 : 0;

    case 'big':
      if (triple) return 0;
      return total >= 11 && total <= 17 ? 1 : 0;

    case 'even':
      if (triple) return 0;
      return total % 2 === 0 ? 1 : 0;

    case 'odd':
      if (triple) return 0;
      return total % 2 === 1 ? 1 : 0;

    case 'total': {
      if (typeof target !== 'number') {
        throw new RangeError("'total' bet requires a numeric target");
      }
      assertValidTotal(target);
      return total === target ? (TOTAL_PAYOUTS[target] ?? 0) : 0;
    }

    case 'any_triple':
      return triple ? 30 : 0;

    case 'specific_triple': {
      if (typeof target !== 'number') {
        throw new RangeError("'specific_triple' bet requires a face target");
      }
      assertValidFace(target);
      return triple && dice[0] === target ? 180 : 0;
    }

    case 'specific_double': {
      if (typeof target !== 'number') {
        throw new RangeError("'specific_double' bet requires a face target");
      }
      assertValidFace(target);
      return countFace(dice, target) >= 2 ? 10 : 0;
    }

    case 'two_dice_combo': {
      assertValidPair(target);
      return countFace(dice, target[0]) >= 1 && countFace(dice, target[1]) >= 1 ? 5 : 0;
    }

    case 'single_die': {
      if (typeof target !== 'number') {
        throw new RangeError("'single_die' bet requires a face target");
      }
      assertValidFace(target);
      const matches = countFace(dice, target);
      // 1:1, 2:1, 3:1 based on number of matches; 0 means loss
      return matches; // returns 0..3
    }
  }
}

/**
 * Returns the cap on the winMultiplier for a given bet type.
 * Used for max-payout enforcement.
 */
export function maxWinMultiplier(
  type: SicBoBetType,
  target: number | readonly [number, number] | undefined,
): number {
  switch (type) {
    case 'specific_triple':
      return 180;
    case 'any_triple':
      return 30;
    case 'specific_double':
      return 10;
    case 'two_dice_combo':
      return 5;
    case 'single_die':
      return 3; // max when all 3 dice match
    case 'total': {
      if (typeof target !== 'number') return 60; // defensive
      return TOTAL_PAYOUTS[target] ?? 0;
    }
    case 'small':
    case 'big':
    case 'even':
    case 'odd':
      return 1;
  }
}
