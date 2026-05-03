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

// ─── Roulette ─────────────────────────────────────────────────────────────

/**
 * The number of pockets on a European roulette wheel: 0..36 inclusive.
 */
export const ROULETTE_POCKETS = 37;

/**
 * Roulette outcome: the winning pocket number, 0..36 inclusive.
 */
export interface RouletteOutcome {
  readonly result: number;
}

/**
 * Derives a European roulette spin result.
 *
 * Maps a single uniform float in [0, 1) to a uniformly-distributed integer
 * in [0, 36]. Each pocket has probability 1/37 ≈ 2.703%.
 *
 * Note: while there are 37 pockets, a 4-byte float gives 2^32 possible
 * values which divide cleanly into 37 buckets to within 1 part in 2^27
 * uniformity — far below detection at any realistic sample size.
 *
 * @param serverSeed 64-char hex
 * @param clientSeed printable ASCII
 * @param nonce per-seed counter
 */
export function deriveRoulette(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): RouletteOutcome {
  const [f] = deriveFloats(serverSeed, clientSeed, nonce, 1);
  /* v8 ignore next 3 -- defensive invariant; unreachable given deriveFloats contract */
  if (f === undefined) {
    throw new Error('invariant: deriveFloats(count=1) returned empty');
  }
  const result = Math.floor(f * ROULETTE_POCKETS);
  return { result };
}

// ─── Baccarat ─────────────────────────────────────────────────────────────

/**
 * Maximum cards dealt in a single Baccarat coup: 3 to Player + 3 to Banker.
 */
export const BACCARAT_MAX_CARDS = 6;

/**
 * Number of card ranks in a standard deck. Suits don't affect Baccarat
 * outcomes (only the rank's point value matters), so we draw from a
 * uniform 13-rank distribution. This is the standard published approach
 * for provably-fair Baccarat used by Stake-derivative casinos.
 */
export const BACCARAT_RANKS = 13;

/**
 * Baccarat deal: a sequence of 6 card ranks (0..12), where:
 *   0 = Ace (point value 1)
 *   1..8 = 2..9 (face value)
 *   9 = 10 (point value 0)
 *   10 = Jack (point value 0)
 *   11 = Queen (point value 0)
 *   12 = King (point value 0)
 *
 * The engine consumes cards in order: Player gets cards 0 and 2, Banker gets
 * 1 and 3, then up to two more (4 to whichever side draws first per the
 * tableau, 5 to the other if needed).
 */
export interface BaccaratOutcome {
  readonly cards: readonly number[];
}

/**
 * Derives a Baccarat coup. Returns 6 card ranks; the engine will use as many
 * as the tableau requires (typically 4 or 5).
 *
 * @param serverSeed 64-char hex
 * @param clientSeed printable ASCII
 * @param nonce per-seed counter
 */
export function deriveBaccarat(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): BaccaratOutcome {
  const floats = deriveFloats(serverSeed, clientSeed, nonce, BACCARAT_MAX_CARDS);
  const cards: number[] = [];
  for (const f of floats) {
    cards.push(Math.floor(f * BACCARAT_RANKS));
  }
  return { cards };
}

// ─── Blackjack ────────────────────────────────────────────────────────────

/**
 * Maximum cards a single Blackjack round can use. With 4 split hands,
 * each holding up to 21 cards (theoretical extreme: lots of low cards),
 * we'd never realistically exceed this. Most rounds use 4–8 cards.
 */
export const BLACKJACK_MAX_CARDS = 32;

/**
 * Number of card ranks (suits don't affect outcome). 13 ranks:
 * 0=Ace (1 or 11), 1..8=2..9 (face value), 9=10, 10=Jack, 11=Queen, 12=King.
 * Ranks 9..12 all count as 10 in Blackjack scoring.
 */
export const BLACKJACK_RANKS = 13;

/**
 * A Blackjack deal: a sequence of 32 card ranks. The engine consumes them
 * in order as cards are drawn — initial deal first (P/D/P/D), then any
 * hits/doubles/splits.
 */
export interface BlackjackOutcome {
  readonly cards: readonly number[];
}

/**
 * Derives a Blackjack shoe (32 card ranks) for a single round.
 *
 * @param serverSeed 64-char hex
 * @param clientSeed printable ASCII
 * @param nonce per-seed counter
 */
export function deriveBlackjack(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): BlackjackOutcome {
  const floats = deriveFloats(serverSeed, clientSeed, nonce, BLACKJACK_MAX_CARDS);
  const cards: number[] = [];
  for (const f of floats) {
    cards.push(Math.floor(f * BLACKJACK_RANKS));
  }
  return { cards };
}

// ─── Crash ────────────────────────────────────────────────────────────────
//
// Intentionally deferred to its own implementation phase together with the
// Crash multiplayer engine. See docs/RNG.md § 3.3.
// The Stake-style Crash distribution will be defined and tested when the
// Crash game package is built. Adding a half-considered version here would
// just be code we'd have to re-audit.
