// packages/ledger/src/in-memory.ts
//
// In-memory implementation of LedgerRepository.
// Used for tests and spec validation. Implements every invariant from
// docs/LEDGER.md in code, the same way the Postgres implementation will.
//
// This implementation is the canonical reference for the contract.
// If a test of the in-memory impl passes, the same test against the
// Postgres impl must also pass — that's how we know the two are equivalent.

import { randomUUID } from 'node:crypto';

import type { Account, LedgerEntry, ProposedTransaction, Transaction } from './types.js';
import {
  AccountNotFoundError,
  CurrencyMismatchError,
  DuplicateAccountError,
  InsufficientBalanceError,
  type CreateAccountInput,
  type GetEntriesOptions,
  type LedgerRepository,
} from './repository.js';
import { assertValidTransaction } from './validate.js';

interface StoredEntry extends LedgerEntry {
  readonly _txCreatedAt: Date;
}

export class InMemoryLedgerRepository implements LedgerRepository {
  // Account storage
  private readonly accountsById = new Map<string, Account>();
  // Index for (ownerId, type, currency) uniqueness on user/bonus accounts
  private readonly accountsByOwnerKey = new Map<string, Account>();

  // Entry storage — single sequential id assignment
  private readonly entries: StoredEntry[] = [];
  private nextEntryId = 1;

  // Transaction storage
  private readonly transactionsById = new Map<string, Transaction>();
  // Idempotency: maps key -> transactionId
  private readonly idempotencyIndex = new Map<string, string>();

  // ─── Account operations ──────────────────────────────────────────

  async createAccount(input: CreateAccountInput): Promise<Account> {
    if (this.accountsById.has(input.id)) {
      throw new DuplicateAccountError(`account id already exists: ${input.id}`);
    }

    const ownerKey = this.buildOwnerKey(input.ownerId, input.type, input.currency);
    if (ownerKey !== null && this.accountsByOwnerKey.has(ownerKey)) {
      throw new DuplicateAccountError(
        `account already exists for ${input.type} owner=${String(input.ownerId)} currency=${input.currency}`,
      );
    }

    const account: Account = {
      id: input.id,
      type: input.type,
      ownerId: input.ownerId,
      currency: input.currency,
      createdAt: new Date(),
    };

    this.accountsById.set(account.id, account);
    if (ownerKey !== null) {
      this.accountsByOwnerKey.set(ownerKey, account);
    }
    return Promise.resolve(account);
  }

  async findAccount(id: string): Promise<Account | null> {
    return Promise.resolve(this.accountsById.get(id) ?? null);
  }

  async requireAccount(id: string): Promise<Account> {
    const account = this.accountsById.get(id);
    if (account === undefined) {
      throw new AccountNotFoundError(id);
    }
    return Promise.resolve(account);
  }

  // ─── Transaction recording ───────────────────────────────────────

