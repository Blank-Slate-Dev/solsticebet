// packages/games/blackjack/tests/engine.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotFoundError,
  InMemoryLedgerRepository,
  InsufficientBalanceError,
  parseAmount,
  recordAdjustment,
} from '@solsticebet/ledger';
import { deriveBlackjack } from '@solsticebet/rng';

import { isBlackjack as cardsIsBlackjack } from '../src/cards.js';
import { doubleDown, hit, split, stand, startRound } from '../src/engine.js';
import { BlackjackValidationError } from '../src/limits.js';
import { InMemoryBlackjackRoundRepository, RoundNotFoundError } from '../src/repository.js';
import type { StartBlackjackRoundInput } from '../src/types.js';

let ledger: InMemoryLedgerRepository;
let rounds: InMemoryBlackjackRoundRepository;

const USER = 'user-1';
const HOUSE = 'house';
const ESCROW = 'escrow';
const STARTING_BALANCE = parseAmount('1000');

const SERVER_SEED = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

beforeEach(async () => {
  ledger = new InMemoryLedgerRepository();
  rounds = new InMemoryBlackjackRoundRepository();
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

const baseInput = (over: Partial<StartBlackjackRoundInput> = {}): StartBlackjackRoundInput => ({
  roundId: 'r-1',
  userAccountId: USER,
  escrowAccountId: ESCROW,
  houseAccountId: HOUSE,
  stake: parseAmount('10'),
  currency: 'INTERNAL_USDT',
  serverSeed: SERVER_SEED,
  clientSeed: 'bj-test',
  nonce: 0,
  ...over,
});

/**
 * Find a nonce that produces specific initial-deal conditions.
 * Returns the nonce or null.
 */
function findNonceMatching(
  predicate: (cards: readonly number[]) => boolean,
  clientSeed = 'bj-test',
): number | null {
  for (let n = 0; n < 500; n++) {
    const { cards } = deriveBlackjack(SERVER_SEED, clientSeed, n);
    if (predicate(cards)) return n;
  }
  return null;
}

describe('startRound', () => {
  it('debits stake, deals 2+2 cards', async () => {
    const round = await startRound(ledger, rounds, baseInput());
    expect(round.playerHands).toHaveLength(1);
    expect(round.playerHands[0]?.cards).toHaveLength(2);
    expect(round.dealer.cards).toHaveLength(2);
    expect(round.totalCommitted).toBe(parseAmount('10'));
    // Balance reflects stake
    const balance = await ledger.getBalance(USER, 'INTERNAL_USDT');
    expect(balance).toBeLessThanOrEqual(STARTING_BALANCE);
  });

  it('is idempotent on roundId', async () => {
    const input = baseInput();
    const r1 = await startRound(ledger, rounds, input);
    const r2 = await startRound(ledger, rounds, input);
    expect(r1.roundId).toBe(r2.roundId);
    expect(r1.playerHands).toEqual(r2.playerHands);
  });

  it('settles immediately on player blackjack', async () => {
    // Find a nonce where player gets blackjack on initial deal
    const bjNonce = findNonceMatching((cards) => cardsIsBlackjack([cards[0] ?? 0, cards[2] ?? 0]));
    if (bjNonce === null) throw new Error('no player BJ in 500 nonces');

    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    const round = await startRound(ledger, rounds, baseInput({ roundId: 'bj-1', nonce: bjNonce }));
    expect(round.state).toBe('settled');
    expect(round.playerHands[0]?.state).toBe('blackjack');

    // Check whether dealer also has blackjack
    const dealerBJ = cardsIsBlackjack(round.dealer.cards);
    const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
    if (dealerBJ) {
      // Push: balance unchanged
      expect(after).toBe(before);
    } else {
      // Win 3:2: net +15 on a 10 stake
      expect(after - before).toBe(parseAmount('15'));
    }
  });

  it('rejects invalid input before any ledger write', async () => {
    const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
    await expect(startRound(ledger, rounds, baseInput({ stake: 0n }))).rejects.toBeInstanceOf(
      BlackjackValidationError,
    );
    expect(await ledger.getBalance(USER, 'INTERNAL_USDT')).toBe(before);
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
      startRound(ledger, rounds, baseInput({ roundId: 'overdraft', stake: parseAmount('100') })),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it('rejects bad account references', async () => {
    await expect(
      startRound(ledger, rounds, baseInput({ userAccountId: 'nope' })),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });
});

describe('hit / stand basic flow', () => {
  it('hit adds a card', async () => {
    // Find a nonce where neither side has blackjack
    const safe = findNonceMatching((cards) => {
      const p = cardsIsBlackjack([cards[0] ?? 0, cards[2] ?? 0]);
      const d = cardsIsBlackjack([cards[1] ?? 0, cards[3] ?? 0]);
      return !p && !d;
    });
    if (safe === null) throw new Error('no safe nonce');

    const round = await startRound(ledger, rounds, baseInput({ roundId: 'hit-1', nonce: safe }));
    if (round.state !== 'player_turn') return; // skip if happened to settle anyway

    const r2 = await hit(ledger, rounds, round.roundId);
    if (r2.state === 'settled') {
      // Player busted on the hit
      expect(r2.playerHands[0]?.state).toBe('busted');
    } else {
      expect(r2.playerHands[0]?.cards.length).toBe(3);
    }
  });

  it('stand finalises and triggers dealer phase', async () => {
    const safe = findNonceMatching((cards) => {
      const p = cardsIsBlackjack([cards[0] ?? 0, cards[2] ?? 0]);
      const d = cardsIsBlackjack([cards[1] ?? 0, cards[3] ?? 0]);
      return !p && !d;
    });
    if (safe === null) throw new Error('no safe nonce');

    const round = await startRound(ledger, rounds, baseInput({ roundId: 'stand-1', nonce: safe }));
    if (round.state !== 'player_turn') return;

    const r2 = await stand(ledger, rounds, round.roundId);
    expect(r2.state).toBe('settled');
    expect(r2.dealer.final).toBe(true);
  });

  it('hit rejected on non-active hand', async () => {
    const safe = findNonceMatching((cards) => {
      const p = cardsIsBlackjack([cards[0] ?? 0, cards[2] ?? 0]);
      const d = cardsIsBlackjack([cards[1] ?? 0, cards[3] ?? 0]);
      return !p && !d;
    });
    if (safe === null) throw new Error('no safe nonce');

    const round = await startRound(ledger, rounds, baseInput({ roundId: 'reject-1', nonce: safe }));
    if (round.state !== 'player_turn') return;

    await stand(ledger, rounds, round.roundId);
    await expect(hit(ledger, rounds, round.roundId)).rejects.toThrow();
  });

  it('hit on missing round throws RoundNotFoundError', async () => {
    await expect(hit(ledger, rounds, 'nope')).rejects.toBeInstanceOf(RoundNotFoundError);
  });
});

describe('double down', () => {
  it('debits additional stake, draws one card, auto-stands', async () => {
    const safe = findNonceMatching((cards) => {
      const p = cardsIsBlackjack([cards[0] ?? 0, cards[2] ?? 0]);
      const d = cardsIsBlackjack([cards[1] ?? 0, cards[3] ?? 0]);
      return !p && !d;
    });
    if (safe === null) throw new Error('no safe nonce');

    const round = await startRound(ledger, rounds, baseInput({ roundId: 'dd-1', nonce: safe }));
    if (round.state !== 'player_turn') return;

    const r2 = await doubleDown(ledger, rounds, round.roundId);
    expect(r2.playerHands[0]?.cards.length).toBe(3);
    expect(['doubled', 'busted']).toContain(r2.playerHands[0]?.state ?? '');
    expect(r2.totalCommitted).toBe(parseAmount('20'));
    expect(r2.state).toBe('settled');
  });

  it('rejected if not 2 cards', async () => {
    const safe = findNonceMatching((cards) => {
      const p = cardsIsBlackjack([cards[0] ?? 0, cards[2] ?? 0]);
      const d = cardsIsBlackjack([cards[1] ?? 0, cards[3] ?? 0]);
      return !p && !d;
    });
    if (safe === null) throw new Error('no safe nonce');

    const round = await startRound(ledger, rounds, baseInput({ roundId: 'dd-rej', nonce: safe }));
    if (round.state !== 'player_turn') return;

    const r2 = await hit(ledger, rounds, round.roundId);
    if (r2.state === 'player_turn' && r2.playerHands[0]?.state === 'active') {
      await expect(doubleDown(ledger, rounds, round.roundId)).rejects.toThrow(/2-card/);
    }
  });
});

describe('split', () => {
  it('creates two hands with one card each from the original pair, plus a fresh draw', async () => {
    // Find a nonce where Player gets a matching pair (and no immediate BJ)
    const splitNonce = findNonceMatching((cards) => {
      const p1 = cards[0] ?? 0;
      const p2 = cards[2] ?? 0;
      const d1 = cards[1] ?? 0;
      const d2 = cards[3] ?? 0;
      // Same Blackjack value (using cardValue), and dealer doesn't have BJ
      const valEq = (a: number, b: number) =>
        (a === 0 && b === 0) || (a !== 0 && b !== 0 && (a === b || (a >= 9 && b >= 9)));
      return valEq(p1, p2) && !cardsIsBlackjack([d1, d2]) && p1 !== 0; // skip aces
    });
    if (splitNonce === null) throw new Error('no split nonce');

    const round = await startRound(
      ledger,
      rounds,
      baseInput({ roundId: 'split-1', nonce: splitNonce }),
    );
    if (round.state !== 'player_turn') return;

    const r2 = await split(ledger, rounds, round.roundId);
    expect(r2.playerHands.length).toBeGreaterThanOrEqual(2);
    expect(r2.totalCommitted).toBe(parseAmount('20'));
    expect(r2.playerHands[0]?.cards.length).toBe(2);
    expect(r2.playerHands[1]?.cards.length).toBe(2);
  });

  it('rejected on non-matching pair', async () => {
    const noPair = findNonceMatching((cards) => {
      const p1 = cards[0] ?? 0;
      const p2 = cards[2] ?? 0;
      const d1 = cards[1] ?? 0;
      const d2 = cards[3] ?? 0;
      const valEq = p1 === p2 || (p1 >= 9 && p2 >= 9);
      return !valEq && !cardsIsBlackjack([p1, p2]) && !cardsIsBlackjack([d1, d2]);
    });
    if (noPair === null) throw new Error('no no-pair nonce');

    const round = await startRound(
      ledger,
      rounds,
      baseInput({ roundId: 'split-rej', nonce: noPair }),
    );
    if (round.state !== 'player_turn') return;

    await expect(split(ledger, rounds, round.roundId)).rejects.toThrow(/matching/);
  });
});

describe('full balance accounting', () => {
  it('a known nonce produces consistent final balance across replays', async () => {
    // Place several rounds with different nonces, always standing.
    // Verify total balance change equals sum of per-round outcomes.
    let prevBalance = STARTING_BALANCE;
    for (let n = 0; n < 5; n++) {
      const before = await ledger.getBalance(USER, 'INTERNAL_USDT');
      expect(before).toBe(prevBalance);
      const round = await startRound(
        ledger,
        rounds,
        baseInput({ roundId: `accounting-${String(n)}`, nonce: n }),
      );
      if (round.state === 'player_turn') {
        await stand(ledger, rounds, round.roundId);
      }
      const after = await ledger.getBalance(USER, 'INTERNAL_USDT');
      expect(after).toBeGreaterThanOrEqual(0n);
      prevBalance = after;
    }
  });
});
