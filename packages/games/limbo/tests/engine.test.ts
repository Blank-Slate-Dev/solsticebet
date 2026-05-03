// packages/games/limbo/tests/engine.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  InMemoryLedgerRepository,
  InsufficientBalanceError,
  parseAmount,
  recordAdjustment,
} from '@solsticebet/ledger';
import { deriveLimbo } from '@solsticebet/rng';

import { placeLimboBet } from '../src/engine.js';
import { LimboValidationError } from '../src/limits.js';
import type { LimboBetInput } from '../src/types.js';

let ledger: InMemoryLedgerRepository;
const USER = 'u',
  HOUSE = 'h',
  ESCROW = 'e';
const SEED = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

beforeEach(async () => {
  ledger = new InMemoryLedgerRepository();
  await ledger.createAccount({ id: USER, type: 'user', ownerId: 'u', currency: 'INTERNAL_USDT' });
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
    amount: parseAmount('1000'),
    currency: 'INTERNAL_USDT',
    direction: 'credit',
    adminId: 's',
    requestId: 'seed',
    reason: 't',
  });
});

const input = (over: Partial<LimboBetInput> = {}): LimboBetInput => ({
  betId: 'b-1',
  userAccountId: USER,
  escrowAccountId: ESCROW,
  houseAccountId: HOUSE,
  stake: parseAmount('10'),
  target: 2.0,
  currency: 'INTERNAL_USDT',
  serverSeed: SEED,
  clientSeed: 'l-test',
  nonce: 0,
  ...over,
});

describe('placeLimboBet', () => {
  it('engine result matches RNG', async () => {
    const out = await placeLimboBet(ledger, input());
    expect(out.result).toBe(deriveLimbo(SEED, 'l-test', 0).result);
  });

  it('winning bet pays target × stake', async () => {
    let nonce = -1;
    for (let n = 0; n < 200; n++) {
      if (deriveLimbo(SEED, 'l-test', n).result >= 2.0) {
        nonce = n;
        break;
      }
    }
    if (nonce < 0) throw new Error('no win');
    const out = await placeLimboBet(ledger, input({ nonce, betId: 'win' }));
    expect(out.isWin).toBe(true);
    expect(out.payout).toBe(parseAmount('20')); // 10 × 2.0
  });

  it('losing bet forfeits stake', async () => {
    let nonce = -1;
    for (let n = 0; n < 200; n++) {
      if (deriveLimbo(SEED, 'l-test', n).result < 2.0) {
        nonce = n;
        break;
      }
    }
    if (nonce < 0) throw new Error('no loss');
    const out = await placeLimboBet(ledger, input({ nonce, betId: 'loss' }));
    expect(out.isWin).toBe(false);
    expect(out.payout).toBe(0n);
  });

  it('idempotent', async () => {
    const a = await placeLimboBet(ledger, input({ betId: 'idem' }));
    const b = await placeLimboBet(ledger, input({ betId: 'idem' }));
    expect(a.result).toBe(b.result);
  });

  it('rejects target out of bounds', async () => {
    await expect(placeLimboBet(ledger, input({ target: 1.0 }))).rejects.toBeInstanceOf(
      LimboValidationError,
    );
    await expect(placeLimboBet(ledger, input({ target: 9999999 }))).rejects.toBeInstanceOf(
      LimboValidationError,
    );
  });

  it('rejects sub-0.01 precision', async () => {
    await expect(placeLimboBet(ledger, input({ target: 2.005 }))).rejects.toThrow(/0.01/);
  });

  it('rejects non-finite target', async () => {
    await expect(placeLimboBet(ledger, input({ target: Number.NaN }))).rejects.toThrow();
    await expect(placeLimboBet(ledger, input({ target: Infinity }))).rejects.toThrow();
  });

  it('rejects stake out of bounds', async () => {
    await expect(placeLimboBet(ledger, input({ stake: 0n }))).rejects.toBeInstanceOf(
      LimboValidationError,
    );
    await expect(
      placeLimboBet(ledger, input({ stake: parseAmount('9999') })),
    ).rejects.toBeInstanceOf(LimboValidationError);
  });

  it('rejects empty fields', async () => {
    await expect(placeLimboBet(ledger, input({ betId: '' }))).rejects.toThrow(/betId/);
    await expect(placeLimboBet(ledger, input({ userAccountId: '' }))).rejects.toThrow(
      /userAccountId/,
    );
    await expect(placeLimboBet(ledger, input({ escrowAccountId: '' }))).rejects.toThrow(
      /escrowAccountId/,
    );
    await expect(placeLimboBet(ledger, input({ houseAccountId: '' }))).rejects.toThrow(
      /houseAccountId/,
    );
  });

  it('rejects non-bigint stake', async () => {
    await expect(placeLimboBet(ledger, input({ stake: 1 as unknown as bigint }))).rejects.toThrow(
      /bigint/,
    );
  });

  it('rejects non-USDT currency', async () => {
    await expect(placeLimboBet(ledger, input({ currency: 'BTC' }))).rejects.toThrow(
      /INTERNAL_USDT/,
    );
  });

  it('rejects payout exceeding MAX_PAYOUT', async () => {
    await expect(
      placeLimboBet(ledger, input({ stake: parseAmount('1000'), target: 200, betId: 'cap' })),
    ).rejects.toBeInstanceOf(LimboValidationError);
  });

  it('rejects bad accounts', async () => {
    await expect(placeLimboBet(ledger, input({ userAccountId: 'nope' }))).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
  });

  it('insufficient balance bubbles up', async () => {
    await recordAdjustment(ledger, {
      userAccountId: USER,
      houseAccountId: HOUSE,
      amount: parseAmount('999'),
      currency: 'INTERNAL_USDT',
      direction: 'debit',
      adminId: 's',
      requestId: 'd',
      reason: 't',
    });
    await expect(
      placeLimboBet(ledger, input({ stake: parseAmount('100'), betId: 'overdraft' })),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });
});
