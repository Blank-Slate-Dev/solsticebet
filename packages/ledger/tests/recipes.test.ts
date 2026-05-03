// packages/ledger/tests/recipes.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  InMemoryLedgerRepository,
  parseAmount,
  recordAdjustment,
  recordBetLoss,
  recordBetRefund,
  recordBetStake,
  recordBetWin,
  recordBonusForfeit,
  recordBonusGrant,
  recordBonusRelease,
} from '../src/index.js';

let repo: InMemoryLedgerRepository;
const USER = 'user-1';
const BONUS = 'bonus-1';
const HOUSE = 'house';
const ESCROW = 'escrow';

beforeEach(async () => {
  repo = new InMemoryLedgerRepository();
  await repo.createAccount({
    id: USER,
    type: 'user',
    ownerId: 'u-1',
    currency: 'INTERNAL_USDT',
  });
  await repo.createAccount({
    id: BONUS,
    type: 'bonus',
    ownerId: 'u-1',
    currency: 'INTERNAL_USDT',
  });
  await repo.createAccount({
    id: HOUSE,
    type: 'house',
    ownerId: null,
    currency: 'INTERNAL_USDT',
  });
  await repo.createAccount({
    id: ESCROW,
    type: 'escrow',
    ownerId: null,
    currency: 'INTERNAL_USDT',
  });
  // Fund the user with 1000 via a startup adjustment
  await recordAdjustment(repo, {
    userAccountId: USER,
    houseAccountId: HOUSE,
    amount: parseAmount('1000'),
    currency: 'INTERNAL_USDT',
    direction: 'credit',
    adminId: 'system',
    requestId: 'seed',
    reason: 'test setup',
  });
});

describe('recordBetStake', () => {
  it('debits user, credits escrow', async () => {
    const tx = await recordBetStake(repo, {
      userAccountId: USER,
      escrowAccountId: ESCROW,
      stake: parseAmount('10'),
      currency: 'INTERNAL_USDT',
      betId: 'bet-1',
    });
    expect(tx.entries).toHaveLength(2);
    expect(await repo.getBalance(USER, 'INTERNAL_USDT')).toBe(parseAmount('990'));
    expect(await repo.getBalance(ESCROW, 'INTERNAL_USDT')).toBe(parseAmount('10'));
  });

  it('is idempotent on the same betId', async () => {
    await recordBetStake(repo, {
      userAccountId: USER,
      escrowAccountId: ESCROW,
      stake: parseAmount('10'),
      currency: 'INTERNAL_USDT',
      betId: 'bet-2',
    });
    await recordBetStake(repo, {
      userAccountId: USER,
      escrowAccountId: ESCROW,
      stake: parseAmount('10'),
      currency: 'INTERNAL_USDT',
      betId: 'bet-2',
    });
    expect(await repo.getBalance(USER, 'INTERNAL_USDT')).toBe(parseAmount('990'));
    expect(await repo.getBalance(ESCROW, 'INTERNAL_USDT')).toBe(parseAmount('10'));
  });

  it('rejects non-positive stake', async () => {
    await expect(
      recordBetStake(repo, {
        userAccountId: USER,
        escrowAccountId: ESCROW,
        stake: 0n,
        currency: 'INTERNAL_USDT',
        betId: 'bet-zero',
      }),
    ).rejects.toThrow();
  });
});

