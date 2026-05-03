// packages/games/mines/tests/engine.test.ts
//
// Integration tests for the Mines engine — full pipeline against
// a real InMemoryLedgerRepository, the real RNG, and the InMemoryMinesRoundRepository.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  InMemoryLedgerRepository,
  InsufficientBalanceError,
  parseAmount,
  recordAdjustment,
} from '@solsticebet/ledger';
import { deriveMines } from '@solsticebet/rng';

import { cashOut, revealTile, startRound } from '../src/engine.js';
import { MinesValidationError } from '../src/limits.js';
import { multiplierFor, TOTAL_TILES } from '../src/math.js';
import { InMemoryMinesRoundRepository, RoundNotFoundError } from '../src/repository.js';
import type { StartMinesRoundInput } from '../src/types.js';

let ledger: InMemoryLedgerRepository;
let rounds: InMemoryMinesRoundRepository;

const USER = 'user-1';
const HOUSE = 'house';
const ESCROW = 'escrow';
const STARTING_BALANCE = parseAmount('1000');

const SERVER_SEED = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

beforeEach(async () => {
  ledger = new InMemoryLedgerRepository();
  rounds = new InMemoryMinesRoundRepository();
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

const baseInput = (over: Partial<StartMinesRoundInput> = {}): StartMinesRoundInput => ({
  roundId: 'r-1',
  userAccountId: USER,
  escrowAccountId: ESCROW,
  houseAccountId: HOUSE,
  stake: parseAmount('10'),
  mineCount: 3,
  currency: 'INTERNAL_USDT',
  serverSeed: SERVER_SEED,
  clientSeed: 'mines-test',
  nonce: 0,
  ...over,
});

describe('startRound', () => {
  it('debits stake and stores active round', async () => {
    const round = await startRound(ledger, rounds, baseInput());

    expect(round.state).toBe('active');
    expect(round.revealed).toEqual([]);
    expect(round.mineLayout).toHaveLength(TOTAL_TILES);
    expect(round.mineCount).toBe(3);
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(parseAmount('990'));
    expect(await ledger.getBalance(ESCROW, 'INTERNAL_USDT')).toBe(parseAmount('10'));
  });

  it('mineLayout matches what deriveMines produces', async () => {
    const input = baseInput();
    const round = await startRound(ledger, rounds, input);
    const expected = deriveMines(input.serverSeed, input.clientSeed, input.nonce);
    expect([...round.mineLayout]).toEqual([...expected.tilePermutation]);
  });

  it('is idempotent on roundId', async () => {
    const input = baseInput();
    const r1 = await startRound(ledger, rounds, input);
    const r2 = await startRound(ledger, rounds, input);
    expect(r1.roundId).toBe(r2.roundId);
    // Stake is debited only once.
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(parseAmount('990'));
  });

  it('rejects invalid input before any ledger write', async () => {
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    await expect(startRound(ledger, rounds, baseInput({ mineCount: 0 }))).rejects.toBeInstanceOf(
      MinesValidationError,
    );
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(before);
  });

  it('rejects when user balance is insufficient', async () => {
    await expect(
      startRound(ledger, rounds, baseInput({ stake: parseAmount('10000') })),
    ).rejects.toBeInstanceOf(MinesValidationError);
  });

  it('insufficient balance within MAX_STAKE bubbles up', async () => {
    // Drain user
    await recordAdjustment(ledger, {
      userAccountId: USER,
      houseAccountId: HOUSE,
      amount: parseAmount('995'),
      currency: 'INTERNAL_USDT',
      direction: 'debit',
      adminId: 'system',
      requestId: 'drain',
      reason: 'test',
    });
    await expect(
      startRound(ledger, rounds, baseInput({ roundId: 'r-overdraft' })),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it('rejects bad account references', async () => {
    await expect(
      startRound(ledger, rounds, baseInput({ userAccountId: 'nope' })),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });
});

describe('revealTile — safe path', () => {
  it('reveals a known-safe tile and advances multiplier', async () => {
    const input = baseInput();
    const r = await startRound(ledger, rounds, input);
    // Mines are the first 3 indices of the permutation; pick a safe one.
    const safeTile = r.mineLayout[3];
    if (safeTile === undefined) throw new Error('unreachable');

    const out = await revealTile(ledger, rounds, r.roundId, safeTile);
    expect(out.wasMine).toBe(false);
    expect(out.round.state).toBe('active');
    expect(out.round.revealed).toEqual([safeTile]);
    expect(out.currentMultiplier).toBe(multiplierFor(3, 1));
  });

  it('multiple safe reveals stack', async () => {
    const input = baseInput();
    const r = await startRound(ledger, rounds, input);

    // Pick the first 3 safe tiles in order.
    const safeTiles = r.mineLayout.slice(3, 6);
    let prevMul = 1.0;
    for (const tile of safeTiles) {
      const out = await revealTile(ledger, rounds, r.roundId, tile);
      expect(out.wasMine).toBe(false);
      expect(out.currentMultiplier).toBeGreaterThan(prevMul);
      prevMul = out.currentMultiplier;
    }
  });

  it('re-revealing the same tile is a no-op', async () => {
    const input = baseInput();
    const r = await startRound(ledger, rounds, input);
    const tile = r.mineLayout[3];
    if (tile === undefined) throw new Error('unreachable');

    const o1 = await revealTile(ledger, rounds, r.roundId, tile);
    const o2 = await revealTile(ledger, rounds, r.roundId, tile);

    expect(o2.round.revealed).toEqual(o1.round.revealed);
    expect(o2.round.state).toBe('active');
  });
});

describe('revealTile — bust path', () => {
  it('hitting a mine busts the round and pays house', async () => {
    const input = baseInput();
    const r = await startRound(ledger, rounds, input);
    const mineTile = r.mineLayout[0];
    if (mineTile === undefined) throw new Error('unreachable');

    const out = await revealTile(ledger, rounds, r.roundId, mineTile);
    expect(out.wasMine).toBe(true);
    expect(out.round.state).toBe('busted');
    expect(out.round.payout).toBe(0n);
    expect(out.currentMultiplier).toBe(0);

    // Balances: user 990, escrow 0, house -1000 + 10 = -990
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(parseAmount('990'));
    expect(await ledger.getBalance(ESCROW, 'INTERNAL_USDT')).toBe(0n);
    expect(await ledger.getBalance(HOUSE, 'INTERNAL_USDT')).toBe(-parseAmount('990'));
  });

  it('rejects further reveals after bust', async () => {
    const input = baseInput();
    const r = await startRound(ledger, rounds, input);
    const mineTile = r.mineLayout[0];
    const otherTile = r.mineLayout[10];
    if (mineTile === undefined || otherTile === undefined) {
      throw new Error('unreachable');
    }

    await revealTile(ledger, rounds, r.roundId, mineTile);
    await expect(revealTile(ledger, rounds, r.roundId, otherTile)).rejects.toBeInstanceOf(
      MinesValidationError,
    );
  });
});

describe('cashOut', () => {
  it('pays out at the current multiplier and closes the round', async () => {
    const input = baseInput();
    const r = await startRound(ledger, rounds, input);
    const safeTile = r.mineLayout[3];
    if (safeTile === undefined) throw new Error('unreachable');
    await revealTile(ledger, rounds, r.roundId, safeTile);

    const out = await cashOut(ledger, rounds, r.roundId);
    expect(out.round.state).toBe('cashed_out');

    // multiplier(M=3, N=1) = 0.97 * 25/22 ≈ 1.1023
    const mul = multiplierFor(3, 1);
    expect(out.currentMultiplier).toBe(mul);
    // Payout = 10 * mul; computed via computePayout
    expect(out.round.payout).not.toBeNull();
    expect(out.round.payout).toBeGreaterThan(parseAmount('10'));
  });

  it('rejects cashout before any reveal', async () => {
    const input = baseInput();
    const r = await startRound(ledger, rounds, input);
    await expect(cashOut(ledger, rounds, r.roundId)).rejects.toBeInstanceOf(MinesValidationError);
  });

  it('rejects cashout on busted round', async () => {
    const input = baseInput();
    const r = await startRound(ledger, rounds, input);
    const mineTile = r.mineLayout[0];
    if (mineTile === undefined) throw new Error('unreachable');
    await revealTile(ledger, rounds, r.roundId, mineTile);
    await expect(cashOut(ledger, rounds, r.roundId)).rejects.toBeInstanceOf(MinesValidationError);
  });

  it('is idempotent on a cashed-out round', async () => {
    const input = baseInput();
    const r = await startRound(ledger, rounds, input);
    const safeTile = r.mineLayout[3];
    if (safeTile === undefined) throw new Error('unreachable');
    await revealTile(ledger, rounds, r.roundId, safeTile);

    const o1 = await cashOut(ledger, rounds, r.roundId);
    const balanceAfterFirst = await ledger.getBalance(USER, 'INTERNAL_USDT');

    const o2 = await cashOut(ledger, rounds, r.roundId);
    expect(o2.round.payout).toBe(o1.round.payout);
    // Balance does not change on the replay
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(balanceAfterFirst);
  });

  it('cashOut on missing round throws RoundNotFoundError', async () => {
    await expect(cashOut(ledger, rounds, 'missing')).rejects.toBeInstanceOf(RoundNotFoundError);
  });
});

describe('auto-cash on full clear', () => {
  it('revealing all 24 safe tiles auto-cashes at max multiplier', async () => {
    // M=1: max safe = 24, max multiplier = 24.25
    const input = baseInput({ mineCount: 1, roundId: 'autocash-1' });
    const r = await startRound(ledger, rounds, input);
    const safeTiles = r.mineLayout.slice(1); // skip the single mine

    for (let i = 0; i < safeTiles.length - 1; i++) {
      const tile = safeTiles[i];
      if (tile === undefined) throw new Error('unreachable');
      await revealTile(ledger, rounds, r.roundId, tile);
    }
    // Last safe tile triggers auto-cash
    const lastTile = safeTiles[safeTiles.length - 1];
    if (lastTile === undefined) throw new Error('unreachable');
    const out = await revealTile(ledger, rounds, r.roundId, lastTile);

    expect(out.round.state).toBe('cashed_out');
    expect(out.round.finalMultiplier).toBe(24.25);
    expect(out.round.payout).toBe(parseAmount('242.5'));
  });
});

describe('revealTile — error paths', () => {
  it('throws on missing round', async () => {
    await expect(revealTile(ledger, rounds, 'missing', 0)).rejects.toBeInstanceOf(
      RoundNotFoundError,
    );
  });

  it('rejects out-of-bounds tile index', async () => {
    const input = baseInput();
    const r = await startRound(ledger, rounds, input);
    await expect(revealTile(ledger, rounds, r.roundId, 25)).rejects.toBeInstanceOf(
      MinesValidationError,
    );
  });
});
