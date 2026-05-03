// packages/games/uth/tests/engine.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  InMemoryLedgerRepository,
  parseAmount,
  recordAdjustment,
} from '@solsticebet/ledger';

import {
  checkFlop,
  checkPreflop,
  fold,
  raise1x,
  raise2x,
  raise3x,
  raise4x,
  startCoup,
} from '../src/engine.js';
import { UthValidationError } from '../src/limits.js';
import { CoupNotFoundError, InMemoryUthCoupRepository } from '../src/repository.js';
import type { StartUthCoupInput } from '../src/types.js';

let ledger: InMemoryLedgerRepository;
let coups: InMemoryUthCoupRepository;

const USER = 'user-1';
const HOUSE = 'house';
const ESCROW = 'escrow';
const STARTING_BALANCE = parseAmount('1000');

const SERVER_SEED = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

beforeEach(async () => {
  ledger = new InMemoryLedgerRepository();
  coups = new InMemoryUthCoupRepository();
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

const baseInput = (over: Partial<StartUthCoupInput> = {}): StartUthCoupInput => ({
  coupId: 'c-1',
  userAccountId: USER,
  escrowAccountId: ESCROW,
  houseAccountId: HOUSE,
  ante: parseAmount('1'),
  trips: 0n,
  currency: 'INTERNAL_USDT',
  serverSeed: SERVER_SEED,
  clientSeed: 'uth-test',
  nonce: 0,
  ...over,
});

describe('startCoup', () => {
  it('debits ante + blind, deals 9 cards, sets phase preflop', async () => {
    const c = await startCoup(ledger, coups, baseInput());
    expect(c.cards.length).toBe(9);
    expect(c.ante).toBe(parseAmount('1'));
    expect(c.blind).toBe(parseAmount('1'));
    expect(c.totalCommitted).toBe(parseAmount('2'));
    expect(c.phase).toBe('preflop');
  });

  it('with trips, debits ante + blind + trips', async () => {
    const c = await startCoup(
      ledger,
      coups,
      baseInput({
        coupId: 'with-trips',
        ante: parseAmount('1'),
        trips: parseAmount('0.5'),
      }),
    );
    expect(c.trips).toBe(parseAmount('0.5'));
    expect(c.totalCommitted).toBe(parseAmount('2.5'));
  });

  it('is idempotent on coupId', async () => {
    const a = await startCoup(ledger, coups, baseInput());
    const b = await startCoup(ledger, coups, baseInput());
    expect(b.coupId).toBe(a.coupId);
  });

  it('rejects bad account refs', async () => {
    await expect(
      startCoup(ledger, coups, baseInput({ userAccountId: 'nope' })),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });
});

describe('action flow', () => {
  it('raise_4x settles the coup immediately', async () => {
    const c = await startCoup(ledger, coups, baseInput({ coupId: 'r4-1' }));
    const final = await raise4x(ledger, coups, c.coupId);
    expect(final.phase).toBe('settled');
    expect(final.playerHand).not.toBeNull();
    expect(final.dealerHand).not.toBeNull();
    expect(final.totalCommitted).toBe(parseAmount('6')); // 1+1+4
  });

  it('raise_3x also settles immediately', async () => {
    const c = await startCoup(ledger, coups, baseInput({ coupId: 'r3-1' }));
    const final = await raise3x(ledger, coups, c.coupId);
    expect(final.phase).toBe('settled');
    expect(final.totalCommitted).toBe(parseAmount('5')); // 1+1+3
  });

  it('check_preflop → flop phase', async () => {
    const c = await startCoup(ledger, coups, baseInput({ coupId: 'cp-1' }));
    const flop = await checkPreflop(ledger, coups, c.coupId);
    expect(flop.phase).toBe('flop');
  });

  it('full check_preflop → check_flop → raise_1x flow', async () => {
    const c = await startCoup(ledger, coups, baseInput({ coupId: 'full-1' }));
    let r = await checkPreflop(ledger, coups, c.coupId);
    expect(r.phase).toBe('flop');
    r = await checkFlop(ledger, coups, c.coupId);
    expect(r.phase).toBe('river');
    r = await raise1x(ledger, coups, c.coupId);
    expect(r.phase).toBe('settled');
    expect(r.totalCommitted).toBe(parseAmount('3')); // 1+1+1
  });

  it('check → check → fold loses ante and blind', async () => {
    const c = await startCoup(ledger, coups, baseInput({ coupId: 'fold-1' }));
    await checkPreflop(ledger, coups, c.coupId);
    await checkFlop(ledger, coups, c.coupId);
    const balanceBefore = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(balanceBefore).toBe(parseAmount('998')); // started 1000, ante+blind = 2
    const final = await fold(ledger, coups, c.coupId);
    expect(final.phase).toBe('settled');
    expect(final.folded).toBe(true);
    // Ante and Blind both lose. Trips would settle but we have 0 trips here.
    // Net balance change: -2 (ante + blind both forfeited)
    const balanceAfter = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(balanceAfter).toBe(parseAmount('998'));
  });

  it('check_flop → raise_2x settles', async () => {
    const c = await startCoup(ledger, coups, baseInput({ coupId: 'r2-1' }));
    await checkPreflop(ledger, coups, c.coupId);
    const final = await raise2x(ledger, coups, c.coupId);
    expect(final.phase).toBe('settled');
    expect(final.totalCommitted).toBe(parseAmount('4')); // 1+1+2
  });
});

describe('action flow — error paths', () => {
  it('rejects raise_2x at preflop phase', async () => {
    const c = await startCoup(ledger, coups, baseInput({ coupId: 'err-1' }));
    await expect(raise2x(ledger, coups, c.coupId)).rejects.toBeInstanceOf(UthValidationError);
  });

  it('rejects raise_4x post-flop', async () => {
    const c = await startCoup(ledger, coups, baseInput({ coupId: 'err-2' }));
    await checkPreflop(ledger, coups, c.coupId);
    await expect(raise4x(ledger, coups, c.coupId)).rejects.toBeInstanceOf(UthValidationError);
  });

  it('rejects fold at preflop or flop', async () => {
    const c = await startCoup(ledger, coups, baseInput({ coupId: 'err-3' }));
    await expect(fold(ledger, coups, c.coupId)).rejects.toBeInstanceOf(UthValidationError);
    await checkPreflop(ledger, coups, c.coupId);
    await expect(fold(ledger, coups, c.coupId)).rejects.toBeInstanceOf(UthValidationError);
  });

  it('rejects actions on settled coup', async () => {
    const c = await startCoup(ledger, coups, baseInput({ coupId: 'err-4' }));
    await raise4x(ledger, coups, c.coupId);
    await expect(raise3x(ledger, coups, c.coupId)).rejects.toThrow();
  });

  it('rejects actions on missing coup', async () => {
    await expect(raise4x(ledger, coups, 'nope')).rejects.toBeInstanceOf(CoupNotFoundError);
  });

  it('rejects check_preflop after preflop', async () => {
    const c = await startCoup(ledger, coups, baseInput({ coupId: 'err-5' }));
    await checkPreflop(ledger, coups, c.coupId);
    await expect(checkPreflop(ledger, coups, c.coupId)).rejects.toThrow();
  });

  it('rejects check_flop before preflop check', async () => {
    const c = await startCoup(ledger, coups, baseInput({ coupId: 'err-6' }));
    await expect(checkFlop(ledger, coups, c.coupId)).rejects.toThrow();
  });
});

describe('balance accounting', () => {
  it('balance reflects total committed', async () => {
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const c = await startCoup(
      ledger,
      coups,
      baseInput({ coupId: 'bal-1', ante: parseAmount('1'), trips: parseAmount('0.5') }),
    );
    const afterStart = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(before - afterStart).toBe(parseAmount('2.5')); // ante + blind + trips
    await raise4x(ledger, coups, c.coupId);
    const afterRaise = await ledger.getBalance(USER, 'INTERNAL_USDT');
    // After 4x raise: an additional 4 USDT debited (then settlement returns various amounts)
    // We just verify the round resolved without crashing.
    expect(afterRaise).toBeDefined();
  });
});
