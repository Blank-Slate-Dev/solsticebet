// packages/games/roulette/src/types.ts
//
// Types for European Roulette.
// See docs/ROULETTE.md.

import type { Currency } from '@solsticebet/ledger';

/**
 * European roulette has 37 pockets. Pocket 0 is green; the others alternate
 * red/black per the standard arrangement.
 */
export const POCKETS = 37;

/**
 * Pocket colour. Only 0 is green.
 */
export type PocketColor = 'red' | 'black' | 'green';

/**
 * Bet types supported in v1. See docs/ROULETTE.md § 2.2.
 */
export type RouletteBetType =
  | 'straight'
  | 'split'
  | 'street'
  | 'corner'
  | 'six_line'
  | 'column'
  | 'dozen'
  | 'red'
  | 'black'
  | 'even'
  | 'odd'
  | 'low'
  | 'high';

/**
 * A single bet placed on a spin. Some bet types take a target (the number(s)
 * being bet on); others (red/black/even/odd/low/high) don't.
 *
 * `target` semantics by type:
 *   - straight: a single number 0..36
 *   - split:    two adjacent numbers, e.g. [1, 2]
 *   - street:   the lowest number of a 3-number row, e.g. 1 means [1, 2, 3]
 *   - corner:   the lowest number of a 4-number square, e.g. 1 means [1, 2, 4, 5]
 *   - six_line: the lowest number of a 6-number block, e.g. 1 means [1..6]
 *   - column:   1, 2, or 3 — the column (numbers ≡ column (mod 3) for col 1/2; 3,6,9,...,36 for col 3)
 *   - dozen:    1, 2, or 3 — first/second/third dozen
 *   - red, black, even, odd, low, high: target is unused
 */
export interface RouletteBet {
  readonly type: RouletteBetType;
  /** Stake in INTERNAL_USDT-scaled bigint. Per-bet stake. */
  readonly stake: bigint;
  /** Target numbers required by some bet types; varies by type (see above). */
  readonly target?: number | readonly number[];
}

/**
 * Per-bet outcome rolled up into the spin result.
 */
export interface RouletteBetOutcome {
  readonly type: RouletteBetType;
  readonly stake: bigint;
  readonly target: number | readonly number[] | null;
  readonly multiplier: number;
  readonly isWin: boolean;
  /** Gross payout including stake on win; 0 on loss. */
  readonly payout: bigint;
}

/**
 * Inputs for a Roulette spin.
 */
export interface RouletteSpinInput {
  readonly spinId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly bets: readonly RouletteBet[];
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Outcome of a complete spin.
 */
export interface RouletteSpinOutcome {
  readonly spinId: string;
  readonly result: number;
  readonly resultColor: PocketColor;
  readonly bets: readonly RouletteBetOutcome[];
  readonly totalStake: bigint;
  readonly totalPayout: bigint;
}
