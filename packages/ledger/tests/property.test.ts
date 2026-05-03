// packages/ledger/tests/property.test.ts
//
// Property tests: generate sequences of random valid transactions, verify
// the zero-sum and balance invariants always hold.

import { describe, expect, it } from 'vitest';

import {
  InMemoryLedgerRepository,
  parseAmount,
  recordAdjustment,
  recordBetLoss,
  recordBetStake,
  recordBetWin,
  type LedgerRepository,
} from '../src/index.js';

const RANDOM_SEED = 12345;

/**
 * Tiny seeded PRNG for reproducibility of property tests.
 * NOT for production use — it's mulberry32, fine for test-only randomness.
 */
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Fixture {
  repo: LedgerRepository;
  user: string;
  house: string;
  escrow: string;
}

async function makeFixture(): Promise<Fixture> {
  const repo = new InMemoryLedgerRepository();
  await repo.createAccount({
    id: 'user',
    type: 'user',
    ownerId: 'u',
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
  // Seed user with 100,000
  await recordAdjustment(repo, {
    userAccountId: 'user',
    houseAccountId: 'house',
    amount: parseAmount('100000'),
    currency: 'INTERNAL_USDT',
    direction: 'credit',
    adminId: 'system',
    requestId: 'seed',
    reason: 'fixture',
  });
  return { repo, user: 'user', house: 'house', escrow: 'escrow' };
}

describe('property: zero-sum invariant', () => {
  it('every recorded transaction has entries summing to zero', async () => {
    const { repo, user, house, escrow } = await makeFixture();
    const rand = mulberry32(RANDOM_SEED);

    for (let i = 0; i < 200; i++) {
      const action = Math.floor(rand() * 3);
      const stakeUsdt = Math.floor(rand() * 10) + 1; // 1..10
      const stake = parseAmount(stakeUsdt.toString());
      const betId = `prop-bet-${String(i)}`;

      try {
        if (action === 0) {
          await recordBetStake(repo, {
            userAccountId: user,
            escrowAccountId: escrow,
            stake,
            currency: 'INTERNAL_USDT',
            betId,
          });
          // Then loss or win
          if (rand() < 0.5) {
            await recordBetLoss(repo, {
              escrowAccountId: escrow,
              houseAccountId: house,
              stake,
              currency: 'INTERNAL_USDT',
              betId,
            });
          } else {
            await recordBetWin(repo, {
              userAccountId: user,
              escrowAccountId: escrow,
              houseAccountId: house,
              stake,
              payout: stake * 2n, // 2x win
              currency: 'INTERNAL_USDT',
              betId,
            });
          }
        } else if (action === 1) {
          // Pure adjustment credit
          await recordAdjustment(repo, {
            userAccountId: user,
            houseAccountId: house,
            amount: stake,
            currency: 'INTERNAL_USDT',
            direction: 'credit',
            adminId: 'sys',
            requestId: `adj-c-${String(i)}`,
            reason: 'prop',
          });
        } else {
          // Pure adjustment debit
          await recordAdjustment(repo, {
            userAccountId: user,
            houseAccountId: house,
            amount: stake,
            currency: 'INTERNAL_USDT',
            direction: 'debit',
            adminId: 'sys',
            requestId: `adj-d-${String(i)}`,
            reason: 'prop',
          });
        }
      } catch {
        // Some random sequences attempt to overdraft; we ignore those — they're
        // correctly rejected. The point is: anything that DOES land must hold
        // the invariants. We assert that next.
      }
    }

    // Invariant 1: total of all balances equals zero (no money created).
    const userBal = await repo.getBalance(user, 'INTERNAL_USDT');
    const houseBal = await repo.getBalance(house, 'INTERNAL_USDT');
    const escrowBal = await repo.getBalance(escrow, 'INTERNAL_USDT');
    expect(userBal + houseBal + escrowBal).toBe(0n);

    // Invariant 2: user balance is non-negative (writer enforces this).
    expect(userBal).toBeGreaterThanOrEqual(0n);

    // Invariant 3: escrow balance is non-negative (every stake is paired with
    // a settle/loss/refund within this test).
    expect(escrowBal).toBeGreaterThanOrEqual(0n);
  });
});

describe('property: balance is always derivable from entries', () => {
  it('summing entries == getBalance for any account, after any sequence', async () => {
    const { repo, user, house } = await makeFixture();
    const rand = mulberry32(RANDOM_SEED + 1);

    for (let i = 0; i < 50; i++) {
      const amount = parseAmount(String(Math.floor(rand() * 100) + 1));
      const direction: 'credit' | 'debit' = rand() < 0.5 ? 'credit' : 'debit';
      try {
        await recordAdjustment(repo, {
          userAccountId: user,
          houseAccountId: house,
          amount,
          currency: 'INTERNAL_USDT',
          direction,
          adminId: 'sys',
          requestId: `bal-${String(i)}`,
          reason: 'prop',
        });
      } catch {
        // Overdraft rejection — fine.
      }
    }

    // The reported balance must equal the sum of entries.
    const reported = await repo.getBalance(user, 'INTERNAL_USDT');
    const entries = await repo.getEntries(user, { limit: 1000 });
    let summed = 0n;
    for (const e of entries) summed += e.amount;
    expect(summed).toBe(reported);
  });
});

describe('property: idempotency replays do not double-spend', () => {
  it('replaying any successful transaction by idempotencyKey is a no-op', async () => {
    const { repo, user, escrow } = await makeFixture();
    const balBefore = await repo.getBalance(user, 'INTERNAL_USDT');

    await recordBetStake(repo, {
      userAccountId: user,
      escrowAccountId: escrow,
      stake: parseAmount('10'),
      currency: 'INTERNAL_USDT',
      betId: 'idem-1',
    });

    // Replay the same operation 5 times
    for (let i = 0; i < 5; i++) {
      await recordBetStake(repo, {
        userAccountId: user,
        escrowAccountId: escrow,
        stake: parseAmount('10'),
        currency: 'INTERNAL_USDT',
        betId: 'idem-1',
      });
    }

    // User balance changed by exactly -10 across 6 calls.
    expect(await repo.getBalance(user, 'INTERNAL_USDT')).toBe(balBefore - parseAmount('10'));
    expect(await repo.getBalance(escrow, 'INTERNAL_USDT')).toBe(parseAmount('10'));
  });
});
