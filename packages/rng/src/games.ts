// packages/rng/src/games.ts
//
// Game-specific outcome mappers.
// Each game's mapping is defined here and only here.
// See docs/RNG.md § 3.

import { deriveFloats, hmac } from './core.js';

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

/**
 * The maximum multiplier we'll allow Crash to produce. Caps astronomical
 * float-precision artefacts and keeps payouts within the ledger ceiling.
 * This is much higher than any realistic player will hit.
 */
export const CRASH_MAX_MULTIPLIER = 1_000_000;

/**
 * Crash outcome: the bust multiplier. Players who cashed out before this
 * multiplier win at their cash-out level; players who held past it lose.
 */
export interface CrashOutcome {
  readonly bustAt: number;
}

/**
 * Derives the Crash bust multiplier using the canonical Stake-style algorithm.
 *
 * Algorithm (the published Stake-derivative):
 *   1. Take the first 4 bytes of the HMAC as a uint32 big-endian integer `h`.
 *   2. With probability 1/(houseEdgeDivisor) (= 1/33 ≈ 3%), the round busts at 1.00× —
 *      this is the house edge. (Stake uses 1/33; we follow.)
 *   3. Otherwise the bust multiplier is:
 *        bustAt = floor((100 * eMax - h) / (eMax - h)) / 100
 *      where eMax = 2^52 (we use the full 52-bit precision via the float).
 *
 * For the casino-uniform algorithm we use a simpler equivalent that uses the
 * 4-byte uint32 directly:
 *
 *   eMax = 2^32
 *   if h == 0:                bustAt = 1.00 (extremely rare; protective floor)
 *   if h % 33 == 0:            bustAt = 1.00 (house edge: ~3% of rounds bust at 1.00)
 *   else:
 *     bustAt = max(1.00, floor((100 * eMax - h) / (eMax - h)) / 100)
 *
 * This produces a long-tail distribution: most rounds bust early (near 1.00x),
 * occasional rounds reach high multipliers. Long-run RTP is ~97%.
 *
 * The implementation here is deliberately verbose so cert labs can audit it.
 *
 * @param serverSeed 64-char hex
 * @param clientSeed printable ASCII
 * @param nonce per-seed counter
 */
export function deriveCrash(serverSeed: string, clientSeed: string, nonce: number): CrashOutcome {
  const block = hmac(serverSeed, clientSeed, nonce, 0);

  // Take the first 4 bytes as a big-endian uint32. This is independent of the
  // float derivation so the Crash distribution is uniform over 2^32 buckets.
  const b0 = block[0] ?? 0;
  const b1 = block[1] ?? 0;
  const b2 = block[2] ?? 0;
  const b3 = block[3] ?? 0;
  // (b0 << 24) would overflow 31-bit signed int; multiply instead.
  const h = b0 * 0x1000000 + b1 * 0x10000 + b2 * 0x100 + b3;

  const eMax = 0x100000000; // 2^32

  // House edge: ~3% of rounds bust at exactly 1.00x.
  // Use h % 33 === 0 — produces close to 1/33 outcomes uniformly.
  if (h === 0 || h % 33 === 0) {
    return { bustAt: 1.0 };
  }

  // Normal distribution: bustAt = floor((100 * eMax - h) / (eMax - h)) / 100
  const numerator = 100 * eMax - h;
  const denominator = eMax - h;
  const raw = Math.floor(numerator / denominator) / 100;

  // Floor at 1.00 (defensive; the formula always yields ≥ 1.0 for h > 0)
  // Cap at CRASH_MAX_MULTIPLIER (defensive; only h very near eMax could
  // approach this).
  const bustAt = Math.min(Math.max(raw, 1.0), CRASH_MAX_MULTIPLIER);
  return { bustAt };
}

// ─── Ultimate Texas Hold'em ────────────────────────────────────────────────

