// packages/games/crash/tests/engine.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  InMemoryLedgerRepository,
  InsufficientBalanceError,
  parseAmount,
  recordAdjustment,
} from '@solsticebet/ledger';
import { deriveCrash } from '@solsticebet/rng';

import { placeCrashBet } from '../src/engine.js';
import { CrashValidationError } from '../src/limits.js';
import type { CrashBetInput } from '../src/types.js';

let ledger: InMemoryLedgerRepository;

const USER = 'user-1';
const HOUSE = 'house';
const ESCROW = 'escrow';
const STARTING_BALANCE = parseAmount('1000');

const SERVER_SEED = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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

const baseInput = (over: Partial<CrashBetInput> = {}): CrashBetInput => ({
  betId: 'b-1',
  userAccountId: USER,
  escrowAccountId: ESCROW,
  houseAccountId: HOUSE,
  stake: parseAmount('10'),
  autoCashOut: 2.0,
  currency: 'INTERNAL_USDT',
  serverSeed: SERVER_SEED,
  clientSeed: 'crash-test',
  nonce: 0,
  ...over,
});

describe('placeCrashBet — determinism', () => {
  it('engine bustAt matches deriveCrash', async () => {
    const input = baseInput();
    const out = await placeCrashBet(ledger, input);
    const expected = deriveCrash(input.serverSeed, input.clientSeed, input.nonce);
    expect(out.bustAt).toBe(expected.bustAt);
  });
});

describe('placeCrashBet — winning bet', () => {
  it('credits user with payout', async () => {
    // Find a nonce where bust >= 2.0
    let winningInput: CrashBetInput | null = null;
    for (let n = 0; n < 200; n++) {
      const { bustAt } = deriveCrash(SERVER_SEED, 'crash-test', n);
      if (bustAt >= 2.0) {
        winningInput = baseInput({ betId: `win-${String(n)}`, nonce: n });
        break;
      }
    }
    if (winningInput === null) throw new Error('no winning nonce found in 200 tries');

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeCrashBet(ledger, winningInput);
    expect(out.isWin).toBe(true);
    expect(out.payout).toBe(parseAmount('20')); // 10 × 2.0
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(parseAmount('10')); // net +10 on a 10 stake at 2.0×
  });
});

describe('placeCrashBet — losing bet', () => {
  it('forfeits stake', async () => {
    // Find a nonce where bust < 2.0
    let losingInput: CrashBetInput | null = null;
    for (let n = 0; n < 200; n++) {
      const { bustAt } = deriveCrash(SERVER_SEED, 'crash-test', n);
      if (bustAt < 2.0) {
        losingInput = baseInput({ betId: `loss-${String(n)}`, nonce: n });
        break;
      }
    }
    if (losingInput === null) throw new Error('no losing nonce found in 200 tries');

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeCrashBet(ledger, losingInput);
    expect(out.isWin).toBe(false);
    expect(out.payout).toBe(0n);
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(-parseAmount('10'));
  });
});

describe('placeCrashBet — idempotency', () => {
  it('replaying with the same betId is safe', async () => {
    const input = baseInput({ betId: 'idem-1' });
    const o1 = await placeCrashBet(ledger, input);
    const balanceAfterFirst = await ledger.getBalance(USER, 'INTERNAL_USDT');

    for (let i = 0; i < 5; i++) {
      const r = await placeCrashBet(ledger, input);
      expect(r.bustAt).toBe(o1.bustAt);
      expect(r.payout).toBe(o1.payout);
    }
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(balanceAfterFirst);
  });
});

describe('placeCrashBet — error paths', () => {
  it('rejects invalid auto-cash-out before any ledger write', async () => {
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    await expect(placeCrashBet(ledger, baseInput({ autoCashOut: 1.0 }))).rejects.toBeInstanceOf(
      CrashValidationError,
    );
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(before);
  });

  it('rejects payout exceeding MAX_PAYOUT', async () => {
    // 1000 stake × 1,000,000 multiplier = 1B; MAX_PAYOUT is 100k.
    await expect(
      placeCrashBet(
        ledger,
        baseInput({
          stake: parseAmount('1000'),
          autoCashOut: 1000,
          betId: 'cap',
        }),
      ),
    ).rejects.toBeInstanceOf(CrashValidationError);
  });

  it('rejects bad account references', async () => {
    await expect(
      placeCrashBet(ledger, baseInput({ userAccountId: 'nope' })),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('insufficient balance bubbles up', async () => {
    await recordAdjustment(ledger, {
      userAccountId: USER,
      houseAccountId: HOUSE,
      amount: parseAmount('999'),
      currency: 'INTERNAL_USDT',
      direction: 'debit',
      adminId: 'system',
      requestId: 'drain',
      reason: 'test',
    });
    await expect(
      placeCrashBet(ledger, baseInput({ stake: parseAmount('100'), betId: 'overdraft' })),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });
});

describe('placeCrashBet — RTP convergence', () => {
  it('over many bets at 2x cash-out, RTP converges toward ~97%', async () => {
    const stake = parseAmount('1');
    const N = 1000;
    let totalStaked = 0n;
    let totalPayout = 0n;

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
      const out = await placeCrashBet(ledger, {
        betId: `rtp-${String(n)}`,
        userAccountId: USER,
        escrowAccountId: ESCROW,
        houseAccountId: HOUSE,
        stake,
        autoCashOut: 2.0,
        currency: 'INTERNAL_USDT',
        serverSeed: SERVER_SEED,
        clientSeed: 'rtp-crash',
        nonce: n,
      });
      totalStaked += stake;
      totalPayout += out.payout;
    }

    const rtp = Number(totalPayout) / Number(totalStaked);
    // Theoretical ~97%. At 1000 samples allow ±15pp.
    expect(rtp).toBeGreaterThan(0.82);
    expect(rtp).toBeLessThan(1.12);
  });
});
