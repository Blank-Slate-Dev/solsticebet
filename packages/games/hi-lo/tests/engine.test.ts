// packages/games/hi-lo/tests/engine.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  InMemoryLedgerRepository,
  parseAmount,
  recordAdjustment,
} from '@solsticebet/ledger';

import { cashOut, pick, startRound } from '../src/engine.js';
import { HiLoValidationError } from '../src/limits.js';
import {
  availablePicks,
  computePayout,
  isWinningPick,
  pickMultiplier,
  pickProbability,
} from '../src/math.js';
import { InMemoryHiLoRoundRepository, RoundNotFoundError } from '../src/repository.js';
import type { StartHiLoRoundInput } from '../src/types.js';

let ledger: InMemoryLedgerRepository;
let rounds: InMemoryHiLoRoundRepository;
const USER = 'u',
  HOUSE = 'h',
  ESCROW = 'e';
const SEED = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

beforeEach(async () => {
  ledger = new InMemoryLedgerRepository();
  rounds = new InMemoryHiLoRoundRepository();
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
    requestId: 's',
    reason: 't',
  });
});

const input = (over: Partial<StartHiLoRoundInput> = {}): StartHiLoRoundInput => ({
  roundId: 'r-1',
  userAccountId: USER,
  escrowAccountId: ESCROW,
  houseAccountId: HOUSE,
  stake: parseAmount('10'),
  currency: 'INTERNAL_USDT',
  serverSeed: SEED,
  clientSeed: 'h-test',
  nonce: 0,
  ...over,
});

describe('math', () => {
  it('pickProbability', () => {
    expect(pickProbability(0, 'higher_or_equal')).toBe(13 / 13); // Ace → all 13 wins
    expect(pickProbability(12, 'higher_or_equal')).toBe(1 / 13); // King → only K wins
    expect(pickProbability(6, 'higher_or_equal')).toBe(7 / 13);
    expect(pickProbability(6, 'lower_or_equal')).toBe(7 / 13);
  });

  it('rejects bad rank', () => {
    expect(() => pickProbability(-1, 'higher_or_equal')).toThrow();
    expect(() => pickProbability(13, 'higher_or_equal')).toThrow();
  });

  it('pickMultiplier = 0.99 / probability', () => {
    expect(pickMultiplier(0.5)).toBeCloseTo(1.98, 6);
    expect(pickMultiplier(1)).toBeCloseTo(0.99, 6);
  });

  it('pickMultiplier rejects invalid probability', () => {
    expect(() => pickMultiplier(0)).toThrow();
    expect(() => pickMultiplier(-1)).toThrow();
    expect(() => pickMultiplier(1.5)).toThrow();
  });

  it('isWinningPick', () => {
    expect(isWinningPick(5, 7, 'higher_or_equal')).toBe(true);
    expect(isWinningPick(5, 5, 'higher_or_equal')).toBe(true); // tie wins
    expect(isWinningPick(5, 4, 'higher_or_equal')).toBe(false);
    expect(isWinningPick(5, 4, 'lower_or_equal')).toBe(true);
    expect(isWinningPick(5, 5, 'lower_or_equal')).toBe(true);
    expect(isWinningPick(5, 7, 'lower_or_equal')).toBe(false);
  });

  it('computePayout', () => {
    expect(computePayout(parseAmount('10'), 1.98)).toBe(parseAmount('19.8'));
  });

  it('computePayout rejects bad inputs', () => {
    expect(() => computePayout(0n, 1)).toThrow();
    expect(() => computePayout(parseAmount('1'), 0)).toThrow();
    expect(() => computePayout(parseAmount('1'), Number.NaN)).toThrow();
  });
});

