// packages/games/dice/src/types.ts
//
// Types for the Dice game.
// See docs/DICE.md.

import type { Currency } from '@solsticebet/ledger';

/**
 * Whether the player wins on rolls greater than the target ('over')
 * or less than the target ('under'). Equality is always a loss.
 */
export type DiceMode = 'over' | 'under';

/**
 * Input for a single Dice bet, after stake has been parsed but before any
 * ledger write. The engine validates this further (limits, math).
 */
export interface DiceBetInput {
  readonly betId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly stake: bigint;
  /** 2.00–98.00 in 0.01 increments. */
  readonly target: number;
  readonly mode: DiceMode;
  readonly currency: Currency;
  /** Provably-fair inputs at the time of the bet. */
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  /** Optional metadata to forward into ledger entries. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Outcome of a settled Dice bet — what the engine returns to the caller.
 */
export interface DiceBetOutcome {
  readonly betId: string;
  /** The roll, in [0.00, 99.99]. */
  readonly roll: number;
  readonly target: number;
  readonly mode: DiceMode;
  readonly multiplier: number;
  readonly isWin: boolean;
  /** Always non-negative. Zero on loss. Bigint with 18 implied decimal places. */
  readonly payout: bigint;
  readonly stake: bigint;
}
