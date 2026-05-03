// packages/games/uth/src/repository.ts
//
// UTH coup repository.

import type { UthCoup } from './types.js';

export class UthCoupError extends Error {
  override readonly name: string = 'UthCoupError';
}

export class CoupNotFoundError extends UthCoupError {
  override readonly name = 'CoupNotFoundError';
  constructor(coupId: string) {
    super(`UTH coup not found: ${coupId}`);
  }
}

export class DuplicateCoupError extends UthCoupError {
  override readonly name = 'DuplicateCoupError';
  constructor(coupId: string) {
    super(`UTH coup already exists: ${coupId}`);
  }
}

export interface UthCoupRepository {
  create(coup: UthCoup): Promise<void>;
  load(coupId: string): Promise<UthCoup | null>;
  update(coup: UthCoup): Promise<void>;
}

export class InMemoryUthCoupRepository implements UthCoupRepository {
  private readonly coups = new Map<string, UthCoup>();

  async create(coup: UthCoup): Promise<void> {
    if (this.coups.has(coup.coupId)) {
      throw new DuplicateCoupError(coup.coupId);
    }
    this.coups.set(coup.coupId, coup);
    return Promise.resolve();
  }

  async load(coupId: string): Promise<UthCoup | null> {
    return Promise.resolve(this.coups.get(coupId) ?? null);
  }

  async update(coup: UthCoup): Promise<void> {
    if (!this.coups.has(coup.coupId)) {
      throw new CoupNotFoundError(coup.coupId);
    }
    this.coups.set(coup.coupId, coup);
    return Promise.resolve();
  }
}
