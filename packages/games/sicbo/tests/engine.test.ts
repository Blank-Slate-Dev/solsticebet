// packages/games/sicbo/tests/engine.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  InMemoryLedgerRepository,
  InsufficientBalanceError,
  parseAmount,
  recordAdjustment,
} from '@solsticebet/ledger';
import { deriveSicBo } from '@solsticebet/rng';

import { placeSicBoRoll } from '../src/engine.js';
import { SicBoValidationError } from '../src/limits.js';
import type { SicBoRollInput } from '../src/types.js';

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

const baseInput = (over: Partial<SicBoRollInput> = {}): SicBoRollInput => ({
  rollId: 'r-1',
  userAccountId: USER,
  escrowAccountId: ESCROW,
  houseAccountId: HOUSE,
  bets: [{ type: 'small', stake: parseAmount('10') }],
  currency: 'INTERNAL_USDT',
  serverSeed: SERVER_SEED,
  clientSeed: 'sicbo-test',
  nonce: 0,
  ...over,
});

describe('placeSicBoRoll — determinism', () => {
  it('engine dice match deriveSicBo', async () => {
    const input = baseInput();
    const out = await placeSicBoRoll(ledger, input);
    const expected = deriveSicBo(input.serverSeed, input.clientSeed, input.nonce);
    expect(out.dice).toEqual(expected.dice);
    expect(out.total).toBe(out.dice[0] + out.dice[1] + out.dice[2]);
  });
});

describe('placeSicBoRoll — single-bet outcomes', () => {
  it('a winning small bet pays 2× stake net (1:1)', async () => {
    // Find a nonce where small wins (total 4-10, no triple)
    let winInput: SicBoRollInput | null = null;
    for (let n = 0; n < 200; n++) {
      const { dice } = deriveSicBo(SERVER_SEED, 'sicbo-test', n);
      const total = dice[0] + dice[1] + dice[2];
      const triple = dice[0] === dice[1] && dice[1] === dice[2];
      if (!triple && total >= 4 && total <= 10) {
        winInput = baseInput({ rollId: `s-win-${String(n)}`, nonce: n });
        break;
      }
    }
    if (winInput === null) throw new Error('no small-win nonce in 200 tries');

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeSicBoRoll(ledger, winInput);
    expect(out.bets[0]?.isWin).toBe(true);
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(parseAmount('10')); // net +10 on a 10 stake at 1:1
  });

  it('a losing bet forfeits stake', async () => {
    // Bet on big when total is small (no triple)
    let lossInput: SicBoRollInput | null = null;
    for (let n = 0; n < 200; n++) {
      const { dice } = deriveSicBo(SERVER_SEED, 'sicbo-test', n);
      const total = dice[0] + dice[1] + dice[2];
      const triple = dice[0] === dice[1] && dice[1] === dice[2];
      if (!triple && total >= 4 && total <= 10) {
        lossInput = baseInput({
          rollId: `b-loss-${String(n)}`,
          nonce: n,
          bets: [{ type: 'big', stake: parseAmount('10') }],
        });
        break;
      }
    }
    if (lossInput === null) throw new Error('no big-loss nonce');

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeSicBoRoll(ledger, lossInput);
    expect(out.bets[0]?.isWin).toBe(false);
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(-parseAmount('10'));
  });
});

describe('placeSicBoRoll — multi-bet roll', () => {
  it('settles all bets atomically against one roll', async () => {
    const input = baseInput({
      rollId: 'multi-1',
      bets: [
        { type: 'small', stake: parseAmount('5') },
        { type: 'big', stake: parseAmount('5') },
        { type: 'any_triple', stake: parseAmount('1') },
        { type: 'specific_double', stake: parseAmount('2'), target: 4 },
      ],
    });
    const out = await placeSicBoRoll(ledger, input);
    expect(out.totalStake).toBe(parseAmount('13'));

    let expected = 0n;
    for (const b of out.bets) {
      if (b.isWin) expected += b.payout;
    }
    expect(out.totalPayout).toBe(expected);
  });
});

describe('placeSicBoRoll — idempotency', () => {
  it('replaying with same rollId is safe', async () => {
    const input = baseInput({ rollId: 'idem-1' });
    const o1 = await placeSicBoRoll(ledger, input);
    const balanceAfterFirst = await ledger.getBalance(USER, 'INTERNAL_USDT');
    for (let i = 0; i < 5; i++) {
      const r = await placeSicBoRoll(ledger, input);
      expect(r.dice).toEqual(o1.dice);
      expect(r.totalPayout).toBe(o1.totalPayout);
    }
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(balanceAfterFirst);
  });
});

