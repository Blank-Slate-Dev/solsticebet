// packages/games/roulette/tests/engine.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  InMemoryLedgerRepository,
  InsufficientBalanceError,
  parseAmount,
  recordAdjustment,
} from '@solsticebet/ledger';
import { deriveRoulette } from '@solsticebet/rng';

import { placeRouletteSpin } from '../src/engine.js';
import { RouletteValidationError } from '../src/limits.js';
import { computePayout } from '../src/math.js';
import type { RouletteSpinInput } from '../src/types.js';
import { isWinningBet } from '../src/wheel.js';

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

const baseInput = (over: Partial<RouletteSpinInput> = {}): RouletteSpinInput => ({
  spinId: 's-1',
  userAccountId: USER,
  escrowAccountId: ESCROW,
  houseAccountId: HOUSE,
  bets: [{ type: 'red', stake: parseAmount('10') }],
  currency: 'INTERNAL_USDT',
  serverSeed: SERVER_SEED,
  clientSeed: 'roulette-test',
  nonce: 0,
  ...over,
});

describe('placeRouletteSpin — determinism', () => {
  it('engine result matches deriveRoulette', async () => {
    const input = baseInput();
    const out = await placeRouletteSpin(ledger, input);
    const expected = deriveRoulette(input.serverSeed, input.clientSeed, input.nonce);
    expect(out.result).toBe(expected.result);
  });
});

describe('placeRouletteSpin — single-bet outcomes', () => {
  it('a winning straight-up pays 36× stake', async () => {
    // Find a (nonce, target) where the straight wins.
    let winningInput: RouletteSpinInput | null = null;
    for (let n = 0; n < 100; n++) {
      const { result } = deriveRoulette(SERVER_SEED, 'roulette-test', n);
      const input = baseInput({
        nonce: n,
        spinId: `straight-win-${String(n)}`,
        bets: [{ type: 'straight', stake: parseAmount('1'), target: result }],
      });
      winningInput = input;
      break;
    }
    if (winningInput === null) throw new Error('unreachable');

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeRouletteSpin(ledger, winningInput);
    expect(out.bets[0]?.isWin).toBe(true);
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    // Net change: +35 (won 35 net on a 1 stake at 35:1)
    expect(after - before).toBe(parseAmount('35'));
  });

  it('a losing straight forfeits stake', async () => {
    const input = baseInput({
      bets: [
        // Bet on a number that won't match the result
        { type: 'straight', stake: parseAmount('10'), target: 99 - 99 + 0 }, // 0
      ],
    });
    // Find a nonce where result isn't 0
    let losingInput: RouletteSpinInput | null = null;
    for (let n = 0; n < 100; n++) {
      const { result } = deriveRoulette(SERVER_SEED, 'roulette-test', n);
      if (result !== 0) {
        losingInput = { ...input, nonce: n, spinId: `loss-${String(n)}` };
        break;
      }
    }
    if (losingInput === null) throw new Error('unreachable');

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeRouletteSpin(ledger, losingInput);
    expect(out.bets[0]?.isWin).toBe(false);
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(-parseAmount('10'));
  });

  it('a winning red bet pays 2× (1:1 + stake)', async () => {
    // Find a nonce where the result is red
    let redInput: RouletteSpinInput | null = null;
    for (let n = 0; n < 100; n++) {
      const { result } = deriveRoulette(SERVER_SEED, 'roulette-test', n);
      // Use isWinningBet to avoid duplicating the red set
      if (isWinningBet('red', undefined, result)) {
        redInput = baseInput({
          nonce: n,
          spinId: `red-win-${String(n)}`,
          bets: [{ type: 'red', stake: parseAmount('5') }],
        });
        break;
      }
    }
    if (redInput === null) throw new Error('unreachable');

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeRouletteSpin(ledger, redInput);
    expect(out.bets[0]?.isWin).toBe(true);
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    // Net change: +5 (won 5 net on a 5 stake at 1:1)
    expect(after - before).toBe(parseAmount('5'));
  });
});

describe('placeRouletteSpin — multi-bet spins', () => {
  it('settles many bets atomically against one result', async () => {
    const input = baseInput({
      spinId: 'multi-1',
      bets: [
        { type: 'red', stake: parseAmount('5') },
        { type: 'low', stake: parseAmount('5') },
        { type: 'dozen', stake: parseAmount('5'), target: 1 },
        { type: 'straight', stake: parseAmount('1'), target: 7 },
      ],
    });
    const out = await placeRouletteSpin(ledger, input);

    // The total stake across all bets debited from the user
    expect(out.totalStake).toBe(parseAmount('16'));

    // Total payout sums per-bet payouts
    let expectedTotalPayout = 0n;
    for (const bet of out.bets) {
      if (bet.isWin) expectedTotalPayout += bet.payout;
    }
    expect(out.totalPayout).toBe(expectedTotalPayout);

    // Net balance change matches totalPayout - totalStake
    const balance = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const expected = STARTING_BALANCE + (out.totalPayout - out.totalStake);
    expect(balance).toBe(expected);
  });

  it('hand-verifying a known-result spin', async () => {
    // Use deriveRoulette to find what the result will be
    const nonce = 0;
    const { result } = deriveRoulette(SERVER_SEED, 'roulette-test', nonce);

    // Build a spin with a bet we know loses and one we know wins.
    const wrongStraight = (result + 1) % 37; // a number that isn't the result
    const input = baseInput({
      spinId: 'verify-1',
      nonce,
      bets: [
        { type: 'straight', stake: parseAmount('1'), target: result }, // wins, pays 36
        { type: 'straight', stake: parseAmount('1'), target: wrongStraight }, // loses
      ],
    });

    const out = await placeRouletteSpin(ledger, input);
    expect(out.bets[0]?.isWin).toBe(true);
    expect(out.bets[1]?.isWin).toBe(false);

    // First bet pays 36 (35:1 + stake), second bet loses 1.
    // Total stake = 2, total payout = 36, net = +34.
    expect(out.totalStake).toBe(parseAmount('2'));
    expect(out.totalPayout).toBe(parseAmount('36'));
    expect(out.bets[0]?.payout).toBe(computePayout(parseAmount('1'), 'straight'));
  });
});

