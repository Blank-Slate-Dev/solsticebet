// packages/games/sicbo/src/types.ts
//
// Types for Sic Bo.
// See docs/SICBO.md.

import type { Currency } from '@solsticebet/ledger';

/**
 * Bet types supported in v1. See docs/SICBO.md § 2.2.
 */
export type SicBoBetType =
  | 'small'
  | 'big'
  | 'even'
  | 'odd'
  | 'total' // requires target = sum (4..17)
  | 'any_triple'
  | 'specific_triple' // requires target = face (1..6)
  | 'specific_double' // requires target = face (1..6)
  | 'two_dice_combo' // requires target = [face1, face2] with face1 < face2
  | 'single_die'; // requires target = face (1..6)

/**
 * A single bet placed on a roll.
 */
export interface SicBoBet {
  readonly type: SicBoBetType;
  readonly stake: bigint;
  /** Target varies by type: number | [number, number] | undefined */
  readonly target?: number | readonly [number, number];
}

/**
 * Per-bet outcome rolled up into the roll result.
 */
export interface SicBoBetOutcome {
  readonly type: SicBoBetType;
  readonly stake: bigint;
  readonly target: number | readonly [number, number] | null;
  /** Winnings ratio (e.g. 1 for 1:1, 60 for 60:1). 0 on loss. */
  readonly winMultiplier: number;
  readonly isWin: boolean;
  /** Gross payout including stake on win; 0 on loss. */
  readonly payout: bigint;
}

/**
 * Inputs for a Sic Bo roll.
 */
export interface SicBoRollInput {
  readonly rollId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly bets: readonly SicBoBet[];
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Outcome of a complete roll.
 */
export interface SicBoRollOutcome {
  readonly rollId: string;
  readonly dice: readonly [number, number, number];
  readonly total: number;
  readonly bets: readonly SicBoBetOutcome[];
  readonly totalStake: bigint;
  readonly totalPayout: bigint;
}