/**
 * UTH needs 9 cards total: 2 player hole + 5 community + 2 dealer.
 * Each card needs both rank (0..12) and suit (0..3) because UTH cares about
 * flushes and straight flushes.
 *
 * We derive 18 floats (one for rank, one for suit per card). Suits don't
 * affect rank distributions — they're independently uniform — so this is
 * statistically clean.
 *
 * Note: drawing with replacement (as we do here) is a simplification vs a
 * physical deck. With 9 cards drawn from a 52-card universe, the probability
 * of any pair-of-identical-cards being drawn is small but non-zero. A
 * "duplicate card" would be visually confusing but mathematically the
 * outcomes still resolve cleanly. Real-money UTH at certification time will
 * use a no-replacement model; this v1 keeps the simpler RNG approach used
 * by every other game in this codebase.
 */
export const UTH_CARDS = 9;

export interface UthCard {
  readonly rank: number; // 0..12
  readonly suit: number; // 0..3
}

export interface UthOutcome {
  readonly cards: readonly UthCard[];
}

export function deriveUth(serverSeed: string, clientSeed: string, nonce: number): UthOutcome {
  const floats = deriveFloats(serverSeed, clientSeed, nonce, UTH_CARDS * 2);
  const cards: UthCard[] = [];
  for (let i = 0; i < UTH_CARDS; i++) {
    const rankF = floats[i * 2] ?? 0;
    const suitF = floats[i * 2 + 1] ?? 0;
    cards.push({
      rank: Math.floor(rankF * 13),
      suit: Math.floor(suitF * 4),
    });
  }
  return { cards };
}

// ─── Sic Bo ────────────────────────────────────────────────────────────────

/**
 * Sic Bo rolls three standard six-sided dice. 6^3 = 216 possible outcomes.
 */
export const SICBO_DICE = 3;
export const SICBO_FACES = 6;

/**
 * Sic Bo outcome: three dice values, each in [1, 6].
 */
export interface SicBoOutcome {
  readonly dice: readonly [number, number, number];
}

/**
 * Derives a Sic Bo roll: three independent uniform dice in [1, 6].
 *
 * @param serverSeed 64-char hex
 * @param clientSeed printable ASCII
 * @param nonce per-seed counter
 */
export function deriveSicBo(serverSeed: string, clientSeed: string, nonce: number): SicBoOutcome {
  const floats = deriveFloats(serverSeed, clientSeed, nonce, SICBO_DICE);
  const f0 = floats[0] ?? 0;
  const f1 = floats[1] ?? 0;
  const f2 = floats[2] ?? 0;
  const d1 = Math.floor(f0 * SICBO_FACES) + 1;
  const d2 = Math.floor(f1 * SICBO_FACES) + 1;
  const d3 = Math.floor(f2 * SICBO_FACES) + 1;
  return { dice: [d1, d2, d3] };
}

// ─── Keno ──────────────────────────────────────────────────────────────────

/**
 * Keno: 80-number grid; the server draws 20 winning numbers per round.
 * The player picks 1-10 numbers; payout depends on how many of their picks
 * appear in the drawn 20.
 */
export const KENO_TOTAL = 80;
export const KENO_DRAW = 20;

export interface KenoOutcome {
  /** Sorted ascending; 20 unique values from [1, 80]. */
  readonly drawn: readonly number[];
}

/**
 * Derives a Keno round: 20 unique numbers from 1..80 via Fisher-Yates partial
 * shuffle using floats from the RNG.
 */
export function deriveKeno(serverSeed: string, clientSeed: string, nonce: number): KenoOutcome {
  // Need KENO_DRAW (20) floats for the partial shuffle.
  const floats = deriveFloats(serverSeed, clientSeed, nonce, KENO_DRAW);
  // Build a pool [1..80].
  const pool: number[] = [];
  for (let i = 1; i <= KENO_TOTAL; i++) pool.push(i);
  // Partial Fisher-Yates: pick 20 distinct numbers.
  const drawn: number[] = [];
  for (let i = 0; i < KENO_DRAW; i++) {
    const f = floats[i] ?? 0;
    const remaining = KENO_TOTAL - i;
    const idx = Math.floor(f * remaining);
    // Swap pool[idx] with pool[remaining - 1 + i]; take pool[idx]
    const picked = pool[idx];
    /* v8 ignore next 1 -- defensive */
    if (picked === undefined) continue;
    drawn.push(picked);
    // Replace pool[idx] with the last unused element
    const lastUnusedIdx = remaining - 1;
    const swap = pool[lastUnusedIdx];
    if (swap !== undefined) pool[idx] = swap;
  }
  drawn.sort((a, b) => a - b);
  return { drawn };
}

