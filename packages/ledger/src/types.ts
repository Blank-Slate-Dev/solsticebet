// packages/ledger/src/types.ts
//
// Strong types for the ledger.
// See docs/LEDGER.md § 2 for the data model.

/**
 * Currencies supported by the ledger.
 *
 * Crypto rails are used for deposits and withdrawals only.
 * INTERNAL_USDT is the gameplay accounting unit; all bets are denominated in it.
 */
export const CURRENCIES = ['BTC', 'ETH', 'USDT', 'SOL', 'LTC', 'INTERNAL_USDT'] as const;

export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(s: string): s is Currency {
  return (CURRENCIES as readonly string[]).includes(s);
}

/**
 * Account types.
 *
 * - user: a player's spendable wallet (one per user per currency)
 * - bonus: bonus credits awaiting wagering completion (one per user per currency)
 * - house: the casino's own accounts; counterparty to bets
 * - escrow: in-flight stakes and pending withdrawals
 * - fees: where fees accrue
 * - provider: external custodial provider (NOWPayments / CoinsPaid)
 */
export const ACCOUNT_TYPES = ['user', 'bonus', 'house', 'escrow', 'fees', 'provider'] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * Closed enumeration of transaction types.
 * See docs/LEDGER.md § 2.3 for full descriptions.
 */
export const TRANSACTION_TYPES = [
  'deposit',
  'withdraw',
  'bet_stake',
  'bet_payout',
  'bet_settle_loss',
  'bet_refund',
  'bonus_grant',
  'bonus_release',
  'bonus_forfeit',
  'fee',
  'conversion',
  'adjustment_credit',
  'adjustment_debit',
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/**
 * An account in the ledger. Accounts are addressable units of value.
 */
export interface Account {
  readonly id: string;
  readonly type: AccountType;
  /** UUID for user/bonus accounts; null for house/escrow/fees/provider. */
  readonly ownerId: string | null;
  readonly currency: Currency;
  readonly createdAt: Date;
}

/**
 * A single signed entry in the ledger.
 *
 * `amount` is signed: positive = credit, negative = debit.
 * Amounts are bigint with implicit 18 decimal places of scale (see Amount type).
 */
export interface LedgerEntry {
  readonly id: number;
  readonly transactionId: string;
  readonly accountId: string;
  /** Signed bigint with 18 implied decimal places. */
  readonly amount: bigint;
  readonly currency: Currency;
  readonly transactionType: TransactionType;
  readonly referenceId: string | null;
  readonly idempotencyKey: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
}

/**
 * A transaction is the unit of atomic write. Multiple entries belonging to
 * one transactionId must sum to zero per currency.
 */
export interface Transaction {
  readonly id: string;
  readonly entries: readonly LedgerEntry[];
  readonly createdAt: Date;
}

/**
 * Ergonomic shape for proposing a new entry within a transaction.
 * The repository populates `id`, `transactionId`, and `createdAt`.
 */
export interface ProposedEntry {
  readonly accountId: string;
  /** Signed bigint with 18 implied decimal places. */
  readonly amount: bigint;
  readonly currency: Currency;
  readonly transactionType: TransactionType;
  readonly referenceId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Input to recordTransaction.
 *
 * `idempotencyKey` is required for any external-facing transaction; the
 * repository rejects internal-only transactions that omit it unless the
 * caller is on the in-memory contract that allows it (tests).
 */
export interface ProposedTransaction {
  readonly entries: readonly ProposedEntry[];
  /**
   * Required for external-facing writes (deposits, withdrawals, bets,
   * adjustments). Omitting this on internal-only writes is allowed.
   */
  readonly idempotencyKey?: string | null;
}
