// packages/games/blackjack/src/types.ts
//
// Types for Blackjack.
// See docs/BLACKJACK.md.

import type { Currency } from '@solsticebet/ledger';

/**
 * Player action types.
 */
export type BlackjackAction = 'hit' | 'stand' | 'double' | 'split';

/**
 * Round lifecycle state.
 */
export type BlackjackRoundState =
  | 'player_turn' // at least one hand still active
  | 'settled'; // round finalised

/**
 * Per-hand resolution state.
 */
export type BlackjackHandState =
  | 'active' // player can still act on this hand
  | 'stood' // player stood
  | 'busted' // total > 21
  | 'doubled' // doubled and one card drawn; effectively stood
  | 'split_ace' // split-ace hand; one card and stand
  | 'blackjack'; // natural blackjack on this hand

/**
 * Settlement state for a single hand against the dealer.
 */
export type BlackjackHandSettle =
  | 'win' // payout 2× stake
  | 'win_blackjack' // payout 2.5× stake (3:2)
  | 'push' // refund 1× stake
  | 'loss'; // 0 payout

/**
 * A single hand within a round (one or more after splits).
 */
export interface BlackjackHand {
  readonly cards: readonly number[];
  /** The bet amount on this specific hand (may differ from original on doubles). */
  readonly stake: bigint;
  readonly state: BlackjackHandState;
  /** Set after settlement. */
  readonly settle: BlackjackHandSettle | null;
  /** Set after settlement: gross payout including stake on win/push. */
  readonly payout: bigint | null;
}

/**
 * The dealer's hand.
 */
export interface BlackjackDealerHand {
  readonly cards: readonly number[];
  /**
   * Set when the dealer has played out (round is settled).
   * Until then, only the upcard (cards[0]) is meaningful to the player.
   */
  readonly final: boolean;
}

/**
 * Inputs for starting a round.
 */
export interface StartBlackjackRoundInput {
  readonly roundId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  /** Initial stake. Doubles/splits will debit additional amounts later. */
  readonly stake: bigint;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * The complete persistent state of a Blackjack round.
 */
export interface BlackjackRound {
  readonly roundId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  /** Original starting stake; total committed grows with doubles/splits. */
  readonly originalStake: bigint;
  /** Total amount debited from user (sum of all stakes including doubles/splits). */
  readonly totalCommitted: bigint;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  /** Full 32-card pre-derived deck. The engine consumes from this. */
  readonly deck: readonly number[];
  /** Index of the next card to draw. */
  readonly deckCursor: number;
  readonly playerHands: readonly BlackjackHand[];
  /** Index of the currently-active player hand. */
  readonly activeHandIndex: number;
  readonly dealer: BlackjackDealerHand;
  readonly state: BlackjackRoundState;
  /** Total payout across all hands; set on settle. */
  readonly totalPayout: bigint | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Outcome of an action — the updated round.
 */
export interface BlackjackActionOutcome {
  readonly round: BlackjackRound;
}