describe('recordBetWin', () => {
  it('returns stake from escrow + house funds the win', async () => {
    await recordBetStake(repo, {
      userAccountId: USER,
      escrowAccountId: ESCROW,
      stake: parseAmount('10'),
      currency: 'INTERNAL_USDT',
      betId: 'win-1',
    });

    // 2x payout
    await recordBetWin(repo, {
      userAccountId: USER,
      escrowAccountId: ESCROW,
      houseAccountId: HOUSE,
      stake: parseAmount('10'),
      payout: parseAmount('20'),
      currency: 'INTERNAL_USDT',
      betId: 'win-1',
    });

    // user is back to 1000 (paid 10 stake, won 20 back) + 0 = 1000? Let's check.
    // start: 1000. stake -10 → 990. win pays out 20 → 1010.
    expect(await repo.getBalance(USER, 'INTERNAL_USDT')).toBe(parseAmount('1010'));
    expect(await repo.getBalance(ESCROW, 'INTERNAL_USDT')).toBe(0n);
    // House started at -1000 (funded user), then loses (20-10) = -10 more → -1010
    expect(await repo.getBalance(HOUSE, 'INTERNAL_USDT')).toBe(-parseAmount('1010'));
  });

  it('rejects payout <= stake (use refund for pushes)', async () => {
    await recordBetStake(repo, {
      userAccountId: USER,
      escrowAccountId: ESCROW,
      stake: parseAmount('10'),
      currency: 'INTERNAL_USDT',
      betId: 'push-1',
    });
    await expect(
      recordBetWin(repo, {
        userAccountId: USER,
        escrowAccountId: ESCROW,
        houseAccountId: HOUSE,
        stake: parseAmount('10'),
        payout: parseAmount('10'),
        currency: 'INTERNAL_USDT',
        betId: 'push-1',
      }),
    ).rejects.toThrow(/payout > stake/);
  });
});

describe('recordBetLoss', () => {
  it('moves the stake from escrow to house', async () => {
    await recordBetStake(repo, {
      userAccountId: USER,
      escrowAccountId: ESCROW,
      stake: parseAmount('10'),
      currency: 'INTERNAL_USDT',
      betId: 'loss-1',
    });
    await recordBetLoss(repo, {
      escrowAccountId: ESCROW,
      houseAccountId: HOUSE,
      stake: parseAmount('10'),
      currency: 'INTERNAL_USDT',
      betId: 'loss-1',
    });

    // user: 990 (stake gone)
    expect(await repo.getBalance(USER, 'INTERNAL_USDT')).toBe(parseAmount('990'));
    // escrow: 0
    expect(await repo.getBalance(ESCROW, 'INTERNAL_USDT')).toBe(0n);
    // house: was -1000 (funded user), gains 10 → -990
    expect(await repo.getBalance(HOUSE, 'INTERNAL_USDT')).toBe(-parseAmount('990'));
  });
});

describe('recordBetRefund', () => {
  it('returns the stake to user', async () => {
    await recordBetStake(repo, {
      userAccountId: USER,
      escrowAccountId: ESCROW,
      stake: parseAmount('10'),
      currency: 'INTERNAL_USDT',
      betId: 'refund-1',
    });
    await recordBetRefund(repo, {
      userAccountId: USER,
      escrowAccountId: ESCROW,
      stake: parseAmount('10'),
      currency: 'INTERNAL_USDT',
      betId: 'refund-1',
      reason: 'technical-void',
    });

    expect(await repo.getBalance(USER, 'INTERNAL_USDT')).toBe(parseAmount('1000'));
    expect(await repo.getBalance(ESCROW, 'INTERNAL_USDT')).toBe(0n);
  });

  it('records the reason in metadata', async () => {
    await recordBetStake(repo, {
      userAccountId: USER,
      escrowAccountId: ESCROW,
      stake: parseAmount('10'),
      currency: 'INTERNAL_USDT',
      betId: 'refund-2',
    });
    const tx = await recordBetRefund(repo, {
      userAccountId: USER,
      escrowAccountId: ESCROW,
      stake: parseAmount('10'),
      currency: 'INTERNAL_USDT',
      betId: 'refund-2',
      reason: 'manual-void',
    });
    for (const e of tx.entries) {
      expect(e.metadata.reason).toBe('manual-void');
    }
  });
});

