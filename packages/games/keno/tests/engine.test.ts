// packages/games/keno/tests/engine.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  InMemoryLedgerRepository,
  parseAmount,
  recordAdjustment,
} from '@solsticebet/ledger';
import { deriveKeno } from '@solsticebet/rng';

import { placeKenoBet } from '../src/engine.js';
import { KenoValidationError } from '../src/limits.js';
import { multiplierFor } from '../src/tables.js';
import type { KenoBetInput } from '../src/types.js';

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

const input = (over: Partial<KenoBetInput> = {}): KenoBetInput => ({
  betId: 'b-1',
  userAccountId: USER,
  escrowAccountId: ESCROW,
  houseAccountId: HOUSE,
  stake: parseAmount('1'),
  picks: [1, 2, 3, 4, 5],
  risk: 'classic',
  currency: 'INTERNAL_USDT',
  serverSeed: SEED,
  clientSeed: 'k-test',
  nonce: 0,
  ...over,
});

describe('multiplierFor', () => {
  it('returns the expected payouts from the classic table', () => {
    expect(multiplierFor(1, 1, 'classic')).toBe(1.85);
    expect(multiplierFor(10, 10, 'classic')).toBe(1000);
    expect(multiplierFor(5, 5, 'classic')).toBe(300);
    expect(multiplierFor(2, 0, 'classic')).toBe(0);
  });

  it('rejects bad inputs', () => {
    expect(() => multiplierFor(0, 0, 'classic')).toThrow();
    expect(() => multiplierFor(11, 5, 'classic')).toThrow();
    expect(() => multiplierFor(5, -1, 'classic')).toThrow();
    expect(() => multiplierFor(5, 6, 'classic')).toThrow();
  });
});

describe('placeKenoBet', () => {
  it('engine result matches RNG', async () => {
    const out = await placeKenoBet(ledger, input());
    expect(out.drawn).toEqual(deriveKeno(SEED, 'k-test', 0).drawn);
  });

  it('counts hits correctly', async () => {
    const tenPicks = Array.from({ length: 10 }, (_, i) => i + 1);
    const out = await placeKenoBet(ledger, input({ picks: tenPicks }));
    const drawnSet = new Set(out.drawn);
    let expected = 0;
    for (const p of out.picks) {
      if (drawnSet.has(p)) expected += 1;
    }
    expect(out.hits).toBe(expected);
  });

  it('idempotent', async () => {
    const a = await placeKenoBet(ledger, input({ betId: 'idem' }));
    const b = await placeKenoBet(ledger, input({ betId: 'idem' }));
    expect(a.drawn).toEqual(b.drawn);
    expect(a.hits).toBe(b.hits);
  });

  it('rejects empty picks / bad picks', async () => {
    await expect(placeKenoBet(ledger, input({ picks: [] }))).rejects.toBeInstanceOf(
      KenoValidationError,
    );
    await expect(
      placeKenoBet(ledger, input({ picks: Array.from({ length: 11 }, (_, i) => i + 1) })),
    ).rejects.toBeInstanceOf(KenoValidationError);
    await expect(placeKenoBet(ledger, input({ picks: [0] }))).rejects.toBeInstanceOf(
      KenoValidationError,
    );
    await expect(placeKenoBet(ledger, input({ picks: [81] }))).rejects.toBeInstanceOf(
      KenoValidationError,
    );
    await expect(placeKenoBet(ledger, input({ picks: [1, 1] }))).rejects.toBeInstanceOf(
      KenoValidationError,
    );
  });

  it('rejects bad risk', async () => {
    await expect(
      placeKenoBet(ledger, input({ risk: 'extreme' as KenoBetInput['risk'] })),
    ).rejects.toThrow(/risk/);
  });

  it('rejects non-array picks', async () => {
    await expect(
      placeKenoBet(ledger, input({ picks: 'nope' as unknown as readonly number[] })),
    ).rejects.toThrow(/array/);
  });

  it('rejects empty fields', async () => {
    await expect(placeKenoBet(ledger, input({ betId: '' }))).rejects.toThrow(/betId/);
    await expect(placeKenoBet(ledger, input({ userAccountId: '' }))).rejects.toThrow(
      /userAccountId/,
    );
    await expect(placeKenoBet(ledger, input({ escrowAccountId: '' }))).rejects.toThrow(
      /escrowAccountId/,
    );
    await expect(placeKenoBet(ledger, input({ houseAccountId: '' }))).rejects.toThrow(
      /houseAccountId/,
    );
  });

  it('rejects stake out of bounds', async () => {
    await expect(placeKenoBet(ledger, input({ stake: 0n }))).rejects.toBeInstanceOf(
      KenoValidationError,
    );
    await expect(placeKenoBet(ledger, input({ stake: parseAmount('999') }))).rejects.toBeInstanceOf(
      KenoValidationError,
    );
  });

  it('rejects non-bigint stake', async () => {
    await expect(placeKenoBet(ledger, input({ stake: 1 as unknown as bigint }))).rejects.toThrow(
      /bigint/,
    );
  });

  it('rejects non-USDT currency', async () => {
    await expect(placeKenoBet(ledger, input({ currency: 'BTC' }))).rejects.toThrow(/INTERNAL_USDT/);
  });

  it('rejects bad accounts', async () => {
    await expect(placeKenoBet(ledger, input({ userAccountId: 'nope' }))).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
  });
});
