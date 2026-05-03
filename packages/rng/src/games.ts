// packages/rng/src/games.ts
//
// Game-specific outcome mappers.
// Each game's mapping is defined here and only here.
// See docs/RNG.md § 3.

import { deriveFloats } from './core.js';

// ─── Dice ─────────────────────────────────────────────────────────────────

/**
 * The Dice roll value, in [0.00, 99.99] inclusive, in 0.01 increments.
 */
export interface DiceOutcome {
  readonly roll: number;
}

/**
 * Derives a Dice roll from RNG inputs.
 * See docs/RNG.md § 3.1.
 *
 * @param serverSeed 64-char hex
 * @param clientSeed printable ASCII
 * @param nonce per-seed counter
 */
export function deriveDice(serverSeed: string, clientSeed: string, nonce: number): DiceOutcome {
  const [f] = deriveFloats(serverSeed, clientSeed, nonce, 1);
  // f is guaranteed defined: deriveFloats with count >= 1 always returns at least one float.
  /* v8 ignore next 3 -- defensive invariant; unreachable given deriveFloats contract */
  if (f === undefined) {
    throw new Error('invariant: deriveFloats(count=1) returned empty');
  }
  const roll = Math.floor(f * 10000) / 100;
  return { roll };
}

// ─── Mines ────────────────────────────────────────────────────────────────

/**
 * The Mines tile count for a 5×5 grid. Constant; the engine doesn't support
 * other grid sizes in v1.
 */
export const MINES_TILE_COUNT = 25;

/**
 * Mines round outcome: a permutation of tile indices.
 * The first `mineCount` entries are the mine positions; the rest are safe.
 */
export interface MinesOutcome {
  readonly tilePermutation: readonly number[];
}

/**
 * Derives a Mines tile permutation via Fisher-Yates shuffle.
 * See docs/RNG.md § 3.2.
 *
 * Consumes 24 floats per round (one less than tile count).
 *
 * @param serverSeed 64-char hex
 * @param clientSeed printable ASCII
 * @param nonce per-seed counter
 */
export function deriveMines(serverSeed: string, clientSeed: string, nonce: number): MinesOutcome {
  const floats = deriveFloats(serverSeed, clientSeed, nonce, MINES_TILE_COUNT - 1);
  const indices: number[] = [];
  for (let i = 0; i < MINES_TILE_COUNT; i++) {
    indices.push(i);
  }

  // Fisher-Yates: walk from last to second; pick swap target in [0, i].
  for (let i = MINES_TILE_COUNT - 1; i >= 1; i--) {
    const f = floats[MINES_TILE_COUNT - 1 - i];
    /* v8 ignore next 3 -- defensive invariant; unreachable given deriveFloats contract */
    if (f === undefined) {
      throw new Error('invariant: insufficient floats for Mines shuffle');
    }
    const j = Math.floor(f * (i + 1));

    // i is in [1, MINES_TILE_COUNT-1] and j is in [0, i] so both are valid
    // indices into a length-MINES_TILE_COUNT array. We narrow explicitly to
    // satisfy noUncheckedIndexedAccess.
    const a = indices[i];
    const b = indices[j];
    /* v8 ignore next 3 -- defensive invariant; unreachable given index bounds */
    if (a === undefined || b === undefined) {
      throw new Error('invariant: indices out of bounds in Mines swap');
    }
    indices[i] = b;
    indices[j] = a;
  }

  return { tilePermutation: indices };
}

// ─── Plinko ───────────────────────────────────────────────────────────────

/**
 * Plinko row counts we support. 8 is standard; we may extend later.
 */
export type PlinkoRowCount = 8 | 12 | 16;

/**
 * Plinko outcome: the path the ball takes, and the resulting bucket index.
 */
export interface PlinkoOutcome {
  readonly path: readonly ('left' | 'right')[];
  readonly bucket: number;
}

/**
 * Derives a Plinko ball path and bucket.
 * See docs/RNG.md § 3.4.
 *
 * @param serverSeed 64-char hex
 * @param clientSeed printable ASCII
 * @param nonce per-seed counter
 * @param rows number of pin rows (and therefore decisions)
 */
export function derivePlinko(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rows: PlinkoRowCount = 8,
): PlinkoOutcome {
  const floats = deriveFloats(serverSeed, clientSeed, nonce, rows);
  const path: ('left' | 'right')[] = [];
  let bucket = 0;

  for (let i = 0; i < rows; i++) {
    const f = floats[i];
    /* v8 ignore next 3 -- defensive invariant; unreachable given deriveFloats contract */
    if (f === undefined) {
      throw new Error('invariant: insufficient floats for Plinko path');
    }
    if (f < 0.5) {
      path.push('left');
    } else {
      path.push('right');
      bucket += 1;
    }
  }

  return { path, bucket };
}

// ─── Crash ────────────────────────────────────────────────────────────────
//
// Intentionally deferred to its own implementation phase together with the
// Crash multiplayer engine. See docs/RNG.md § 3.3.
// The Stake-style Crash distribution will be defined and tested when the
// Crash game package is built. Adding a half-considered version here would
// just be code we'd have to re-audit.
