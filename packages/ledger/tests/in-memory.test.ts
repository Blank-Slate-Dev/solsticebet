// packages/ledger/tests/in-memory.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  CurrencyMismatchError,
  DuplicateAccountError,
  InMemoryLedgerRepository,
  InsufficientBalanceError,
  parseAmount,
} from '../src/index.js';

let repo: InMemoryLedgerRepository;

beforeEach(() => {
  repo = new InMemoryLedgerRepository();
});

async function setup(): Promise<{
  user: string;
  house: string;
  escrow: string;
}> {
  await repo.createAccount({
    id: 'user-1',
    type: 'user',
    ownerId: 'u-1',
    currency: 'INTERNAL_USDT',
  });
  await repo.createAccount({
    id: 'house',
    type: 'house',
    ownerId: null,
    currency: 'INTERNAL_USDT',
  });
  await repo.createAccount({
    id: 'escrow',
    type: 'escrow',
    ownerId: null,
    currency: 'INTERNAL_USDT',
  });
  return { user: 'user-1', house: 'house', escrow: 'escrow' };
}

describe('createAccount', () => {
  it('creates and returns an account', async () => {
    const acc = await repo.createAccount({
      id: 'a',
      type: 'user',
      ownerId: 'u-1',
      currency: 'BTC',
    });
    expect(acc.id).toBe('a');
    expect(acc.type).toBe('user');
    expect(acc.ownerId).toBe('u-1');
    expect(acc.currency).toBe('BTC');
    expect(acc.createdAt).toBeInstanceOf(Date);
  });

  it('rejects duplicate id', async () => {
    await repo.createAccount({
      id: 'a',
      type: 'user',
      ownerId: 'u-1',
      currency: 'BTC',
    });
    await expect(
      repo.createAccount({
        id: 'a',
        type: 'user',
        ownerId: 'u-2',
        currency: 'ETH',
      }),
    ).rejects.toBeInstanceOf(DuplicateAccountError);
  });

  it('rejects duplicate (owner, type, currency) for user accounts', async () => {
    await repo.createAccount({
      id: 'a',
      type: 'user',
      ownerId: 'u-1',
      currency: 'BTC',
    });
    await expect(
      repo.createAccount({
        id: 'b',
        type: 'user',
        ownerId: 'u-1',
        currency: 'BTC',
      }),
    ).rejects.toBeInstanceOf(DuplicateAccountError);
  });

  it('allows multiple house accounts of the same currency (no owner uniqueness)', async () => {
    await repo.createAccount({
      id: 'h1',
      type: 'house',
      ownerId: null,
      currency: 'INTERNAL_USDT',
    });
    await expect(
      repo.createAccount({
        id: 'h2',
        type: 'house',
        ownerId: null,
        currency: 'INTERNAL_USDT',
      }),
    ).resolves.toBeDefined();
  });
});

