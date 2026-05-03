// packages/games/baccarat/tests/engine.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  InMemoryLedgerRepository,
  InsufficientBalanceError,
  parseAmount,
  recordAdjustment,
} from '@solsticebet/ledger';
import { deriveBaccarat } from '@solsticebet/rng';

import { placeBaccaratCoup } from '../src/engine.js';
import { BaccaratValidationError } from '../src/limits.js';
import { computePayout } from '../src/math.js';
import { playTableau } from '../src/tableau.js';
import type { BaccaratCoupInput } from '../src/types.js';

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

const baseInput = (over: Partial<BaccaratCoupInput> = {}): BaccaratCoupInput => ({
  coupId: 'c-1',
  userAccountId: USER,
  escrowAccountId: ESCROW,
  houseAccountId: HOUSE,
  bets: [{ type: 'player', stake: parseAmount('10') }],
  currency: 'INTERNAL_USDT',
  serverSeed: SERVER_SEED,
  clientSeed: 'baccarat-test',
  nonce: 0,
  ...over,
});

/**
 * Helper: find the first nonce (within 200) where the deal yields the given winner.
 * Returns the nonce or null.
 */
function findNonceForWinner(
  clientSeed: string,
  winner: 'player' | 'banker' | 'tie',
): number | null {
  for (let n = 0; n < 200; n++) {
    const { cards } = deriveBaccarat(SERVER_SEED, clientSeed, n);
    if (playTableau(cards).winner === winner) return n;
  }
  return null;
}

describe('placeBaccaratCoup — determinism', () => {
  it('engine deal matches deriveBaccarat + playTableau', async () => {
    const input = baseInput();
    const out = await placeBaccaratCoup(ledger, input);
    const { cards } = deriveBaccarat(input.serverSeed, input.clientSeed, input.nonce);
    const expected = playTableau(cards);
    expect(out.deal.winner).toBe(expected.winner);
    expect(out.deal.player.total).toBe(expected.player.total);
    expect(out.deal.banker.total).toBe(expected.banker.total);
  });
});

describe('placeBaccaratCoup — single-bet outcomes', () => {
  it('a winning Player bet pays 2× stake', async () => {
    const playerNonce = findNonceForWinner('baccarat-test', 'player');
    if (playerNonce === null) throw new Error('no player win in 200 nonces');

    const input = baseInput({
      coupId: `p-win-${String(playerNonce)}`,
      nonce: playerNonce,
    });
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeBaccaratCoup(ledger, input);
    expect(out.deal.winner).toBe('player');
    expect(out.bets[0]?.state).toBe('win');
    expect(out.bets[0]?.payout).toBe(computePayout(parseAmount('10'), 'player'));
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(parseAmount('10')); // net +10 on a 10 stake at 1:1
  });

  it('a winning Banker bet pays 1.95× stake', async () => {
    const bankerNonce = findNonceForWinner('baccarat-test', 'banker');
    if (bankerNonce === null) throw new Error('no banker win in 200 nonces');

    const input = baseInput({
      coupId: `b-win-${String(bankerNonce)}`,
      nonce: bankerNonce,
      bets: [{ type: 'banker', stake: parseAmount('10') }],
    });
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeBaccaratCoup(ledger, input);
    expect(out.deal.winner).toBe('banker');
    expect(out.bets[0]?.state).toBe('win');
    expect(out.bets[0]?.payout).toBe(parseAmount('19.5')); // 10 × 1.95
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(parseAmount('9.5')); // net +9.5 on a 10 stake at 0.95:1
  });

  it('a winning Tie bet pays 9× stake', async () => {
    const tieNonce = findNonceForWinner('baccarat-test', 'tie');
    if (tieNonce === null) throw new Error('no tie in 200 nonces');

    const input = baseInput({
      coupId: `t-win-${String(tieNonce)}`,
      nonce: tieNonce,
      bets: [{ type: 'tie', stake: parseAmount('1') }],
    });
    const out = await placeBaccaratCoup(ledger, input);
    expect(out.deal.winner).toBe('tie');
    expect(out.bets[0]?.state).toBe('win');
    expect(out.bets[0]?.payout).toBe(parseAmount('9'));
  });

  it('a losing bet forfeits stake', async () => {
    const playerNonce = findNonceForWinner('baccarat-test', 'player');
    if (playerNonce === null) throw new Error('no player win in 200 nonces');

    // Bet on Banker when Player wins → loss
    const input = baseInput({
      coupId: `loss-${String(playerNonce)}`,
      nonce: playerNonce,
      bets: [{ type: 'banker', stake: parseAmount('10') }],
    });
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeBaccaratCoup(ledger, input);
    expect(out.bets[0]?.state).toBe('loss');
    expect(out.bets[0]?.payout).toBe(0n);
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(-parseAmount('10'));
  });
});

