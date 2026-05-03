// packages/games/lucky-wheel/src/types.ts

import type { Currency } from '@solsticebet/ledger';

/**
 * A wheel segment. The "color" is the visual identifier the UI uses.
 */
export interface WheelSegment {
  readonly color: 'gray' | 'green' | 'blue' | 'purple' | 'red' | 'gold';
  /** Win multiplier (excluding stake return). 0 means loss. */
  readonly multiplier: number;
}

export interface LuckyWheelBetInput {
  readonly betId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly stake: bigint;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface LuckyWheelBetOutcome {
  readonly betId: string;
  /** Index of the segment landed on (0..N-1). */
  readonly segmentIndex: number;
  readonly segment: WheelSegment;
  readonly stake: bigint;
  readonly isWin: boolean;
  readonly payout: bigint;
}
