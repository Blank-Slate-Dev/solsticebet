// packages/games/uth/src/types.ts
//
// Types for Ultimate Texas Hold'em.
// See docs/UTH.md.

import type { Currency } from '@solsticebet/ledger';
import type { UthCard } from '@solsticebet/rng';

/**
 * Player decision actions.
 */
export type UthAction =
  | 'raise_4x'
  | 'raise_3x'
  | 'check_preflop'
  | 'raise_2x'
  | 'check_flop'
  | 'raise_1x'
  | 'fold';

/**
 * Round lifecycle phases.
 */
export type UthPhase =
  | 'preflop' // 2 hole cards dealt; awaiting raise/check
  | 'flop' // checked preflop; flop revealed; awaiting raise/check
  | 'river' // checked flop; turn+river revealed; awaiting raise/fold
  | 'settled';

/**
 * Five-card poker hand rank, weakest to strongest.
 */
export type HandRankName =
  | 'high_card'
  | 'pair'
  | 'two_pair'
  | 'three_kind'
  | 'straight'
  | 'flush'
  | 'full_house'
  | 'four_kind'
  | 'straight_flush'
  | 'royal_flush';

export interface HandScore {
  readonly rank: HandRankName;
  /** Total ordering: higher score wins. */
  readonly score: number;
  /** The 5 cards forming this hand, in canonical order. */
  readonly cards: readonly UthCard[];
}

/**
 * Bet circle state.
 */
export type BetState = 'pending' | 'win' | 'loss' | 'push';

export interface BetSettlement {
  readonly state: BetState;
  readonly stake: bigint;
  /** Multiplier paid (e.g., 1 for 1:1, 50 for 50:1, 0 on loss). Excludes stake. */
  readonly winMultiplier: number;
  /** Gross payout including stake on win/push; 0 on loss. */
  readonly payout: bigint;
}

/**
 * Inputs for starting a UTH coup.
 */
export interface StartUthCoupInput {
  readonly coupId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  /** Required Ante stake. Blind = Ante. */
  readonly ante: bigint;
  /** Optional Trips side bet. 0n means none. */
  readonly trips: bigint;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Persistent state for a UTH coup.
 */
export interface UthCoup {
  readonly coupId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly cards: readonly UthCard[]; // all 9 cards pre-derived
  // Bets:
  readonly ante: bigint;
  readonly blind: bigint; // = ante
  readonly trips: bigint;
  readonly play: bigint; // 0n until placed
  readonly playMultiplier: 0 | 1 | 2 | 3 | 4; // 0 means not yet placed
  readonly totalCommitted: bigint;
  readonly folded: boolean;
  readonly phase: UthPhase;
  // Settlement (set when phase === 'settled'):
  readonly playerHand: HandScore | null;
  readonly dealerHand: HandScore | null;
  readonly dealerQualifies: boolean | null;
  readonly anteSettlement: BetSettlement | null;
  readonly blindSettlement: BetSettlement | null;
  readonly playSettlement: BetSettlement | null;
  readonly tripsSettlement: BetSettlement | null;
  readonly totalPayout: bigint | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}
