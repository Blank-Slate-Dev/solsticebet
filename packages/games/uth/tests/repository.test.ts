// packages/games/uth/tests/repository.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import {
  CoupNotFoundError,
  DuplicateCoupError,
  InMemoryUthCoupRepository,
} from '../src/repository.js';
import type { UthCoup } from '../src/types.js';

let repo: InMemoryUthCoupRepository;

beforeEach(() => {
  repo = new InMemoryUthCoupRepository();
});

const fixture = (over: Partial<UthCoup> = {}): UthCoup => ({
  coupId: 'c-1',
  userAccountId: 'user',
  escrowAccountId: 'escrow',
  houseAccountId: 'house',
  currency: 'INTERNAL_USDT',
  serverSeed: 'a'.repeat(64),
  clientSeed: 'cs',
  nonce: 0,
  cards: Array.from({ length: 9 }, (_, i) => ({ rank: i % 13, suit: i % 4 })),
  ante: 1n,
  blind: 1n,
  trips: 0n,
  play: 0n,
  playMultiplier: 0,
  totalCommitted: 2n,
  folded: false,
  phase: 'preflop',
  playerHand: null,
  dealerHand: null,
  dealerQualifies: null,
  anteSettlement: null,
  blindSettlement: null,
  playSettlement: null,
  tripsSettlement: null,
  totalPayout: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {},
  ...over,
});

describe('InMemoryUthCoupRepository', () => {
  it('creates and loads', async () => {
    const c = fixture();
    await repo.create(c);
    expect(await repo.load(c.coupId)).toEqual(c);
  });
  it('load returns null for missing', async () => {
    expect(await repo.load('nope')).toBeNull();
  });
  it('rejects duplicate create', async () => {
    const c = fixture();
    await repo.create(c);
    await expect(repo.create(c)).rejects.toBeInstanceOf(DuplicateCoupError);
  });
  it('updates an existing coup', async () => {
    const c = fixture();
    await repo.create(c);
    const updated = { ...c, phase: 'flop' as const };
    await repo.update(updated);
    expect((await repo.load(c.coupId))?.phase).toBe('flop');
  });
  it('update throws on missing', async () => {
    await expect(repo.update(fixture())).rejects.toBeInstanceOf(CoupNotFoundError);
  });
});
