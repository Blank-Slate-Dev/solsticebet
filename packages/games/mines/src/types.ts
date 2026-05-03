// packages/games/mines/src/types.ts
//
// Types for the Mines game.
// See docs/MINES.md.

import type { Currency } from '@solsticebet/ledger';

/**
 * Round state. Terminal: 'cashed_out' | 'busted'.
 */
export type MinesRoundState = 'active' | 'cashed_out' | 'busted';

/**
 * Inputs needed to start a new Mines round.
 */
export interface StartMinesRoundInput {
  readonly roundId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly stake: bigint;
  /** 1..24 inclusive. */
  readonly mineCount: number;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * The persistent state of a Mines round.
 *
 * `mineLayout` is the full Fisher-Yates permutation of [0, 25). The first
 * `mineCount` entries are the mine positions; the rest are safe tiles.
 *
 * `revealed` tracks the tiles the player has uncovered, in order. The last
 * entry is the most recent reveal.
 */
export interface MinesRound {
  readonly roundId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly stake: bigint;
  readonly mineCount: number;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly mineLayout: readonly number[];
  readonly revealed: readonly number[];
  readonly state: MinesRoundState;
  /** Set when the round becomes terminal (cashed_out or busted). */
  readonly payout: bigint | null;
  /** Set when the round becomes terminal. */
  readonly finalMultiplier: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * The shape returned by reveal/cashOut: a snapshot of the round, plus, for
 * a reveal, whether the just-revealed tile was a mine.
 */
export interface MinesActionOutcome {
  readonly round: MinesRound;
  /** True iff the just-revealed tile was a mine; undefined for cashOut. */
  readonly wasMine?: boolean;
  /** Multiplier active right now (after the action). */
  readonly currentMultiplier: number;
}