describe('placeBaccaratCoup — Tie push semantics', () => {
  it('Player and Banker bets push (refund stake) on a Tie outcome', async () => {
    const tieNonce = findNonceForWinner('baccarat-test', 'tie');
    if (tieNonce === null) throw new Error('no tie in 200 nonces');

    const input = baseInput({
      coupId: `tie-push-${String(tieNonce)}`,
      nonce: tieNonce,
      bets: [
        { type: 'player', stake: parseAmount('5') },
        { type: 'banker', stake: parseAmount('5') },
        { type: 'tie', stake: parseAmount('1') },
      ],
    });
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeBaccaratCoup(ledger, input);
    expect(out.deal.winner).toBe('tie');

    const playerOutcome = out.bets.find((b) => b.type === 'player');
    const bankerOutcome = out.bets.find((b) => b.type === 'banker');
    const tieOutcome = out.bets.find((b) => b.type === 'tie');
    expect(playerOutcome?.state).toBe('push');
    expect(playerOutcome?.payout).toBe(parseAmount('5')); // refund
    expect(bankerOutcome?.state).toBe('push');
    expect(bankerOutcome?.payout).toBe(parseAmount('5')); // refund
    expect(tieOutcome?.state).toBe('win');
    expect(tieOutcome?.payout).toBe(parseAmount('9'));

    // Net: tie wins +8 on stake 1, P&B refunded → net +8
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(parseAmount('8'));
  });
});

describe('placeBaccaratCoup — multi-bet coups', () => {
  it('settles each bet against the same outcome', async () => {
    const playerNonce = findNonceForWinner('baccarat-test', 'player');
    if (playerNonce === null) throw new Error('no player win in 200 nonces');

    const input = baseInput({
      coupId: `multi-${String(playerNonce)}`,
      nonce: playerNonce,
      bets: [
        { type: 'player', stake: parseAmount('10') }, // wins → 20
        { type: 'banker', stake: parseAmount('5') }, // loses → 0
        { type: 'tie', stake: parseAmount('1') }, // loses → 0
      ],
    });

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeBaccaratCoup(ledger, input);
    expect(out.totalStake).toBe(parseAmount('16'));
    expect(out.totalPayout).toBe(parseAmount('20'));
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(parseAmount('4')); // net +4
  });
});

describe('placeBaccaratCoup — idempotency', () => {
  it('replaying with the same coupId is safe', async () => {
    const input = baseInput({ coupId: 'idem-1' });
    const o1 = await placeBaccaratCoup(ledger, input);
    const balanceAfterFirst = await ledger.getBalance(USER, 'INTERNAL_USDT');

    for (let i = 0; i < 5; i++) {
      const r = await placeBaccaratCoup(ledger, input);
      expect(r.deal.winner).toBe(o1.deal.winner);
      expect(r.totalPayout).toBe(o1.totalPayout);
    }
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(balanceAfterFirst);
  });
});

describe('placeBaccaratCoup — error paths', () => {
  it('rejects empty bets', async () => {
    await expect(placeBaccaratCoup(ledger, baseInput({ bets: [] }))).rejects.toBeInstanceOf(
      BaccaratValidationError,
    );
  });

  it('rejects bad account references', async () => {
    await expect(
      placeBaccaratCoup(ledger, baseInput({ userAccountId: 'nope' })),
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
      placeBaccaratCoup(
        ledger,
        baseInput({
          coupId: 'overdraft',
          bets: [{ type: 'player', stake: parseAmount('100') }],
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });
});

describe('placeBaccaratCoup — partial payout + total loss', () => {
  it('settles as partial payout when user wins one bet but loses more', async () => {
    // Player wins. Bet: P=1, B=10 → win 2, lose 10 → totalPayout=2 < totalStake=11
    const playerNonce = findNonceForWinner('baccarat-test', 'player');
    if (playerNonce === null) throw new Error('no player win in 200 nonces');

    const input = baseInput({
      coupId: `partial-${String(playerNonce)}`,
      nonce: playerNonce,
      bets: [
        { type: 'player', stake: parseAmount('1') }, // wins → 2
        { type: 'banker', stake: parseAmount('10') }, // loses
      ],
    });
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeBaccaratCoup(ledger, input);
    expect(out.totalStake).toBe(parseAmount('11'));
    expect(out.totalPayout).toBe(parseAmount('2'));
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(-parseAmount('9'));
  });

  it('settles as full loss when no bets win', async () => {
    // Bet on Tie when result is not a tie → 0 payout
    const playerNonce = findNonceForWinner('baccarat-test', 'player');
    if (playerNonce === null) throw new Error('no player win in 200 nonces');

    const input = baseInput({
      coupId: `loss-only-${String(playerNonce)}`,
      nonce: playerNonce,
      bets: [{ type: 'tie', stake: parseAmount('1') }],
    });
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const out = await placeBaccaratCoup(ledger, input);
    expect(out.totalPayout).toBe(0n);
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(after - before).toBe(-parseAmount('1'));
  });
});

describe('placeBaccaratCoup — RTP convergence', () => {
  it('over many Banker bets, RTP converges toward ~98.94%', async () => {
    const stake = parseAmount('1');
    const N = 500;
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
      const out = await placeBaccaratCoup(ledger, {
        coupId: `rtp-${String(n)}`,
        userAccountId: USER,
        escrowAccountId: ESCROW,
        houseAccountId: HOUSE,
        bets: [{ type: 'banker', stake }],
        currency: 'INTERNAL_USDT',
        serverSeed: SERVER_SEED,
        clientSeed: 'rtp-baccarat',
        nonce: n,
      });
      totalStaked += stake;
      totalPayout += out.totalPayout;
    }

    const rtp = Number(totalPayout) / Number(totalStaked);
    // Theoretical Banker RTP: ~98.94%. At 500 samples, allow wide tolerance
    // (Banker pushes contribute 1× to payout; we count those as full payouts).
    expect(rtp).toBeGreaterThan(0.85);
    expect(rtp).toBeLessThan(1.1);
  });
});
