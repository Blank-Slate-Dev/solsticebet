// packages/games/mines/src/repository.ts
//
// Repository interface for Mines round storage + in-memory implementation.
// Same hexagonal pattern as @solsticebet/ledger.
// See docs/MINES.md § 6.

import type { MinesRound } from './types.js';

export class MinesRoundError extends Error {
  override readonly name: string = 'MinesRoundError';
}

export class RoundNotFoundError extends MinesRoundError {
  override readonly name = 'RoundNotFoundError';
  constructor(roundId: string) {
    super(`mines round not found: ${roundId}`);
  }
}

export class DuplicateRoundError extends MinesRoundError {
  override readonly name = 'DuplicateRoundError';
  constructor(roundId: string) {
    super(`mines round already exists: ${roundId}`);
  }
}

/**
 * Round repository contract.
 *
 * Production implementation will be Postgres-backed (lands with @solsticebet/db);
 * the in-memory implementation here is the canonical reference and is what
 * the engine tests use.
 */
export interface MinesRoundRepository {
  create(round: MinesRound): Promise<void>;
  load(roundId: string): Promise<MinesRound | null>;
  /**
   * Atomic update. The implementation may use compare-and-set semantics
   * (e.g., on `updatedAt` or a version counter) to detect concurrent writes;
   * for the in-memory impl, all updates are sequential.
   */
  update(round: MinesRound): Promise<void>;
}

/**
 * In-memory round repository. Tests + spec validation only.
 */
export class InMemoryMinesRoundRepository implements MinesRoundRepository {
  private readonly rounds = new Map<string, MinesRound>();

  async create(round: MinesRound): Promise<void> {
    if (this.rounds.has(round.roundId)) {
      throw new DuplicateRoundError(round.roundId);
    }
    this.rounds.set(round.roundId, round);
    return Promise.resolve();
  }

  async load(roundId: string): Promise<MinesRound | null> {
    return Promise.resolve(this.rounds.get(roundId) ?? null);
  }

  async update(round: MinesRound): Promise<void> {
    if (!this.rounds.has(round.roundId)) {
      throw new RoundNotFoundError(round.roundId);
    }
    this.rounds.set(round.roundId, round);
    return Promise.resolve();
  }
}
