// packages/games/lucky-wheel/tests/engine.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  InMemoryLedgerRepository,
  InsufficientBalanceError,
  parseAmount,
  recordAdjustment,
} from '@solsticebet/ledger';
import { deriveWheel } from '@solsticebet/rng';

import { placeLuckyWheelBet } from '../src/engine.js';
import { LuckyWheelValidationError } from '../src/limits.js';
import type { LuckyWheelBetInput } from '../src/types.js';
import { SEGMENTS, TOTAL_SEGMENTS, segmentForValue } from '../src/wheel.js';

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
    amount: parseAmount('10000'),
    currency: 'INTERNAL_USDT',
    direction: 'credit',
    adminId: 's',
    requestId: 's',
    reason: 't',
  });
});

const input = (over: Partial<LuckyWheelBetInput> = {}): LuckyWheelBetInput => ({
  betId: 'b-1',
  userAccountId: USER,
  escrowAccountId: ESCROW,
  houseAccountId: HOUSE,
  stake: parseAmount('10'),
  currency: 'INTERNAL_USDT',
  serverSeed: SEED,
  clientSeed: 'lw-test',
  nonce: 0,
  ...over,
});

describe('SEGMENTS table', () => {
  it('has the documented composition', () => {
    expect(TOTAL_SEGMENTS).toBe(54);
    expect(SEGMENTS.filter((s) => s.color === 'gray').length).toBe(30);
    expect(SEGMENTS.filter((s) => s.color === 'green').length).toBe(12);
    expect(SEGMENTS.filter((s) => s.color === 'blue').length).toBe(7);
    expect(SEGMENTS.filter((s) => s.color === 'purple').length).toBe(3);
    expect(SEGMENTS.filter((s) => s.color === 'red').length).toBe(1);
    expect(SEGMENTS.filter((s) => s.color === 'gold').length).toBe(1);
  });

  it('segmentForValue maps to valid index', () => {
    expect(segmentForValue(0)).toBe(0);
    expect(segmentForValue(0.5)).toBe(27);
    expect(segmentForValue(0.999)).toBe(53);
  });

  it('segmentForValue rejects out-of-range', () => {
    expect(() => segmentForValue(-0.1)).toThrow();
    expect(() => segmentForValue(1)).toThrow();
    expect(() => segmentForValue(Number.NaN)).toThrow();
  });
});

describe('placeLuckyWheelBet', () => {
  it('engine result matches RNG segment derivation', async () => {
    const out = await placeLuckyWheelBet(ledger, input());
    const { value } = deriveWheel(SEED, 'lw-test', 0);
    expect(out.segmentIndex).toBe(segmentForValue(value));
  });

  it('idempotent', async () => {
    const a = await placeLuckyWheelBet(ledger, input({ betId: 'idem' }));
    const b = await placeLuckyWheelBet(ledger, input({ betId: 'idem' }));
    expect(a.segmentIndex).toBe(b.segmentIndex);
  });

  it('hitting a gold segment pays 50× stake', async () => {
    let nonce = -1;
    for (let n = 0; n < 5000; n++) {
      const { value } = deriveWheel(SEED, 'lw-test', n);
      if (segmentForValue(value) >= 53) {
        nonce = n;
        break;
      }
    }
    if (nonce < 0) throw new Error('no gold in 5000 nonces');
    const out = await placeLuckyWheelBet(ledger, input({ nonce, betId: 'gold' }));
    expect(out.segment.color).toBe('gold');
    expect(out.payout).toBe(parseAmount('500'));
  });

  it('hitting a gray segment loses', async () => {
    let nonce = -1;
    for (let n = 0; n < 100; n++) {
      const { value } = deriveWheel(SEED, 'lw-test', n);
      if (segmentForValue(value) < 30) {
        nonce = n;
        break;
      }
    }
    if (nonce < 0) throw new Error('no gray');
    const out = await placeLuckyWheelBet(ledger, input({ nonce, betId: 'gray' }));
    expect(out.segment.color).toBe('gray');
    expect(out.payout).toBe(0n);
    expect(out.isWin).toBe(false);
  });

  it('rejects empty fields', async () => {
    await expect(placeLuckyWheelBet(ledger, input({ betId: '' }))).rejects.toThrow(/betId/);
    await expect(placeLuckyWheelBet(ledger, input({ userAccountId: '' }))).rejects.toThrow(
      /userAccountId/,
    );
    await expect(placeLuckyWheelBet(ledger, input({ escrowAccountId: '' }))).rejects.toThrow(
      /escrowAccountId/,
    );
    await expect(placeLuckyWheelBet(ledger, input({ houseAccountId: '' }))).rejects.toThrow(
      /houseAccountId/,
    );
  });

  it('rejects stake out of bounds', async () => {
    await expect(placeLuckyWheelBet(ledger, input({ stake: 0n }))).rejects.toBeInstanceOf(
      LuckyWheelValidationError,
    );
    await expect(
      placeLuckyWheelBet(ledger, input({ stake: parseAmount('9999') })),
    ).rejects.toBeInstanceOf(LuckyWheelValidationError);
  });

  it('rejects non-bigint stake', async () => {
    await expect(
      placeLuckyWheelBet(ledger, input({ stake: 1 as unknown as bigint })),
    ).rejects.toThrow(/bigint/);
  });

  it('rejects non-USDT currency', async () => {
    await expect(placeLuckyWheelBet(ledger, input({ currency: 'BTC' }))).rejects.toThrow(
      /INTERNAL_USDT/,
    );
  });

  it('rejects bad accounts', async () => {
    await expect(
      placeLuckyWheelBet(ledger, input({ userAccountId: 'nope' })),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('insufficient balance bubbles up', async () => {
    await recordAdjustment(ledger, {
      userAccountId: USER,
      houseAccountId: HOUSE,
      amount: parseAmount('9999'),
      currency: 'INTERNAL_USDT',
      direction: 'debit',
      adminId: 's',
      requestId: 'd',
      reason: 't',
    });
    await expect(
      placeLuckyWheelBet(ledger, input({ stake: parseAmount('100'), betId: 'overdraft' })),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });
});