describe('placeRouletteSpin — idempotency', () => {
  it('replaying with the same spinId is safe', async () => {
    const input = baseInput({ spinId: 'idem-1' });
    const o1 = await placeRouletteSpin(ledger, input);
    const balanceAfterFirst = await ledger.getBalance(USER, 'INTERNAL_USDT');

    for (let i = 0; i < 5; i++) {
      const r = await placeRouletteSpin(ledger, input);
      expect(r.result).toBe(o1.result);
      expect(r.totalPayout).toBe(o1.totalPayout);
    }
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(balanceAfterFirst);
  });
});

describe('placeRouletteSpin — error paths', () => {
  it('rejects invalid bet type/target combinations before any ledger write', async () => {
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    await expect(
      placeRouletteSpin(
        ledger,
        baseInput({
          bets: [{ type: 'straight', stake: parseAmount('1'), target: 99 }],
        }),
      ),
    ).rejects.toThrow();
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(before);
  });

  it('rejects empty bets', async () => {
    await expect(placeRouletteSpin(ledger, baseInput({ bets: [] }))).rejects.toBeInstanceOf(
      RouletteValidationError,
    );
  });

  it('rejects bad account references', async () => {
    await expect(
      placeRouletteSpin(ledger, baseInput({ userAccountId: 'nope' })),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('insufficient balance bubbles up from ledger', async () => {
    // Drain user
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
      placeRouletteSpin(
        ledger,
        baseInput({
          spinId: 'overdraft',
          bets: [{ type: 'red', stake: parseAmount('100') }],
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });
});

describe('placeRouletteSpin — RTP convergence', () => {
  it('over many even-money spins, RTP converges toward 36/37', async () => {
    const stake = parseAmount('1');
    const N = 500;
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
      const out = await placeRouletteSpin(ledger, {
        spinId: `rtp-${String(n)}`,
        userAccountId: USER,
        escrowAccountId: ESCROW,
        houseAccountId: HOUSE,
        bets: [{ type: 'red', stake }],
        currency: 'INTERNAL_USDT',
        serverSeed: SERVER_SEED,
        clientSeed: 'rtp-roulette',
        nonce: n,
      });
      totalStaked += stake;
      totalPayout += out.totalPayout;
    }

    const rtp = Number(totalPayout) / Number(totalStaked);
    // Theoretical 36/37 ≈ 0.9730. At 500 samples, allow wide tolerance.
    expect(rtp).toBeGreaterThan(0.7);
    expect(rtp).toBeLessThan(1.3);
  });
});

describe('placeRouletteSpin — push (totalPayout === totalStake)', () => {
  it('refunds the stake on a perfect push', async () => {
    // A push happens when totalPayout exactly equals totalStake.
    // Construct: bet 1 USDT on red (wins on red, pays 2× = 2 USDT total payout).
    // For one red-stake bet, payout=2 != stake=1 so no push.
    // But: bet 1 on red AND bet 1 on a losing straight that won't hit.
    // If red wins → payout = 2; total stake = 2; PUSH.
    // We just need a nonce where the result is red.
    let pushInput: RouletteSpinInput | null = null;
    for (let n = 0; n < 100; n++) {
      const { result } = deriveRoulette(SERVER_SEED, 'roulette-test', n);
      if (isWinningBet('red', undefined, result) && result !== 7) {
        pushInput = baseInput({
          spinId: `push-${String(n)}`,
          nonce: n,
          bets: [
            { type: 'red', stake: parseAmount('1') },
            { type: 'straight', stake: parseAmount('1'), target: 7 },
          ],
        });
        break;
      }
    }
    if (pushInput === null) throw new Error('unreachable');

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeRouletteSpin(ledger, pushInput);

    expect(out.totalStake).toBe(parseAmount('2'));
    expect(out.totalPayout).toBe(parseAmount('2'));

    // Net balance change: zero
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after).toBe(before);
  });
});

describe('placeRouletteSpin — total loss (totalPayout === 0)', () => {
  it('settles as bet_loss when no bets win', async () => {
    // Find a result where neither red nor a chosen straight wins.
    let lossInput: RouletteSpinInput | null = null;
    for (let n = 0; n < 100; n++) {
      const { result } = deriveRoulette(SERVER_SEED, 'roulette-test', n);
      // Need: not red AND not 7
      if (!isWinningBet('red', undefined, result) && result !== 7) {
        lossInput = baseInput({
          spinId: `loss-only-${String(n)}`,
          nonce: n,
          bets: [
            { type: 'red', stake: parseAmount('1') },
            { type: 'straight', stake: parseAmount('1'), target: 7 },
          ],
        });
        break;
      }
    }
    if (lossInput === null) throw new Error('unreachable');

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeRouletteSpin(ledger, lossInput);

    expect(out.totalPayout).toBe(0n);
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(-out.totalStake);
  });
});
