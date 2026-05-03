// packages/ledger/tests/validate.test.ts

import { describe, expect, it } from 'vitest';

import {
  assertValidEntry,
  assertValidTransaction,
  LedgerValidationError,
} from '../src/validate.js';
import type { ProposedEntry, ProposedTransaction } from '../src/types.js';

function entry(over: Partial<ProposedEntry> = {}): ProposedEntry {
  return {
    accountId: 'acc-a',
    amount: 100n,
    currency: 'INTERNAL_USDT',
    transactionType: 'bet_stake',
    ...over,
  };
}

describe('assertValidEntry', () => {
  it('accepts a valid entry', () => {
    expect(() => {
      assertValidEntry(entry());
    }).not.toThrow();
  });

  it('rejects empty accountId', () => {
    expect(() => {
      assertValidEntry(entry({ accountId: '' }));
    }).toThrow(LedgerValidationError);
  });

  it('rejects non-bigint amount', () => {
    expect(() => {
      assertValidEntry(entry({ amount: 100 as unknown as bigint }));
    }).toThrow(/bigint/);
  });

  it('rejects zero amount', () => {
    expect(() => {
      assertValidEntry(entry({ amount: 0n }));
    }).toThrow(/zero-amount/);
  });

  it('rejects unknown currency', () => {
    expect(() => {
      assertValidEntry(entry({ currency: 'EUR' as 'BTC' }));
    }).toThrow(/unknown currency/);
  });

  it('rejects empty transactionType', () => {
    expect(() => {
      assertValidEntry(entry({ transactionType: '' as 'bet_stake' }));
    }).toThrow(/transactionType/);
  });
});

describe('assertValidTransaction', () => {
  it('accepts a balanced 2-account transaction', () => {
    const tx: ProposedTransaction = {
      entries: [
        entry({ accountId: 'acc-a', amount: -100n }),
        entry({ accountId: 'acc-b', amount: 100n }),
      ],
    };
    expect(() => {
      assertValidTransaction(tx);
    }).not.toThrow();
  });

  it('accepts a 4-entry, 2-currency conversion transaction', () => {
    const tx: ProposedTransaction = {
      entries: [
        entry({ accountId: 'acc-a', amount: -100n, currency: 'BTC' }),
        entry({ accountId: 'acc-b', amount: 100n, currency: 'BTC' }),
        entry({ accountId: 'acc-c', amount: 5000n, currency: 'INTERNAL_USDT' }),
        entry({ accountId: 'acc-d', amount: -5000n, currency: 'INTERNAL_USDT' }),
      ],
    };
    expect(() => {
      assertValidTransaction(tx);
    }).not.toThrow();
  });

  it('rejects empty entries', () => {
    expect(() => {
      assertValidTransaction({ entries: [] });
    }).toThrow(/at least one entry/);
  });

  it('rejects non-array entries', () => {
    expect(() => {
      assertValidTransaction({
        entries: 'nope' as unknown as readonly ProposedEntry[],
      });
    }).toThrow(/entries array/);
  });

  it('rejects single-account transaction', () => {
    const tx: ProposedTransaction = {
      entries: [
        entry({ accountId: 'acc-a', amount: -100n }),
        entry({ accountId: 'acc-a', amount: 100n }),
      ],
    };
    expect(() => {
      assertValidTransaction(tx);
    }).toThrow(/at least two distinct accounts/);
  });

  it('rejects unbalanced single-currency transaction', () => {
    const tx: ProposedTransaction = {
      entries: [
        entry({ accountId: 'acc-a', amount: -100n }),
        entry({ accountId: 'acc-b', amount: 99n }),
      ],
    };
    expect(() => {
      assertValidTransaction(tx);
    }).toThrow(/not balanced/);
  });

  it('rejects unbalanced one-currency-side of multi-currency transaction', () => {
    const tx: ProposedTransaction = {
      entries: [
        entry({ accountId: 'acc-a', amount: -100n, currency: 'BTC' }),
        entry({ accountId: 'acc-b', amount: 100n, currency: 'BTC' }),
        entry({ accountId: 'acc-c', amount: 5000n, currency: 'INTERNAL_USDT' }),
        entry({ accountId: 'acc-d', amount: -4999n, currency: 'INTERNAL_USDT' }),
      ],
    };
    expect(() => {
      assertValidTransaction(tx);
    }).toThrow(/not balanced in INTERNAL_USDT/);
  });

  it('accepts valid idempotency key', () => {
    const tx: ProposedTransaction = {
      idempotencyKey: 'bet_stake:abc123',
      entries: [
        entry({ accountId: 'acc-a', amount: -100n }),
        entry({ accountId: 'acc-b', amount: 100n }),
      ],
    };
    expect(() => {
      assertValidTransaction(tx);
    }).not.toThrow();
  });

  it('rejects empty idempotency key', () => {
    const tx: ProposedTransaction = {
      idempotencyKey: '',
      entries: [
        entry({ accountId: 'acc-a', amount: -100n }),
        entry({ accountId: 'acc-b', amount: 100n }),
      ],
    };
    expect(() => {
      assertValidTransaction(tx);
    }).toThrow(/idempotencyKey/);
  });

  it('rejects oversized idempotency key', () => {
    const tx: ProposedTransaction = {
      idempotencyKey: 'a'.repeat(201),
      entries: [
        entry({ accountId: 'acc-a', amount: -100n }),
        entry({ accountId: 'acc-b', amount: 100n }),
      ],
    };
    expect(() => {
      assertValidTransaction(tx);
    }).toThrow(/200 chars/);
  });

  it('rejects non-string idempotency key', () => {
    const tx: ProposedTransaction = {
      idempotencyKey: 42 as unknown as string,
      entries: [
        entry({ accountId: 'acc-a', amount: -100n }),
        entry({ accountId: 'acc-b', amount: 100n }),
      ],
    };
    expect(() => {
      assertValidTransaction(tx);
    }).toThrow(/idempotencyKey must be a string/);
  });
});