describe('findAccount / requireAccount', () => {
  it('findAccount returns null for missing id', async () => {
    expect(await repo.findAccount('nope')).toBeNull();
  });

  it('requireAccount throws AccountNotFoundError for missing id', async () => {
    await expect(repo.requireAccount('nope')).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('returns the created account', async () => {
    const created = await repo.createAccount({
      id: 'x',
      type: 'house',
      ownerId: null,
      currency: 'BTC',
    });
    expect(await repo.findAccount('x')).toEqual(created);
    expect(await repo.requireAccount('x')).toEqual(created);
  });
});

describe('recordTransaction — happy path', () => {
  it('records a balanced 2-entry transaction and updates balances', async () => {
    const { user, house } = await setup();

    // First, fund the user via the house (an "adjustment_credit"-style move)
    const tx = await repo.recordTransaction({
      idempotencyKey: 'fund:1',
      entries: [
        {
          accountId: house,
          amount: -parseAmount('100'),
          currency: 'INTERNAL_USDT',
          transactionType: 'adjustment_credit',
        },
        {
          accountId: user,
          amount: parseAmount('100'),
          currency: 'INTERNAL_USDT',
          transactionType: 'adjustment_credit',
        },
      ],
    });

    expect(tx.id).toBeDefined();
    expect(tx.entries).toHaveLength(2);

    expect(await repo.getBalance(user, 'INTERNAL_USDT')).toBe(parseAmount('100'));
    expect(await repo.getBalance(house, 'INTERNAL_USDT')).toBe(-parseAmount('100'));
  });

  it('preserves the zero-sum invariant on every transaction', async () => {
    const { user, house } = await setup();

    for (let i = 0; i < 10; i++) {
      const amt = parseAmount(String((i + 1) * 10));
      await repo.recordTransaction({
        idempotencyKey: `fund:${String(i)}`,
        entries: [
          {
            accountId: house,
            amount: -amt,
            currency: 'INTERNAL_USDT',
            transactionType: 'adjustment_credit',
          },
          {
            accountId: user,
            amount: amt,
            currency: 'INTERNAL_USDT',
            transactionType: 'adjustment_credit',
          },
        ],
      });
    }

    const userBal = await repo.getBalance(user, 'INTERNAL_USDT');
    const houseBal = await repo.getBalance(house, 'INTERNAL_USDT');
    expect(userBal + houseBal).toBe(0n);
  });
});

describe('recordTransaction — rejection cases', () => {
  it('rejects transactions referencing missing accounts', async () => {
    const { user } = await setup();
    await expect(
      repo.recordTransaction({
        entries: [
          {
            accountId: user,
            amount: -10n,
            currency: 'INTERNAL_USDT',
            transactionType: 'bet_stake',
          },
          {
            accountId: 'missing',
            amount: 10n,
            currency: 'INTERNAL_USDT',
            transactionType: 'bet_stake',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('rejects entries with currency mismatching the account', async () => {
    const { user, house } = await setup();
    await expect(
      repo.recordTransaction({
        entries: [
          {
            accountId: user,
            amount: -10n,
            currency: 'BTC',
            transactionType: 'bet_stake',
          },
          {
            accountId: house,
            amount: 10n,
            currency: 'BTC',
            transactionType: 'bet_stake',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(CurrencyMismatchError);
  });

  it('rejects transactions that would make a user account negative', async () => {
    const { user, escrow } = await setup();
    // user has 0 balance — debiting 100 would overdraft
    await expect(
      repo.recordTransaction({
        entries: [
          {
            accountId: user,
            amount: -parseAmount('100'),
            currency: 'INTERNAL_USDT',
            transactionType: 'bet_stake',
          },
          {
            accountId: escrow,
            amount: parseAmount('100'),
            currency: 'INTERNAL_USDT',
            transactionType: 'bet_stake',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it('allows house accounts to go negative (counterparty to wins)', async () => {
    const { user, house } = await setup();
    // house starts at 0; user starts at 0; this credits user from house.
    // House goes negative — allowed.
    await expect(
      repo.recordTransaction({
        entries: [
          {
            accountId: house,
            amount: -parseAmount('50'),
            currency: 'INTERNAL_USDT',
            transactionType: 'adjustment_credit',
          },
          {
            accountId: user,
            amount: parseAmount('50'),
            currency: 'INTERNAL_USDT',
            transactionType: 'adjustment_credit',
          },
        ],
      }),
    ).resolves.toBeDefined();

    expect(await repo.getBalance(house, 'INTERNAL_USDT')).toBe(-parseAmount('50'));
  });
});

describe('recordTransaction — idempotency', () => {
  it('returns the original transaction on replay with same idempotencyKey', async () => {
    const { user, house } = await setup();
    const input = {
      idempotencyKey: 'replay:1',
      entries: [
        {
          accountId: house,
          amount: -parseAmount('10'),
          currency: 'INTERNAL_USDT' as const,
          transactionType: 'adjustment_credit' as const,
        },
        {
          accountId: user,
          amount: parseAmount('10'),
          currency: 'INTERNAL_USDT' as const,
          transactionType: 'adjustment_credit' as const,
        },
      ],
    };
    const first = await repo.recordTransaction(input);
    const replay = await repo.recordTransaction(input);

    expect(replay.id).toBe(first.id);
    expect(replay.entries).toEqual(first.entries);

    // Critical: balance must not have doubled.
    expect(await repo.getBalance(user, 'INTERNAL_USDT')).toBe(parseAmount('10'));
  });

  it('treats null/undefined idempotencyKey as not idempotent', async () => {
    const { user, house } = await setup();
    const input = {
      entries: [
        {
          accountId: house,
          amount: -parseAmount('10'),
          currency: 'INTERNAL_USDT' as const,
          transactionType: 'adjustment_credit' as const,
        },
        {
          accountId: user,
          amount: parseAmount('10'),
          currency: 'INTERNAL_USDT' as const,
          transactionType: 'adjustment_credit' as const,
        },
      ],
    };
    await repo.recordTransaction(input);
    await repo.recordTransaction(input);
    expect(await repo.getBalance(user, 'INTERNAL_USDT')).toBe(parseAmount('20'));
  });
});

describe('queries', () => {
  it('getBalance throws on missing account', async () => {
    await expect(repo.getBalance('nope', 'BTC')).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('getBalance throws on currency mismatch', async () => {
    await repo.createAccount({
      id: 'a',
      type: 'user',
      ownerId: 'u',
      currency: 'BTC',
    });
    await expect(repo.getBalance('a', 'INTERNAL_USDT')).rejects.toBeInstanceOf(
      CurrencyMismatchError,
    );
  });

  it('getEntries returns newest-first', async () => {
    const { user, house } = await setup();
    for (let i = 0; i < 5; i++) {
      await repo.recordTransaction({
        idempotencyKey: `e:${String(i)}`,
        entries: [
          {
            accountId: house,
            amount: -parseAmount('1'),
            currency: 'INTERNAL_USDT',
            transactionType: 'adjustment_credit',
            metadata: { index: i },
          },
          {
            accountId: user,
            amount: parseAmount('1'),
            currency: 'INTERNAL_USDT',
            transactionType: 'adjustment_credit',
            metadata: { index: i },
          },
        ],
      });
    }
    const entries = await repo.getEntries(user);
    expect(entries).toHaveLength(5);
    expect(entries[0]?.metadata.index).toBe(4);
    expect(entries[4]?.metadata.index).toBe(0);
  });

  it('getEntries respects limit and beforeId pagination', async () => {
    const { user, house } = await setup();
    for (let i = 0; i < 10; i++) {
      await repo.recordTransaction({
        idempotencyKey: `p:${String(i)}`,
        entries: [
          {
            accountId: house,
            amount: -parseAmount('1'),
            currency: 'INTERNAL_USDT',
            transactionType: 'adjustment_credit',
          },
          {
            accountId: user,
            amount: parseAmount('1'),
            currency: 'INTERNAL_USDT',
            transactionType: 'adjustment_credit',
          },
        ],
      });
    }
    const page1 = await repo.getEntries(user, { limit: 4 });
    expect(page1).toHaveLength(4);

    const last = page1[page1.length - 1];
    if (last === undefined) throw new Error('unreachable');
    const page2 = await repo.getEntries(user, { limit: 4, beforeId: last.id });
    expect(page2).toHaveLength(4);
    expect(page2[0]?.id).toBeLessThan(last.id);
  });

  it('getEntries throws on missing account', async () => {
    await expect(repo.getEntries('nope')).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('getEntries rejects invalid limits', async () => {
    const { user } = await setup();
    await expect(repo.getEntries(user, { limit: 0 })).rejects.toBeInstanceOf(RangeError);
    await expect(repo.getEntries(user, { limit: 1001 })).rejects.toBeInstanceOf(RangeError);
    await expect(repo.getEntries(user, { limit: 1.5 })).rejects.toBeInstanceOf(RangeError);
  });

  it('findTransaction by id and by idempotency key', async () => {
    const { user, house } = await setup();
    const tx = await repo.recordTransaction({
      idempotencyKey: 'find:1',
      entries: [
        {
          accountId: house,
          amount: -parseAmount('5'),
          currency: 'INTERNAL_USDT',
          transactionType: 'adjustment_credit',
        },
        {
          accountId: user,
          amount: parseAmount('5'),
          currency: 'INTERNAL_USDT',
          transactionType: 'adjustment_credit',
        },
      ],
    });

    expect(await repo.findTransaction(tx.id)).toEqual(tx);
    expect(await repo.findTransaction('find:1')).toEqual(tx);
    expect(await repo.findTransaction('nope')).toBeNull();
  });
});