// ─── Lucky Wheel ───────────────────────────────────────────────────────────

/**
 * Lucky Wheel: a single uniform float [0, 1) that maps to a wheel segment.
 * Engines apply their own segment weighting on top.
 */
export interface WheelOutcome {
  readonly value: number;
}

export function deriveWheel(serverSeed: string, clientSeed: string, nonce: number): WheelOutcome {
  const [f] = deriveFloats(serverSeed, clientSeed, nonce, 1);
  return { value: f ?? 0 };
}

// ─── Hi-Lo ─────────────────────────────────────────────────────────────────

/**
 * Hi-Lo: each card draw uses one cursor of the same nonce. We provide a
 * helper for engines to derive multiple card values within one round.
 *
 * Card encoding: 0..51 (rank 0..12 × suit 0..3), but for Hi-Lo only rank
 * matters. The engine will use just the rank.
 */
export const HILO_RANKS = 13;

export interface HiLoCardOutcome {
  readonly rank: number; // 0..12 (Ace=0, 2=1, …, K=12)
}

/**
 * Derives a Hi-Lo card at the given draw index within a round.
 * Different draw indices produce different cards from the same nonce.
 */
export function deriveHiLoCard(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  drawIndex: number,
): HiLoCardOutcome {
  if (!Number.isInteger(drawIndex) || drawIndex < 0) {
    throw new RangeError('drawIndex must be a non-negative integer');
  }
  // Use cursor=drawIndex with the existing hmac to get a fresh block per card.
  const block = hmac(serverSeed, clientSeed, nonce, drawIndex);
  // First 4 bytes → rank in [0, 13)
  const b0 = block[0] ?? 0;
  const b1 = block[1] ?? 0;
  const b2 = block[2] ?? 0;
  const b3 = block[3] ?? 0;
  const f = b0 / 0x100 + b1 / 0x10000 + b2 / 0x1000000 + b3 / 0x100000000;
  return { rank: Math.floor(f * HILO_RANKS) };
}

// ─── Limbo ─────────────────────────────────────────────────────────────────

/**
 * Limbo: a single uniform float [0, 1) → a multiplier curve.
 * Mathematically identical to Crash (long-tail distribution); we reuse
 * the same algorithm. RTP ~99% (1% house edge).
 */
export const LIMBO_MAX_MULTIPLIER = 1_000_000;

export interface LimboOutcome {
  readonly result: number;
}

export function deriveLimbo(serverSeed: string, clientSeed: string, nonce: number): LimboOutcome {
  const block = hmac(serverSeed, clientSeed, nonce, 0);
  const b0 = block[0] ?? 0;
  const b1 = block[1] ?? 0;
  const b2 = block[2] ?? 0;
  const b3 = block[3] ?? 0;
  const h = b0 * 0x1000000 + b1 * 0x10000 + b2 * 0x100 + b3;
  const eMax = 0x100000000;

  // Limbo uses a 1% house edge: 1/100 of rounds yield 1.00x.
  if (h === 0 || h % 100 === 0) {
    return { result: 1.0 };
  }
  // Same formula as Crash for the long-tail distribution.
  const numerator = 100 * eMax - h;
  const denominator = eMax - h;
  const raw = Math.floor(numerator / denominator) / 100;
  const result = Math.min(Math.max(raw, 1.0), LIMBO_MAX_MULTIPLIER);
  return { result };
}

// ─── Coin Flip ─────────────────────────────────────────────────────────────

export interface CoinFlipOutcome {
  /** 'heads' or 'tails'. */
  readonly side: 'heads' | 'tails';
}

export function deriveCoinFlip(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): CoinFlipOutcome {
  const [f] = deriveFloats(serverSeed, clientSeed, nonce, 1);
  return { side: (f ?? 0) < 0.5 ? 'heads' : 'tails' };
}
