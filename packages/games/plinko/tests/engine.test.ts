// packages/games/plinko/tests/engine.test.ts
//
// Integration tests for Plinko — full pipeline against real RNG and ledger.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  InMemoryLedgerRepository,
  InsufficientBalanceError,
  parseAmount,
  recordAdjustment,
} from '@solsticebet/ledger';
import { derivePlinko } from '@solsticebet/rng';

import { placePlinkoBet } from '../src/engine.js';
import { PlinkoValidationError } from '../src/limits.js';
import { multiplierForBucket } from '../src/math.js';
import type { PlinkoBetInput } from '../src/types.js';

let ledger: InMemoryLedgerRepository;

const USER = 'user-1';
const HOUSE = 'house';
const ESCROW = 'escrow';
const STARTING_BALANCE = parseAmount('1000');

beforeEach(async () => {
  ledger = new InMemoryLedgerRepository();
  await ledger.createAccount({
    id: USER,
    type: 'user',
    ownerId: 'u-1',
    currency: 'INTERNAL_USDT',
  });
  await ledger.createAccount({
    id: HOUSE,
    type: 'house',
    ownerId: null,
    currency: 'INTERNAL_USDT',
  });
  await ledger.createAccount({
    id: ESCROW,
    type: 'escrow',
    ownerId: null,
    currency: 'INTERNAL_USDT',
  });
  await recordAdjustment(ledger, {
    userAccountId: USER,
    houseAccountId: HOUSE,
    amount: STARTING_BALANCE,
    currency: 'INTERNAL_USDT',
    direction: 'credit',
    adminId: 'system',
    requestId: 'seed',
    reason: 'fixture',
  });
});

const baseInput = (over: Partial<PlinkoBetInput> = {}): PlinkoBetInput => ({
  betId: 'b-1',
  userAccountId: USER,
  escrowAccountId: ESCROW,
  houseAccountId: HOUSE,
  stake: parseAmount('1'),
  rows: 8,
  risk: 'medium',
  currency: 'INTERNAL_USDT',
  serverSeed: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  clientSeed: 'plinko-test',
  nonce: 0,
  ...over,
});

describe('placePlinkoBet — determinism', () => {
  it('the engine bucket matches the RNG-derived bucket', async () => {
    const input = baseInput();
    const out = await placePlinkoBet(ledger, input);
    const expected = derivePlinko(input.serverSeed, input.clientSeed, input.nonce, input.rows);
    expect(out.bucket).toBe(expected.bucket);
    expect(out.path.length).toBe(input.rows);
  });

  it('multiplier matches the table for the derived bucket', async () => {
    const input = baseInput();
    const out = await placePlinkoBet(ledger, input);
    const expected = multiplierForBucket(input.rows, input.risk, out.bucket);
    expect(out.multiplier).toBe(expected);
  });
});

describe('placePlinkoBet — settlement branches', () => {
  it('handles a payout > stake (win) by paying user the full payout', async () => {
    // Find a (nonce, rows, risk) combination that lands in an edge bucket.
    // We'll search until we find one. (Deterministic; a specific nonce will land us there.)
    let foundInput: PlinkoBetInput | null = null;
    for (let n = 0; n < 200; n++) {
      const input = baseInput({ nonce: n, betId: `win-${String(n)}`, risk: 'high' });
      const { bucket } = derivePlinko(input.serverSeed, input.clientSeed, input.nonce, input.rows);
      const m = multiplierForBucket(input.rows, input.risk, bucket);
      if (m > 1) {
        foundInput = input;
        break;
      }
    }
    expect(foundInput).not.toBeNull();
    if (foundInput === null) throw new Error('unreachable');

    const balanceBefore = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placePlinkoBet(ledger, foundInput);
    expect(out.isWin).toBe(true);
    expect(out.payout).toBeGreaterThan(out.stake);
    const balanceAfter = await ledger.getBalance(USER, 'INTERNAL_USDT');
    // user delta = payout - stake
    expect(balanceAfter - balanceBefore).toBe(out.payout - out.stake);
  });

  it('handles a partial-payback (multiplier < 1) by paying user fraction of stake', async () => {
    // Find a high-risk loss configuration (most are losses)
    let foundInput: PlinkoBetInput | null = null;
    for (let n = 0; n < 200; n++) {
      const input = baseInput({ nonce: n, betId: `partial-${String(n)}`, risk: 'high' });
      const { bucket } = derivePlinko(input.serverSeed, input.clientSeed, input.nonce, input.rows);
      const m = multiplierForBucket(input.rows, input.risk, bucket);
      if (m > 0 && m < 1) {
        foundInput = input;
        break;
      }
    }
    expect(foundInput).not.toBeNull();
    if (foundInput === null) throw new Error('unreachable');

    const balanceBefore = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placePlinkoBet(ledger, foundInput);
    expect(out.isWin).toBe(false);
    expect(out.payout).toBeGreaterThan(0n);
    expect(out.payout).toBeLessThan(out.stake);
    const balanceAfter = await ledger.getBalance(USER, 'INTERNAL_USDT');
    // user delta = payout - stake (negative)
    expect(balanceAfter - balanceBefore).toBe(out.payout - out.stake);
  });

  it('handles a push (multiplier === 1) by refunding stake', async () => {
    // 8-low has 1.0× multiplier at buckets 3 and 5.
    // Find a configuration that hits bucket 3 or 5.
    let foundInput: PlinkoBetInput | null = null;
    for (let n = 0; n < 200; n++) {
      const input = baseInput({ nonce: n, betId: `push-${String(n)}`, rows: 8, risk: 'low' });
      const { bucket } = derivePlinko(input.serverSeed, input.clientSeed, input.nonce, input.rows);
      if (bucket === 3 || bucket === 5) {
        foundInput = input;
        break;
      }
    }
    expect(foundInput).not.toBeNull();
    if (foundInput === null) throw new Error('unreachable');

    const balanceBefore = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placePlinkoBet(ledger, foundInput);
    expect(out.multiplier).toBe(1);
    expect(out.payout).toBe(out.stake);
    const balanceAfter = await ledger.getBalance(USER, 'INTERNAL_USDT');
    // Net zero: stake debited then full refund
    expect(balanceAfter).toBe(balanceBefore);
  });
});

