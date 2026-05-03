// packages/ledger/src/recipes.ts
//
// Canonical transaction recipes.
// Game packages, the wallet service, and the admin panel call these
// functions rather than constructing ProposedTransaction objects directly.
// This way, every kind of money movement happens in exactly one place,
// reviewable in one diff.
//
// See docs/LEDGER.md § 4 for the full specification of each recipe.

import { assertPositive } from './amount.js';
import type { LedgerRepository } from './repository.js';
import type { Currency, ProposedTransaction, Transaction } from './types.js';

// ─── Bets ────────────────────────────────────────────────────────────────

export interface RecordBetStakeInput {
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  /** Positive bigint amount in the bet currency (typically INTERNAL_USDT). */
  readonly stake: bigint;
  readonly currency: Currency;
  readonly betId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Phase 1 of a bet: debit user, credit escrow.
 *
 * Idempotency key: `bet_stake:<betId>` — replays return the original tx.
 */
export async function recordBetStake(
  repo: LedgerRepository,
  input: RecordBetStakeInput,
): Promise<Transaction> {
  assertPositive(input.stake);
  const tx: ProposedTransaction = {
    idempotencyKey: `bet_stake:${input.betId}`,
    entries: [
      {
        accountId: input.userAccountId,
        amount: -input.stake,
        currency: input.currency,
        transactionType: 'bet_stake',
        referenceId: input.betId,
        metadata: input.metadata ?? {},
      },
      {
        accountId: input.escrowAccountId,
        amount: input.stake,
        currency: input.currency,
        transactionType: 'bet_stake',
        referenceId: input.betId,
        metadata: input.metadata ?? {},
      },
    ],
  };
  return repo.recordTransaction(tx);
}

export interface RecordBetWinInput {
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  /** Original stake (already in escrow). */
  readonly stake: bigint;
  /** Total payout to user (>= stake; for a winning bet, payout = stake * multiplier). */
  readonly payout: bigint;
  readonly currency: Currency;
  readonly betId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Phase 2 of a winning bet:
 *   - debit escrow (return the held stake)
 *   - debit house by (payout - stake)  [house funds the player's winnings]
 *   - credit user by payout
 *
 * Idempotency key: `bet_settle:<betId>`.
 *
 * If `payout === stake` (a "push"), prefer `recordBetRefund` instead — this
 * function rejects payouts <= stake to prevent that mistake.
 */
export async function recordBetWin(
  repo: LedgerRepository,
  input: RecordBetWinInput,
): Promise<Transaction> {
  assertPositive(input.stake);
  assertPositive(input.payout);
  if (input.payout <= input.stake) {
    throw new RangeError('recordBetWin requires payout > stake; use recordBetRefund for pushes');
  }
  const houseLoss = input.payout - input.stake;
  const tx: ProposedTransaction = {
    idempotencyKey: `bet_settle:${input.betId}`,
    entries: [
      {
        accountId: input.escrowAccountId,
        amount: -input.stake,
        currency: input.currency,
        transactionType: 'bet_payout',
        referenceId: input.betId,
        metadata: input.metadata ?? {},
      },
      {
        accountId: input.houseAccountId,
        amount: -houseLoss,
        currency: input.currency,
        transactionType: 'bet_payout',
        referenceId: input.betId,
        metadata: input.metadata ?? {},
      },
      {
        accountId: input.userAccountId,
        amount: input.payout,
        currency: input.currency,
        transactionType: 'bet_payout',
        referenceId: input.betId,
        metadata: input.metadata ?? {},
      },
    ],
  };
  return repo.recordTransaction(tx);
}

export interface RecordBetPartialPayoutInput {
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  /** Original stake (already in escrow). */
  readonly stake: bigint;
  /** Amount to refund to user; must be in (0, stake). */
  readonly payout: bigint;
  readonly currency: Currency;
  readonly betId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Phase 2 of a bet that pays back less than the stake (a "partial payout").
 *
 * Used by games where the outcome can be a bucket whose multiplier is less
 * than 1 (e.g., Plinko's middle buckets). The escrow drains: the partial
 * payout flows to the user, the remainder flows to the house.
 *
 * Constraints:
 *   - 0 < payout < stake. For payout == 0, use `recordBetLoss`. For
 *     payout == stake, use `recordBetRefund`. For payout > stake, use
 *     `recordBetWin`. This recipe rejects edge cases to make the caller
 *     pick the right semantic.
 *
 * Idempotency key: `bet_settle:<betId>`.
 */
export async function recordBetPartialPayout(
  repo: LedgerRepository,
  input: RecordBetPartialPayoutInput,
): Promise<Transaction> {
  assertPositive(input.stake);
  assertPositive(input.payout);
  if (input.payout >= input.stake) {
    throw new RangeError(
      'recordBetPartialPayout requires 0 < payout < stake; use recordBetWin or recordBetRefund',
    );
  }
  const houseGain = input.stake - input.payout;
  const tx: ProposedTransaction = {
    idempotencyKey: `bet_settle:${input.betId}`,
    entries: [
      {
        accountId: input.escrowAccountId,
        amount: -input.stake,
        currency: input.currency,
        transactionType: 'bet_payout',
        referenceId: input.betId,
        metadata: input.metadata ?? {},
      },
      {
        accountId: input.userAccountId,
        amount: input.payout,
        currency: input.currency,
        transactionType: 'bet_payout',
        referenceId: input.betId,
        metadata: input.metadata ?? {},
      },
      {
        accountId: input.houseAccountId,
        amount: houseGain,
        currency: input.currency,
        transactionType: 'bet_payout',
        referenceId: input.betId,
        metadata: input.metadata ?? {},
      },
    ],
  };
  return repo.recordTransaction(tx);
}

export interface RecordBetLossInput {
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly stake: bigint;
  readonly currency: Currency;
  readonly betId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Phase 2 of a losing bet:
 *   - debit escrow (release the held stake)
 *   - credit house (the casino keeps the stake)
 *
 * Idempotency key: `bet_settle:<betId>`.
 */
export async function recordBetLoss(
  repo: LedgerRepository,
  input: RecordBetLossInput,
): Promise<Transaction> {
  assertPositive(input.stake);
  const tx: ProposedTransaction = {
    idempotencyKey: `bet_settle:${input.betId}`,
    entries: [
      {
        accountId: input.escrowAccountId,
        amount: -input.stake,
        currency: input.currency,
        transactionType: 'bet_settle_loss',
        referenceId: input.betId,
        metadata: input.metadata ?? {},
      },
      {
        accountId: input.houseAccountId,
        amount: input.stake,
        currency: input.currency,
        transactionType: 'bet_settle_loss',
        referenceId: input.betId,
        metadata: input.metadata ?? {},
      },
    ],
  };
  return repo.recordTransaction(tx);
}

export interface RecordBetRefundInput {
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly stake: bigint;
  readonly currency: Currency;
  readonly betId: string;
  /** Reason for the refund — included in metadata. */
  readonly reason: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Refund of a bet (push, technical void, manual void):
 *   - debit escrow
 *   - credit user
 *
 * Idempotency key: `bet_refund:<betId>`.
 */
export async function recordBetRefund(
  repo: LedgerRepository,
  input: RecordBetRefundInput,
): Promise<Transaction> {
  assertPositive(input.stake);
  const meta = { ...(input.metadata ?? {}), reason: input.reason };
  const tx: ProposedTransaction = {
    idempotencyKey: `bet_refund:${input.betId}`,
    entries: [
      {
        accountId: input.escrowAccountId,
        amount: -input.stake,
        currency: input.currency,
        transactionType: 'bet_refund',
        referenceId: input.betId,
        metadata: meta,
      },
      {
        accountId: input.userAccountId,
        amount: input.stake,
        currency: input.currency,
        transactionType: 'bet_refund',
        referenceId: input.betId,
        metadata: meta,
      },
    ],
  };
  return repo.recordTransaction(tx);
}

// ─── Adjustments ─────────────────────────────────────────────────────────

export interface RecordAdjustmentInput {
  readonly userAccountId: string;
  readonly houseAccountId: string;
  readonly amount: bigint;
  readonly currency: Currency;
  readonly direction: 'credit' | 'debit';
  readonly adminId: string;
  readonly requestId: string;
  readonly reason: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Manual admin credit or debit. Logged separately to audit_log by the caller.
 *
 * Idempotency key: `adjustment:<adminId>:<requestId>`.
 *
 * - direction='credit' → house → user (user receives funds)
 * - direction='debit'  → user → house (user has funds removed)
 */
export async function recordAdjustment(
  repo: LedgerRepository,
  input: RecordAdjustmentInput,
): Promise<Transaction> {
  assertPositive(input.amount);
  const meta = {
    ...(input.metadata ?? {}),
    adminId: input.adminId,
    reason: input.reason,
  };
  const txType = input.direction === 'credit' ? 'adjustment_credit' : 'adjustment_debit';

  const userDelta = input.direction === 'credit' ? input.amount : -input.amount;
  const houseDelta = -userDelta;

  const tx: ProposedTransaction = {
    idempotencyKey: `adjustment:${input.adminId}:${input.requestId}`,
    entries: [
      {
        accountId: input.houseAccountId,
        amount: houseDelta,
        currency: input.currency,
        transactionType: txType,
        referenceId: input.requestId,
        metadata: meta,
      },
      {
        accountId: input.userAccountId,
        amount: userDelta,
        currency: input.currency,
        transactionType: txType,
        referenceId: input.requestId,
        metadata: meta,
      },
    ],
  };
  return repo.recordTransaction(tx);
}

// ─── Bonuses ─────────────────────────────────────────────────────────────

export interface RecordBonusGrantInput {
  readonly bonusAccountId: string;
  readonly houseAccountId: string;
  readonly amount: bigint;
  readonly currency: Currency;
  readonly bonusId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export async function recordBonusGrant(
  repo: LedgerRepository,
  input: RecordBonusGrantInput,
): Promise<Transaction> {
  assertPositive(input.amount);
  const tx: ProposedTransaction = {
    idempotencyKey: `bonus_grant:${input.bonusId}`,
    entries: [
      {
        accountId: input.houseAccountId,
        amount: -input.amount,
        currency: input.currency,
        transactionType: 'bonus_grant',
        referenceId: input.bonusId,
        metadata: input.metadata ?? {},
      },
      {
        accountId: input.bonusAccountId,
        amount: input.amount,
        currency: input.currency,
        transactionType: 'bonus_grant',
        referenceId: input.bonusId,
        metadata: input.metadata ?? {},
      },
    ],
  };
  return repo.recordTransaction(tx);
}

export interface RecordBonusReleaseInput {
  readonly userAccountId: string;
  readonly bonusAccountId: string;
  readonly amount: bigint;
  readonly currency: Currency;
  readonly bonusId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export async function recordBonusRelease(
  repo: LedgerRepository,
  input: RecordBonusReleaseInput,
): Promise<Transaction> {
  assertPositive(input.amount);
  const tx: ProposedTransaction = {
    idempotencyKey: `bonus_release:${input.bonusId}`,
    entries: [
      {
        accountId: input.bonusAccountId,
        amount: -input.amount,
        currency: input.currency,
        transactionType: 'bonus_release',
        referenceId: input.bonusId,
        metadata: input.metadata ?? {},
      },
      {
        accountId: input.userAccountId,
        amount: input.amount,
        currency: input.currency,
        transactionType: 'bonus_release',
        referenceId: input.bonusId,
        metadata: input.metadata ?? {},
      },
    ],
  };
  return repo.recordTransaction(tx);
}

export interface RecordBonusForfeitInput {
  readonly bonusAccountId: string;
  readonly houseAccountId: string;
  readonly amount: bigint;
  readonly currency: Currency;
  readonly bonusId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export async function recordBonusForfeit(
  repo: LedgerRepository,
  input: RecordBonusForfeitInput,
): Promise<Transaction> {
  assertPositive(input.amount);
  const tx: ProposedTransaction = {
    idempotencyKey: `bonus_forfeit:${input.bonusId}`,
    entries: [
      {
        accountId: input.bonusAccountId,
        amount: -input.amount,
        currency: input.currency,
        transactionType: 'bonus_forfeit',
        referenceId: input.bonusId,
        metadata: input.metadata ?? {},
      },
      {
        accountId: input.houseAccountId,
        amount: input.amount,
        currency: input.currency,
        transactionType: 'bonus_forfeit',
        referenceId: input.bonusId,
        metadata: input.metadata ?? {},
      },
    ],
  };
  return repo.recordTransaction(tx);
}
