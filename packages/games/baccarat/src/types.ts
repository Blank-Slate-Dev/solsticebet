// packages/games/baccarat/src/types.ts
//
// Types for Baccarat (Punto Banco variant).
// See docs/BACCARAT.md.

import type { Currency } from '@solsticebet/ledger';

/**
 * The three Baccarat bet types.
 */
export type BaccaratBetType = 'player' | 'banker' | 'tie';

/**
 * The three possible coup outcomes.
 */
export type BaccaratWinner = 'player' | 'banker' | 'tie';

/**
 * A single bet placed on a coup.
 */
export interface BaccaratBet {
  readonly type: BaccaratBetType;
  /** Stake in INTERNAL_USDT-scaled bigint. */
  readonly stake: bigint;
}

/**
 * Settlement state for a single bet within a coup.
 *
 * 'win'   — bet matched the coup outcome; payout > stake
 * 'push'  — Player/Banker bet on a Tie; stake refunded
 * 'loss'  — bet did not match the outcome; stake forfeited
 */
export type BaccaratBetState = 'win' | 'push' | 'loss';

/**
 * Per-bet outcome rolled up into the coup result.
 */
export interface BaccaratBetOutcome {
  readonly type: BaccaratBetType;
  readonly stake: bigint;
  readonly state: BaccaratBetState;
  /** Gross payout including stake on win/push; 0 on loss. */
  readonly payout: bigint;
}

/**
 * The cards dealt to one side of the table.
 *
 * Ranks are 0..12 per the RNG's BACCARAT_RANKS encoding:
 *   0 = Ace, 1..8 = 2..9, 9..12 = 10/J/Q/K
 */
export interface BaccaratHand {
  readonly cards: readonly number[];
  /** 0..9 — sum of card point values modulo 10. */
  readonly total: number;
}

/**
 * Full deal record for a coup.
 */
export interface BaccaratDeal {
  readonly player: BaccaratHand;
  readonly banker: BaccaratHand;
  readonly winner: BaccaratWinner;
  /**
   * True iff one of the two hands had 8 or 9 on its first two cards
   * (in which case neither side draws further).
   */
  readonly natural: boolean;
}

/**
 * Inputs for a single Baccarat coup.
 */
export interface BaccaratCoupInput {
  readonly coupId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly bets: readonly BaccaratBet[];
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Outcome of a complete coup.
 */
export interface BaccaratCoupOutcome {
  readonly coupId: string;
  readonly deal: BaccaratDeal;
  readonly bets: readonly BaccaratBetOutcome[];
  readonly totalStake: bigint;
  readonly totalPayout: bigint;
}