describe('placePlinkoBet — idempotency', () => {
  it('replaying with the same betId is safe', async () => {
    const input = baseInput({ betId: 'idem-1' });
    const out1 = await placePlinkoBet(ledger, input);
    const balanceAfterFirst = await ledger.getBalance(USER, 'INTERNAL_USDT');

    for (let i = 0; i < 5; i++) {
      const out = await placePlinkoBet(ledger, input);
      expect(out.bucket).toBe(out1.bucket);
      expect(out.payout).toBe(out1.payout);
    }
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(balanceAfterFirst);
  });
});

describe('placePlinkoBet — error paths', () => {
  it('rejects invalid input before any ledger write', async () => {
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    await expect(
      placePlinkoBet(ledger, baseInput({ rows: 7 as unknown as PlinkoBetInput['rows'] })),
    ).rejects.toBeInstanceOf(PlinkoValidationError);
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(before);
  });

  it('rejects insufficient balance via the ledger', async () => {
    await recordAdjustment(ledger, {
      userAccountId: USER,
      houseAccountId: HOUSE,
      amount: parseAmount('999.5'),
      currency: 'INTERNAL_USDT',
      direction: 'debit',
      adminId: 'system',
      requestId: 'drain',
      reason: 'test',
    });
    await expect(
      placePlinkoBet(ledger, baseInput({ stake: parseAmount('1'), betId: 'overdraft' })),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it('rejects stake > MAX_STAKE', async () => {
    await expect(
      placePlinkoBet(ledger, baseInput({ stake: parseAmount('1000') })),
    ).rejects.toBeInstanceOf(PlinkoValidationError);
  });

  it('rejects bad account references', async () => {
    await expect(
      placePlinkoBet(ledger, baseInput({ userAccountId: 'nope' })),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });
});

describe('placePlinkoBet — RTP convergence', () => {
  it('over a large sample, RTP converges within range of theoretical (~99%)', async () => {
    const stake = parseAmount('1');
    const rows = 8 as const;
    const risk = 'medium' as const;
    const N = 1000;
    let totalStaked = 0n;
    let totalPayout = 0n;

    // Top up
    await recordAdjustment(ledger, {
      userAccountId: USER,
      houseAccountId: HOUSE,
      amount: parseAmount('99000'),
      currency: 'INTERNAL_USDT',
      direction: 'credit',
      adminId: 'system',
      requestId: 'topup',
      reason: 'rtp',
    });

    for (let n = 0; n < N; n++) {
      const out = await placePlinkoBet(ledger, {
        betId: `rtp-${String(n)}`,
        userAccountId: USER,
        escrowAccountId: ESCROW,
        houseAccountId: HOUSE,
        stake,
        rows,
        risk,
        currency: 'INTERNAL_USDT',
        serverSeed: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        clientSeed: 'rtp-plinko',
        nonce: n,
      });
      totalStaked += stake;
      totalPayout += out.payout;
    }

    const rtp = Number(totalPayout) / Number(totalStaked);
    // Theoretical ~98.91% for 8-medium. At 1000 samples, allow wide tolerance
    // (Plinko is high-variance; the 13× edge bucket dominates the variance).
    expect(rtp).toBeGreaterThan(0.6);
    expect(rtp).toBeLessThan(1.6);
  });
});
