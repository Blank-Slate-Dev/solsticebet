// packages/games/blackjack/src/repository.ts
//
// Repository for Blackjack round persistence.
// Same pattern as @solsticebet/game-mines.

import type { BlackjackRound } from './types.js';

export class BlackjackRoundError extends Error {
  override readonly name: string = 'BlackjackRoundError';
}

export class RoundNotFoundError extends BlackjackRoundError {
  override readonly name = 'RoundNotFoundError';
  constructor(roundId: string) {
    super(`blackjack round not found: ${roundId}`);
  }
}

export class DuplicateRoundError extends BlackjackRoundError {
  override readonly name = 'DuplicateRoundError';
  constructor(roundId: string) {
    super(`blackjack round already exists: ${roundId}`);
  }
}

export interface BlackjackRoundRepository {
  create(round: BlackjackRound): Promise<void>;
  load(roundId: string): Promise<BlackjackRound | null>;
  update(round: BlackjackRound): Promise<void>;
}

export class InMemoryBlackjackRoundRepository implements BlackjackRoundRepository {
  private readonly rounds = new Map<string, BlackjackRound>();

  async create(round: BlackjackRound): Promise<void> {
    if (this.rounds.has(round.roundId)) {
      throw new DuplicateRoundError(round.roundId);
    }
    this.rounds.set(round.roundId, round);
    return Promise.resolve();
  }

  async load(roundId: string): Promise<BlackjackRound | null> {
    return Promise.resolve(this.rounds.get(roundId) ?? null);
  }

  async update(round: BlackjackRound): Promise<void> {
    if (!this.rounds.has(round.roundId)) {
      throw new RoundNotFoundError(round.roundId);
    }
    this.rounds.set(round.roundId, round);
    return Promise.resolve();
  }
}
