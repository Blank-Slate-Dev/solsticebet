// packages/games/baccarat/src/cards.ts
//
// Card rank → point value mapping for Baccarat.
// See docs/BACCARAT.md § 1.
//
// Rank encoding (matches the RNG's deriveBaccarat output):
//   0     = Ace (point value 1)
//   1..8  = 2..9 (face value)
//   9..12 = 10, J, Q, K (point value 0)

/**
 * The number of card ranks in a deck (suits don't affect Baccarat).
 */
export const RANKS = 13;

/**
 * Returns the Baccarat point value of a card rank.
 *
 * @param rank integer in [0, 13)
 * @throws RangeError on invalid rank
 */
export function pointValueOf(rank: number): number {
  if (!Number.isInteger(rank) || rank < 0 || rank >= RANKS) {
    throw new RangeError(`rank must be an integer in [0, ${String(RANKS)})`);
  }
  if (rank === 0) return 1; // Ace
  if (rank <= 8) return rank + 1; // 2..9 → 2..9
  return 0; // 10, J, Q, K
}

/**
 * Computes the Baccarat hand total: sum of card point values mod 10.
 */
export function handTotal(cards: readonly number[]): number {
  let sum = 0;
  for (const card of cards) {
    sum += pointValueOf(card);
  }
  return sum % 10;
}