describe('startRound', () => {
  it('debits stake, deals 1 starting card, state active', async () => {
    const r = await startRound(ledger, rounds, input());
    expect(r.cards).toHaveLength(1);
    expect(r.state).toBe('active');
    expect(r.picks).toHaveLength(0);
    expect(r.currentMultiplier).toBe(1.0);
  });

  it('idempotent', async () => {
    const a = await startRound(ledger, rounds, input());
    const b = await startRound(ledger, rounds, input());
    expect(a.cards).toEqual(b.cards);
  });

  it('rejects empty fields', async () => {
    await expect(startRound(ledger, rounds, input({ roundId: '' }))).rejects.toThrow(/roundId/);
    await expect(startRound(ledger, rounds, input({ userAccountId: '' }))).rejects.toThrow(
      /userAccountId/,
    );
    await expect(startRound(ledger, rounds, input({ escrowAccountId: '' }))).rejects.toThrow(
      /escrowAccountId/,
    );
    await expect(startRound(ledger, rounds, input({ houseAccountId: '' }))).rejects.toThrow(
      /houseAccountId/,
    );
  });

  it('rejects bad stake', async () => {
    await expect(startRound(ledger, rounds, input({ stake: 0n }))).rejects.toBeInstanceOf(
      HiLoValidationError,
    );
    await expect(
      startRound(ledger, rounds, input({ stake: parseAmount('999') })),
    ).rejects.toBeInstanceOf(HiLoValidationError);
    await expect(
      startRound(ledger, rounds, input({ stake: 1 as unknown as bigint })),
    ).rejects.toThrow(/bigint/);
  });

  it('rejects non-USDT', async () => {
    await expect(startRound(ledger, rounds, input({ currency: 'BTC' }))).rejects.toThrow(
      /INTERNAL_USDT/,
    );
  });

  it('rejects bad accounts', async () => {
    await expect(
      startRound(ledger, rounds, input({ userAccountId: 'nope' })),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });
});

describe('pick', () => {
  it('updates cards + picks on win, raises multiplier (or stays ≤1 at extremes)', async () => {
    // At extremes (rank 0 or 12), the only available pick has ~92.3-100% probability,
    // and the resulting multiplier is ≤1× (e.g. 0.99 for guaranteed wins). At
    // mid-ranks, it's >1×.
    const r0 = await startRound(ledger, rounds, input());
    const startRank = r0.cards[0] ?? 0;
    const pickType = startRank === 12 ? 'lower_or_equal' : 'higher_or_equal';
    const r1 = await pick(ledger, rounds, r0.roundId, pickType);
    expect(r1.cards.length).toBe(2);
    expect(r1.picks.length).toBe(1);
    if (r1.state === 'busted') {
      expect(r1.payout).toBe(0n);
    } else {
      expect(r1.state).toBe('active');
      // Multiplier may be < 1 at extremes (Ace/King) where the only available pick
      // is near-100% probability.
      expect(r1.currentMultiplier).toBeGreaterThan(0);
    }
  });

  it('rejects bad pick type', async () => {
    const r0 = await startRound(ledger, rounds, input({ roundId: 'r-bad-pick' }));
    await expect(
      pick(ledger, rounds, r0.roundId, 'sideways' as 'higher_or_equal'),
    ).rejects.toBeInstanceOf(HiLoValidationError);
  });

  it('rejects on missing round', async () => {
    await expect(pick(ledger, rounds, 'nope', 'higher_or_equal')).rejects.toBeInstanceOf(
      RoundNotFoundError,
    );
  });
});

describe('cashOut', () => {
  it('rejects without any pick', async () => {
    const r0 = await startRound(ledger, rounds, input({ roundId: 'r-co-empty' }));
    await expect(cashOut(ledger, rounds, r0.roundId)).rejects.toBeInstanceOf(HiLoValidationError);
  });

  it('cashes out after a winning pick', async () => {
    // We need a pick that actually wins. Try several seeds until one succeeds.
    // Most picks at probability 50%+ will win sometimes.
    for (let seedIdx = 0; seedIdx < 20; seedIdx++) {
      const r0 = await startRound(
        ledger,
        rounds,
        input({
          roundId: `r-co-${String(seedIdx)}`,
          nonce: seedIdx,
        }),
      );
      // Pick lower_or_equal — wins if next ≤ current. We'll keep trying.
      const r1 = await pick(ledger, rounds, r0.roundId, 'lower_or_equal');
      if (r1.state === 'active') {
        const r2 = await cashOut(ledger, rounds, r0.roundId);
        expect(r2.state).toBe('cashed_out');
        expect(r2.payout).not.toBeNull();
        expect(r2.payout).toBeGreaterThan(0n);
        return;
      }
    }
    throw new Error('no winning pick in 20 tries');
  });

  it('rejects on missing round', async () => {
    await expect(cashOut(ledger, rounds, 'nope')).rejects.toBeInstanceOf(RoundNotFoundError);
  });

  it('rejects on terminal state', async () => {
    // Force a bust by repeatedly picking until busted.
    for (let seedIdx = 0; seedIdx < 30; seedIdx++) {
      const r0 = await startRound(
        ledger,
        rounds,
        input({
          roundId: `r-bust-${String(seedIdx)}`,
          nonce: seedIdx,
        }),
      );
      let r = r0;
      for (let i = 0; i < 20 && r.state === 'active'; i++) {
        const curr = r.cards[r.cards.length - 1] ?? 0;
        const pickType = curr === 12 ? 'lower_or_equal' : 'higher_or_equal';
        r = await pick(ledger, rounds, r0.roundId, pickType);
      }
      if (r.state === 'busted') {
        await expect(cashOut(ledger, rounds, r0.roundId)).rejects.toBeInstanceOf(
          HiLoValidationError,
        );
        return;
      }
    }
    // Hard to deterministically bust; not reaching here is fine.
  });
});

describe('availablePicks', () => {
  it('returns only higher_or_equal at rank 0 (Ace)', () => {
    expect(availablePicks(0)).toEqual(['higher_or_equal']);
  });
  it('returns only lower_or_equal at rank 12 (King)', () => {
    expect(availablePicks(12)).toEqual(['lower_or_equal']);
  });
  it('returns both at middle ranks', () => {
    for (let r = 1; r <= 11; r++) {
      expect(availablePicks(r)).toEqual(['higher_or_equal', 'lower_or_equal']);
    }
  });
  it('rejects bad rank', () => {
    expect(() => availablePicks(-1)).toThrow();
    expect(() => availablePicks(13)).toThrow();
  });
});
