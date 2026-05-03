// packages/games/coin-flip/tests/engine.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  InMemoryLedgerRepository,
  InsufficientBalanceError,
  parseAmount,
  recordAdjustment,
} from '@solsticebet/ledger';
import { deriveCoinFlip } from '@solsticebet/rng';

import { placeCoinFlipBet } from '../src/engine.js';
import { CoinFlipValidationError } from '../src/limits.js';
import type { CoinFlipBetInput } from '../src/types.js';

let ledger: InMemoryLedgerRepository;

const USER = 'user-1';
const HOUSE = 'house';
const ESCROW = 'escrow';
const STARTING = parseAmount('1000');
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
    amount: STARTING,
    currency: 'INTERNAL_USDT',
    direction: 'credit',
    adminId: 's',
    requestId: 'seed',
    reason: 't',
  });
});

const baseInput = (over: Partial<CoinFlipBetInput> = {}): CoinFlipBetInput => ({
  betId: 'b-1',
  userAccountId: USER,
  escrowAccountId: ESCROW,
  houseAccountId: HOUSE,
  stake: parseAmount('10'),
  pick: 'heads',
  currency: 'INTERNAL_USDT',
  serverSeed: SEED,
  clientSeed: 'cf-test',
  nonce: 0,
  ...over,
});

describe('placeCoinFlipBet', () => {
  it('engine result matches RNG', async () => {
    const out = await placeCoinFlipBet(ledger, baseInput());
    const expected = deriveCoinFlip(SEED, 'cf-test', 0);
    expect(out.result).toBe(expected.side);
  });

  it('winning bet pays 1.96× stake', async () => {
    let nonce = -1;
    for (let n = 0; n < 100; n++) {
      if (deriveCoinFlip(SEED, 'cf-test', n).side === 'heads') {
        nonce = n;
        break;
      }
    }
    if (nonce < 0) throw new Error('no head in 100 nonces');
    const out = await placeCoinFlipBet(ledger, baseInput({ nonce, betId: 'win', pick: 'heads' }));
    expect(out.isWin).toBe(true);
    expect(out.payout).toBe(parseAmount('19.6')); // 10 × 1.96
  });

  it('losing bet forfeits stake', async () => {
    let nonce = -1;
    for (let n = 0; n < 100; n++) {
      if (deriveCoinFlip(SEED, 'cf-test', n).side === 'tails') {
        nonce = n;
        break;
      }
    }
    if (nonce < 0) throw new Error('no tail');
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeCoinFlipBet(ledger, baseInput({ nonce, betId: 'loss', pick: 'heads' }));
    expect(out.isWin).toBe(false);
    expect(out.payout).toBe(0n);
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(before - parseAmount('10'));
  });

  it('idempotent on betId', async () => {
    const a = await placeCoinFlipBet(ledger, baseInput({ betId: 'idem' }));
    const b = await placeCoinFlipBet(ledger, baseInput({ betId: 'idem' }));
    expect(a.result).toBe(b.result);
  });

  it('rejects invalid pick', async () => {
    await expect(
      placeCoinFlipBet(ledger, baseInput({ pick: 'sideways' as 'heads' })),
    ).rejects.toBeInstanceOf(CoinFlipValidationError);
  });

  it('rejects stake out of bounds', async () => {
    await expect(placeCoinFlipBet(ledger, baseInput({ stake: 0n }))).rejects.toBeInstanceOf(
      CoinFlipValidationError,
    );
    await expect(
      placeCoinFlipBet(ledger, baseInput({ stake: parseAmount('9999') })),
    ).rejects.toBeInstanceOf(CoinFlipValidationError);
  });

  it('rejects empty fields', async () => {
    await expect(placeCoinFlipBet(ledger, baseInput({ betId: '' }))).rejects.toThrow(/betId/);
    await expect(placeCoinFlipBet(ledger, baseInput({ userAccountId: '' }))).rejects.toThrow(
      /userAccountId/,
    );
    await expect(placeCoinFlipBet(ledger, baseInput({ escrowAccountId: '' }))).rejects.toThrow(
      /escrowAccountId/,
    );
    await expect(placeCoinFlipBet(ledger, baseInput({ houseAccountId: '' }))).rejects.toThrow(
      /houseAccountId/,
    );
  });

  it('rejects non-bigint stake', async () => {
    await expect(
      placeCoinFlipBet(ledger, baseInput({ stake: 1 as unknown as bigint })),
    ).rejects.toThrow(/bigint/);
  });

  it('rejects non-USDT currency', async () => {
    await expect(placeCoinFlipBet(ledger, baseInput({ currency: 'BTC' }))).rejects.toThrow(
      /INTERNAL_USDT/,
    );
  });

  it('rejects bad accounts', async () => {
    await expect(
      placeCoinFlipBet(ledger, baseInput({ userAccountId: 'nope' })),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('insufficient balance bubbles up', async () => {
    await recordAdjustment(ledger, {
      userAccountId: USER,
      houseAccountId: HOUSE,
      amount: parseAmount('999'),
      currency: 'INTERNAL_USDT',
      direction: 'debit',
      adminId: 's',
      requestId: 'drain',
      reason: 't',
    });
    await expect(
      placeCoinFlipBet(ledger, baseInput({ stake: parseAmount('100'), betId: 'overdraft' })),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });
});