describe('placeSicBoRoll — error paths', () => {
  it('rejects malformed bet target before any ledger write', async () => {
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    await expect(
      placeSicBoRoll(
        ledger,
        baseInput({
          bets: [{ type: 'specific_triple', stake: parseAmount('1'), target: 0 }],
        }),
      ),
    ).rejects.toThrow();
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(before);
  });

  it('rejects empty bets', async () => {
    await expect(placeSicBoRoll(ledger, baseInput({ bets: [] }))).rejects.toBeInstanceOf(
      SicBoValidationError,
    );
  });

  it('rejects bad account references', async () => {
    await expect(
      placeSicBoRoll(ledger, baseInput({ userAccountId: 'nope' })),
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
      placeSicBoRoll(
        ledger,
        baseInput({
          rollId: 'overdraft',
          bets: [{ type: 'small', stake: parseAmount('100') }],
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });
});

describe('placeSicBoRoll — push and total-loss branches', () => {
  it('push: total payout exactly equals total stake', async () => {
    // Find a nonce with a winning small (total 4-10, no triple). We'll bet
    // 1 on small (will win, payout 2) + 1 on a guaranteed-loss specific
    // triple. Total stake 2; total payout 2. Push.
    let pushInput: SicBoRollInput | null = null;
    for (let n = 0; n < 200; n++) {
      const { dice } = deriveSicBo(SERVER_SEED, 'sicbo-test', n);
      const total = dice[0] + dice[1] + dice[2];
      const triple = dice[0] === dice[1] && dice[1] === dice[2];
      if (!triple && total >= 4 && total <= 10) {
        pushInput = baseInput({
          rollId: `push-${String(n)}`,
          nonce: n,
          bets: [
            { type: 'small', stake: parseAmount('1') },
            { type: 'specific_triple', stake: parseAmount('1'), target: 1 },
          ],
        });
        break;
      }
    }
    if (pushInput === null) throw new Error('no push nonce');

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeSicBoRoll(ledger, pushInput);
    expect(out.totalStake).toBe(parseAmount('2'));
    expect(out.totalPayout).toBe(parseAmount('2'));
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after).toBe(before);
  });

  it('total loss when no bets win', async () => {
    // Bet small + big both — one of them must lose; pick a target where small
    // loses too (total 11-17, no triple).
    let lossInput: SicBoRollInput | null = null;
    for (let n = 0; n < 200; n++) {
      const { dice } = deriveSicBo(SERVER_SEED, 'sicbo-test', n);
      const total = dice[0] + dice[1] + dice[2];
      const triple = dice[0] === dice[1] && dice[1] === dice[2];
      if (!triple && total >= 11 && total <= 17) {
        lossInput = baseInput({
          rollId: `total-loss-${String(n)}`,
          nonce: n,
          bets: [
            { type: 'small', stake: parseAmount('1') },
            { type: 'specific_triple', stake: parseAmount('1'), target: 1 },
          ],
        });
        break;
      }
    }
    if (lossInput === null) throw new Error('no total-loss nonce');

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeSicBoRoll(ledger, lossInput);
    expect(out.totalPayout).toBe(0n);
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(-parseAmount('2'));
  });

  it('partial payout: small win, larger losing bet', async () => {
    // Find a nonce where small wins. Bet 1 on small (wins, payout 2) and 10
    // on specific_triple (loses). Total stake 11, total payout 2 → partial.
    let partialInput: SicBoRollInput | null = null;
    for (let n = 0; n < 200; n++) {
      const { dice } = deriveSicBo(SERVER_SEED, 'sicbo-test', n);
      const total = dice[0] + dice[1] + dice[2];
      const triple = dice[0] === dice[1] && dice[1] === dice[2];
      if (!triple && total >= 4 && total <= 10) {
        partialInput = baseInput({
          rollId: `partial-${String(n)}`,
          nonce: n,
          bets: [
            { type: 'small', stake: parseAmount('1') },
            { type: 'specific_triple', stake: parseAmount('10'), target: 1 },
          ],
        });
        break;
      }
    }
    if (partialInput === null) throw new Error('no partial nonce');

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeSicBoRoll(ledger, partialInput);
    expect(out.totalStake).toBe(parseAmount('11'));
    expect(out.totalPayout).toBe(parseAmount('2'));
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(-parseAmount('9'));
  });
});

describe('placeSicBoRoll — RTP convergence', () => {
  it('over many small bets, RTP converges toward ~97.2%', async () => {
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
      const out = await placeSicBoRoll(ledger, {
        rollId: `rtp-${String(n)}`,
        userAccountId: USER,
        escrowAccountId: ESCROW,
        houseAccountId: HOUSE,
        bets: [{ type: 'small', stake }],
        currency: 'INTERNAL_USDT',
        serverSeed: SERVER_SEED,
        clientSeed: 'rtp-sicbo',
        nonce: n,
      });
      totalStaked += stake;
      totalPayout += out.totalPayout;
    }

    const rtp = Number(totalPayout) / Number(totalStaked);
    // Theoretical 105/216 * 2 = 0.9722. At 1000 samples allow ±15pp.
    expect(rtp).toBeGreaterThan(0.82);
    expect(rtp).toBeLessThan(1.12);
  });
});
