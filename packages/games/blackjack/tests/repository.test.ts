// packages/games/blackjack/tests/repository.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  DuplicateRoundError,
  InMemoryBlackjackRoundRepository,
  RoundNotFoundError,
} from '../src/repository.js';
import type { BlackjackRound } from '../src/types.js';

let repo: InMemoryBlackjackRoundRepository;

beforeEach(() => {
  repo = new InMemoryBlackjackRoundRepository();
});

const fixture = (over: Partial<BlackjackRound> = {}): BlackjackRound => ({
  roundId: 'r-1',
  userAccountId: 'user',
  escrowAccountId: 'escrow',
  houseAccountId: 'house',
  originalStake: 10n,
  totalCommitted: 10n,
  currency: 'INTERNAL_USDT',
  serverSeed: 'a'.repeat(64),
  clientSeed: 'cs',
  nonce: 0,
  deck: Array.from({ length: 32 }, (_, i) => i % 13),
  deckCursor: 4,
  playerHands: [{ cards: [0, 9], stake: 10n, state: 'active', settle: null, payout: null }],
  activeHandIndex: 0,
  dealer: { cards: [1, 2], final: false },
  state: 'player_turn',
  totalPayout: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {},
  ...over,
});

describe('InMemoryBlackjackRoundRepository', () => {
  it('creates and loads', async () => {
    const r = fixture();
    await repo.create(r);
    expect(await repo.load(r.roundId)).toEqual(r);
  });
  it('load returns null for missing', async () => {
    expect(await repo.load('nope')).toBeNull();
  });
  it('rejects duplicate create', async () => {
    const r = fixture();
    await repo.create(r);
    await expect(repo.create(r)).rejects.toBeInstanceOf(DuplicateRoundError);
  });
  it('updates an existing round', async () => {
    const r = fixture();
    await repo.create(r);
    const updated = { ...r, state: 'settled' as const };
    await repo.update(updated);
    const loaded = await repo.load(r.roundId);
    expect(loaded?.state).toBe('settled');
  });
  it('update throws on missing round', async () => {
    await expect(repo.update(fixture())).rejects.toBeInstanceOf(RoundNotFoundError);
  });
});