  async recordTransaction(input: ProposedTransaction): Promise<Transaction> {
    // Idempotency: short-circuit and return original on replay.
    if (input.idempotencyKey !== undefined && input.idempotencyKey !== null) {
      const existingTxId = this.idempotencyIndex.get(input.idempotencyKey);
      if (existingTxId !== undefined) {
        const existing = this.transactionsById.get(existingTxId);
        /* v8 ignore next 3 -- index integrity invariant */
        if (existing === undefined) {
          throw new Error('invariant: idempotency index points to missing tx');
        }
        return Promise.resolve(existing);
      }
    }

    // Structural validation
    assertValidTransaction(input);

    // Verify accounts exist and currencies match
    for (const entry of input.entries) {
      const account = this.accountsById.get(entry.accountId);
      if (account === undefined) {
        throw new AccountNotFoundError(entry.accountId);
      }
      if (account.currency !== entry.currency) {
        throw new CurrencyMismatchError(
          `entry currency ${entry.currency} does not match account ${entry.accountId} currency ${account.currency}`,
        );
      }
    }

    // Compute proposed balance changes per account
    const deltas = new Map<string, bigint>();
    for (const entry of input.entries) {
      const current = deltas.get(entry.accountId) ?? 0n;
      deltas.set(entry.accountId, current + entry.amount);
    }

    // Verify no user/bonus account would go negative.
    // Check requires reading the current balance of each affected account.
    for (const [accountId, delta] of deltas) {
      const account = this.accountsById.get(accountId);
      /* v8 ignore next 3 -- already verified above; defensive */
      if (account === undefined) {
        throw new AccountNotFoundError(accountId);
      }
      if (account.type === 'user' || account.type === 'bonus') {
        const current = this.computeBalance(accountId, account.currency);
        const projected = current + delta;
        if (projected < 0n) {
          throw new InsufficientBalanceError(accountId, account.currency, -delta, current);
        }
      }
    }

    // All checks passed. Atomically write entries and the transaction record.
    const transactionId = randomUUID();
    const now = new Date();
    const writtenEntries: StoredEntry[] = [];

    for (const proposed of input.entries) {
      const entry: StoredEntry = {
        id: this.nextEntryId++,
        transactionId,
        accountId: proposed.accountId,
        amount: proposed.amount,
        currency: proposed.currency,
        transactionType: proposed.transactionType,
        referenceId: proposed.referenceId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        metadata: { ...(proposed.metadata ?? {}) },
        createdAt: now,
        _txCreatedAt: now,
      };
      this.entries.push(entry);
      writtenEntries.push(entry);
    }

    const transaction: Transaction = {
      id: transactionId,
      entries: writtenEntries.map(stripInternal),
      createdAt: now,
    };
    this.transactionsById.set(transactionId, transaction);

    if (input.idempotencyKey !== undefined && input.idempotencyKey !== null) {
      this.idempotencyIndex.set(input.idempotencyKey, transactionId);
    }

    return Promise.resolve(transaction);
  }

  // ─── Queries ─────────────────────────────────────────────────────

  async getBalance(accountId: string, currency: string): Promise<bigint> {
    const account = this.accountsById.get(accountId);
    if (account === undefined) {
      throw new AccountNotFoundError(accountId);
    }
    if (account.currency !== currency) {
      throw new CurrencyMismatchError(
        `account ${accountId} currency is ${account.currency}, requested ${currency}`,
      );
    }
    return Promise.resolve(this.computeBalance(accountId, account.currency));
  }

  async getEntries(accountId: string, options: GetEntriesOptions = {}): Promise<LedgerEntry[]> {
    if (!this.accountsById.has(accountId)) {
      throw new AccountNotFoundError(accountId);
    }
    const limit = options.limit ?? 100;
    if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) {
      throw new RangeError('limit must be a positive integer <= 1000');
    }

    const beforeId = options.beforeId ?? Number.POSITIVE_INFINITY;
    const result: LedgerEntry[] = [];
    // Iterate in reverse for newest-first
    for (let i = this.entries.length - 1; i >= 0 && result.length < limit; i--) {
      const e = this.entries[i];
      /* v8 ignore next -- iteration bounds are correct by construction */
      if (e === undefined) continue;
      if (e.accountId !== accountId) continue;
      if (e.id >= beforeId) continue;
      result.push(stripInternal(e));
    }
    return Promise.resolve(result);
  }

  async findTransaction(idOrIdempotencyKey: string): Promise<Transaction | null> {
    const direct = this.transactionsById.get(idOrIdempotencyKey);
    if (direct !== undefined) return Promise.resolve(direct);

    const viaIdempotency = this.idempotencyIndex.get(idOrIdempotencyKey);
    if (viaIdempotency !== undefined) {
      const tx = this.transactionsById.get(viaIdempotency);
      return Promise.resolve(tx ?? null);
    }
    return Promise.resolve(null);
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  /**
   * Computes the balance of an account by summing entries.
   * The repository never stores a "balance" value — it is always derived.
   */
  private computeBalance(accountId: string, currency: string): bigint {
    let sum = 0n;
    for (const entry of this.entries) {
      if (entry.accountId === accountId && entry.currency === currency) {
        sum += entry.amount;
      }
    }
    return sum;
  }

  private buildOwnerKey(ownerId: string | null, type: string, currency: string): string | null {
    if (type !== 'user' && type !== 'bonus') return null;
    if (ownerId === null) return null;
    return `${type}:${ownerId}:${currency}`;
  }
}

function stripInternal(e: StoredEntry): LedgerEntry {
  const { _txCreatedAt: _ignored, ...rest } = e;
  return rest;
}
