// packages/games/mines/tests/repository.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

import { parseAmount } from '@solsticebet/ledger';

import {
  DuplicateRoundError,
  InMemoryMinesRoundRepository,
  RoundNotFoundError,
} from '../src/repository.js';
import type { MinesRound } from '../src/types.js';

let repo: InMemoryMinesRoundRepository;

beforeEach(() => {
  repo = new InMemoryMinesRoundRepository();
});

const roundFixture = (over: Partial<MinesRound> = {}): MinesRound => ({
  roundId: 'r-1',
  userAccountId: 'user-1',
  escrowAccountId: 'escrow',
  houseAccountId: 'house',
  stake: parseAmount('10'),
  mineCount: 3,
  currency: 'INTERNAL_USDT',
  serverSeed: 'a'.repeat(64),
  clientSeed: 'cs',
  nonce: 0,
  mineLayout: Array.from({ length: 25 }, (_, i) => i),
  revealed: [],
  state: 'active',
  payout: null,
  finalMultiplier: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: {},
  ...over,
});

describe('InMemoryMinesRoundRepository', () => {
  it('creates and loads a round', async () => {
    const round = roundFixture();
    await repo.create(round);
    const loaded = await repo.load(round.roundId);
    expect(loaded).toEqual(round);
  });

  it('load returns null for missing round', async () => {
    expect(await repo.load('nope')).toBeNull();
  });

  it('rejects duplicate create', async () => {
    const round = roundFixture();
    await repo.create(round);
    await expect(repo.create(round)).rejects.toBeInstanceOf(DuplicateRoundError);
  });

  it('updates an existing round', async () => {
    const round = roundFixture();
    await repo.create(round);
    const updated: MinesRound = {
      ...round,
      revealed: [5],
      updatedAt: new Date(),
    };
    await repo.update(updated);
    const loaded = await repo.load(round.roundId);
    expect(loaded?.revealed).toEqual([5]);
  });

  it('update throws on missing round', async () => {
    const round = roundFixture();
    await expect(repo.update(round)).rejects.toBeInstanceOf(RoundNotFoundError);
  });
});
