// packages/ledger/src/validate.ts
//
// Validation of proposed transactions before they hit the repository.
// Every invariant from docs/LEDGER.md § 2.2 is checked here.

import type { ProposedEntry, ProposedTransaction } from './types.js';
import { isCurrency } from './types.js';

export class LedgerValidationError extends Error {
  override readonly name: string = 'LedgerValidationError';
}

/**
 * Validates a proposed transaction's structure. Does not check balances
 * or account existence — those are repository-level concerns.
 *
 * Enforces:
 * - Non-empty entries
 * - Each entry has a valid currency
 * - At least 2 distinct accounts touched
 * - All amounts non-zero (no no-op rows)
 * - Per-currency zero-sum: for each currency in the transaction, sum = 0
 *
 * @throws LedgerValidationError on any invariant failure
 */
export function assertValidTransaction(tx: ProposedTransaction): void {
  // We accept the input typed but verify at runtime; the type system can't
  // protect against external callers casting through unknown.
  const entriesUnknown: unknown = tx.entries;
  if (!Array.isArray(entriesUnknown)) {
    throw new LedgerValidationError('transaction must have an entries array');
  }
  const entries = entriesUnknown as readonly ProposedEntry[];
  if (entries.length === 0) {
    throw new LedgerValidationError('transaction must have at least one entry');
  }

  const accountIdsSeen = new Set<string>();
  const sumByCurrency = new Map<string, bigint>();

  for (const entry of entries) {
    assertValidEntry(entry);
    accountIdsSeen.add(entry.accountId);
    const current = sumByCurrency.get(entry.currency) ?? 0n;
    sumByCurrency.set(entry.currency, current + entry.amount);
  }

  if (accountIdsSeen.size < 2) {
    throw new LedgerValidationError('transaction must touch at least two distinct accounts');
  }

  for (const [currency, sum] of sumByCurrency) {
    if (sum !== 0n) {
      throw new LedgerValidationError(
        `transaction is not balanced in ${currency}: net = ${sum.toString()}`,
      );
    }
  }

  if (tx.idempotencyKey !== undefined && tx.idempotencyKey !== null) {
    if (typeof tx.idempotencyKey !== 'string') {
      throw new LedgerValidationError('idempotencyKey must be a string');
    }
    if (tx.idempotencyKey.length === 0) {
      throw new LedgerValidationError('idempotencyKey must not be empty');
    }
    if (tx.idempotencyKey.length > 200) {
      throw new LedgerValidationError('idempotencyKey must be <= 200 chars');
    }
  }
}

/**
 * Validates a single proposed entry's structure.
 *
 * @throws LedgerValidationError on any invariant failure
 */
export function assertValidEntry(entry: ProposedEntry): void {
  if (typeof entry.accountId !== 'string' || entry.accountId.length === 0) {
    throw new LedgerValidationError('entry must have a non-empty accountId');
  }
  if (typeof entry.amount !== 'bigint') {
    throw new LedgerValidationError('entry amount must be a bigint');
  }
  if (entry.amount === 0n) {
    throw new LedgerValidationError(
      `zero-amount entries are forbidden (account ${entry.accountId})`,
    );
  }
  if (!isCurrency(entry.currency)) {
    throw new LedgerValidationError(`unknown currency: ${String(entry.currency)}`);
  }
  if (typeof entry.transactionType !== 'string' || entry.transactionType.length === 0) {
    throw new LedgerValidationError('entry must have a transactionType');
  }
}