describe('recordAdjustment', () => {
  it('credit moves house → user', async () => {
    const before = await repo.getBalance(USER, 'INTERNAL_USDT');
    await recordAdjustment(repo, {
      userAccountId: USER,
      houseAccountId: HOUSE,
      amount: parseAmount('5'),
      currency: 'INTERNAL_USDT',
      direction: 'credit',
      adminId: 'admin-1',
      requestId: 'adj-1',
      reason: 'goodwill',
    });
    expect(await repo.getBalance(USER, 'INTERNAL_USDT')).toBe(before + parseAmount('5'));
  });

  it('debit moves user → house', async () => {
    const before = await repo.getBalance(USER, 'INTERNAL_USDT');
    await recordAdjustment(repo, {
      userAccountId: USER,
      houseAccountId: HOUSE,
      amount: parseAmount('5'),
      currency: 'INTERNAL_USDT',
      direction: 'debit',
      adminId: 'admin-1',
      requestId: 'adj-2',
      reason: 'fraud-clawback',
    });
    expect(await repo.getBalance(USER, 'INTERNAL_USDT')).toBe(before - parseAmount('5'));
  });

  it('records adminId and reason in metadata', async () => {
    const tx = await recordAdjustment(repo, {
      userAccountId: USER,
      houseAccountId: HOUSE,
      amount: parseAmount('1'),
      currency: 'INTERNAL_USDT',
      direction: 'credit',
      adminId: 'admin-9',
      requestId: 'adj-meta',
      reason: 'test',
    });
    for (const e of tx.entries) {
      expect(e.metadata.adminId).toBe('admin-9');
      expect(e.metadata.reason).toBe('test');
    }
  });

  it('uses transactionType matching direction', async () => {
    const tx1 = await recordAdjustment(repo, {
      userAccountId: USER,
      houseAccountId: HOUSE,
      amount: parseAmount('1'),
      currency: 'INTERNAL_USDT',
      direction: 'credit',
      adminId: 'a',
      requestId: 'tx-c',
      reason: '.',
    });
    for (const e of tx1.entries) {
      expect(e.transactionType).toBe('adjustment_credit');
    }
    const tx2 = await recordAdjustment(repo, {
      userAccountId: USER,
      houseAccountId: HOUSE,
      amount: parseAmount('1'),
      currency: 'INTERNAL_USDT',
      direction: 'debit',
      adminId: 'a',
      requestId: 'tx-d',
      reason: '.',
    });
    for (const e of tx2.entries) {
      expect(e.transactionType).toBe('adjustment_debit');
    }
  });
});

describe('bonus recipes', () => {
  it('grant moves house → bonus account', async () => {
    await recordBonusGrant(repo, {
      bonusAccountId: BONUS,
      houseAccountId: HOUSE,
      amount: parseAmount('50'),
      currency: 'INTERNAL_USDT',
      bonusId: 'b-1',
    });
    expect(await repo.getBalance(BONUS, 'INTERNAL_USDT')).toBe(parseAmount('50'));
  });

  it('release moves bonus → user', async () => {
    await recordBonusGrant(repo, {
      bonusAccountId: BONUS,
      houseAccountId: HOUSE,
      amount: parseAmount('50'),
      currency: 'INTERNAL_USDT',
      bonusId: 'b-2',
    });
    await recordBonusRelease(repo, {
      userAccountId: USER,
      bonusAccountId: BONUS,
      amount: parseAmount('50'),
      currency: 'INTERNAL_USDT',
      bonusId: 'b-2',
    });
    expect(await repo.getBalance(BONUS, 'INTERNAL_USDT')).toBe(0n);
    expect(await repo.getBalance(USER, 'INTERNAL_USDT')).toBe(parseAmount('1050'));
  });

  it('forfeit moves bonus → house', async () => {
    await recordBonusGrant(repo, {
      bonusAccountId: BONUS,
      houseAccountId: HOUSE,
      amount: parseAmount('50'),
      currency: 'INTERNAL_USDT',
      bonusId: 'b-3',
    });
    await recordBonusForfeit(repo, {
      bonusAccountId: BONUS,
      houseAccountId: HOUSE,
      amount: parseAmount('50'),
      currency: 'INTERNAL_USDT',
      bonusId: 'b-3',
    });
    expect(await repo.getBalance(BONUS, 'INTERNAL_USDT')).toBe(0n);
    // House: -1000 (initial) - 50 (grant) + 50 (forfeit) = -1000
    expect(await repo.getBalance(HOUSE, 'INTERNAL_USDT')).toBe(-parseAmount('1000'));
  });
});
