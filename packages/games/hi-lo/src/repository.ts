// packages/games/hi-lo/src/repository.ts

import type { HiLoRound } from './types.js';

export class HiLoRoundError extends Error {
  override readonly name: string = 'HiLoRoundError';
}

export class RoundNotFoundError extends HiLoRoundError {
  override readonly name = 'RoundNotFoundError';
  constructor(roundId: string) {
    super(`hi-lo round not found: ${roundId}`);
  }
}

export class DuplicateRoundError extends HiLoRoundError {
  override readonly name = 'DuplicateRoundError';
  constructor(roundId: string) {
    super(`hi-lo round already exists: ${roundId}`);
  }
}

export interface HiLoRoundRepository {
  create(round: HiLoRound): Promise<void>;
  load(roundId: string): Promise<HiLoRound | null>;
  update(round: HiLoRound): Promise<void>;
}

export class InMemoryHiLoRoundRepository implements HiLoRoundRepository {
  private readonly rounds = new Map<string, HiLoRound>();

  async create(round: HiLoRound): Promise<void> {
    if (this.rounds.has(round.roundId)) {
      throw new DuplicateRoundError(round.roundId);
    }
    this.rounds.set(round.roundId, round);
    return Promise.resolve();
  }

  async load(roundId: string): Promise<HiLoRound | null> {
    return Promise.resolve(this.rounds.get(roundId) ?? null);
  }

  async update(round: HiLoRound): Promise<void> {
    if (!this.rounds.has(round.roundId)) {
      throw new RoundNotFoundError(round.roundId);
    }
    this.rounds.set(round.roundId, round);
    return Promise.resolve();
  }
}
