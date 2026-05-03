// packages/ledger/src/repository.ts
//
// The LedgerRepository interface.
// Two implementations live in this package:
//   - InMemoryLedgerRepository (tests, spec validation)
//   - PostgresLedgerRepository (production — lands with @solsticebet/db)
//
// Game packages, the wallet service, and the admin panel depend on this
// interface, never on a specific implementation.

import type {
  Account,
  AccountType,
  Currency,
  LedgerEntry,
  ProposedTransaction,
  Transaction,
} from './types.js';

/**
 * Errors the repository may throw at the contract boundary.
 * Implementations may throw subclasses or these directly.
 */
export class LedgerError extends Error {
  override readonly name: string = 'LedgerError';
}

export class AccountNotFoundError extends LedgerError {
  override readonly name = 'AccountNotFoundError';
  constructor(accountId: string) {
    super(`account not found: ${accountId}`);
  }
}

export class DuplicateAccountError extends LedgerError {
  override readonly name = 'DuplicateAccountError';
}

export class InsufficientBalanceError extends LedgerError {
  override readonly name = 'InsufficientBalanceError';
  constructor(
    public readonly accountId: string,
    public readonly currency: Currency,
    public readonly requested: bigint,
    public readonly available: bigint,
  ) {
    super(
      `insufficient balance on account ${accountId} (${currency}): requested ${requested.toString()}, available ${available.toString()}`,
    );
  }
}

export class CurrencyMismatchError extends LedgerError {
  override readonly name = 'CurrencyMismatchError';
}

/** Input for createAccount. */
export interface CreateAccountInput {
  readonly id: string;
  readonly type: AccountType;
  readonly ownerId: string | null;
  readonly currency: Currency;
}

export interface GetEntriesOptions {
  readonly limit?: number;
  /** Cursor — return entries with id strictly less than this (descending). */
  readonly beforeId?: number;
}

/**
 * Public surface every implementation must provide.
 *
 * All async because the production impl is database-backed; the in-memory
 * impl returns immediately resolved promises for contract uniformity.
 */
export interface LedgerRepository {
  /**
   * Creates a new account. Throws DuplicateAccountError if (ownerId, type, currency)
   * already exists for user/bonus types, or if id is already used.
   */
  createAccount(input: CreateAccountInput): Promise<Account>;

  /**
   * Returns the account with the given id, or null if not found.
   * Use getAccount when null is acceptable; use requireAccount otherwise.
   */
  findAccount(id: string): Promise<Account | null>;

  /**
   * Returns the account with the given id; throws AccountNotFoundError if not found.
   */
  requireAccount(id: string): Promise<Account>;

  /**
   * Records a transaction atomically.
   *
   * - Validates structure (zero-sum per currency, distinct accounts, etc.)
   * - Verifies all account IDs exist
   * - Verifies entry currencies match account currencies
   * - Verifies user/bonus accounts will not go negative
   * - Honours idempotencyKey: returns the original transaction on replay
   *
   * Returns the recorded Transaction with all fields populated.
   */
  recordTransaction(input: ProposedTransaction): Promise<Transaction>;

  /**
   * Returns the balance of an account in the given currency.
   * Throws AccountNotFoundError if the account doesn't exist.
   * Throws CurrencyMismatchError if the requested currency differs from
   * the account's currency.
   */
  getBalance(accountId: string, currency: Currency): Promise<bigint>;

  /**
   * Returns ledger entries for an account, newest first.
   * Pagination via `beforeId`.
   */
  getEntries(accountId: string, options?: GetEntriesOptions): Promise<LedgerEntry[]>;

  /**
   * Looks up a transaction by id or idempotency key. Returns null if not found.
   */
  findTransaction(idOrIdempotencyKey: string): Promise<Transaction | null>;
}
