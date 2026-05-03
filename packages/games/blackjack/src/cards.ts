// packages/games/blackjack/src/cards.ts
//
// Card math for Blackjack.
// See docs/BLACKJACK.md § 1.

/**
 * Number of card ranks. 0=Ace, 1..8=2..9, 9..12=10/J/Q/K (all worth 10).
 */
export const RANKS = 13;

/**
 * Returns the "hard" point value of a card (Ace as 1).
 *
 * @throws RangeError on invalid rank
 */
export function cardValue(rank: number): number {
  if (!Number.isInteger(rank) || rank < 0 || rank >= RANKS) {
    throw new RangeError(`rank must be an integer in [0, ${String(RANKS)})`);
  }
  if (rank === 0) return 1; // Ace
  if (rank <= 8) return rank + 1; // 2..9 → 2..9
  return 10; // 10, J, Q, K
}

/**
 * Returns true if the rank is an Ace.
 */
export function isAce(rank: number): boolean {
  return rank === 0;
}

/**
 * Returns true if the rank is a 10-value card (10, J, Q, K).
 */
export function isTenValue(rank: number): boolean {
  return rank >= 9 && rank < RANKS;
}

/**
 * Computes the best Blackjack hand total: highest non-busting total achievable.
 * Aces count as 11 unless that would bust the hand, in which case they count as 1.
 *
 * Returns:
 *   total: number 2..30+ (the chosen total, capped at 21+ for busted hands)
 *   isSoft: true if at least one Ace is being counted as 11 in the chosen total
 *   isBust: total > 21
 *
 * @example
 *   handTotal([0, 9])    → { total: 21, isSoft: true, isBust: false }   // Ace + 10 = 21 (soft)
 *   handTotal([0, 0, 9]) → { total: 12, isSoft: false, isBust: false }  // Ace=1, Ace=1, 10
 *   handTotal([0, 5])    → { total: 16, isSoft: true, isBust: false }   // Ace + 5 → soft 16
 *   handTotal([9, 9, 9]) → { total: 30, isSoft: false, isBust: true }   // bust
 */
export interface HandTotal {
  readonly total: number;
  readonly isSoft: boolean;
  readonly isBust: boolean;
}

export function handTotal(cards: readonly number[]): HandTotal {
  let hardTotal = 0;
  let aceCount = 0;
  for (const card of cards) {
    if (isAce(card)) {
      aceCount += 1;
      hardTotal += 1; // Ace as 1 by default
    } else {
      hardTotal += cardValue(card);
    }
  }
  // Promote one Ace to 11 if it doesn't bust
  let total = hardTotal;
  let isSoft = false;
  if (aceCount > 0 && hardTotal + 10 <= 21) {
    total = hardTotal + 10;
    isSoft = true;
  }
  return { total, isSoft, isBust: total > 21 };
}

/**
 * Returns true if the hand is a "natural Blackjack" — exactly two cards
 * totaling 21 (Ace + 10-value).
 */
export function isBlackjack(cards: readonly number[]): boolean {
  if (cards.length !== 2) return false;
  const a = cards[0];
  const b = cards[1];
  if (a === undefined || b === undefined) return false;
  return (isAce(a) && isTenValue(b)) || (isAce(b) && isTenValue(a));
}

/**
 * Returns true if two cards are eligible for splitting.
 * Splittable when both cards have the same Blackjack value.
 * (Standard rule: 10/J/Q/K can all split together since they all value 10.)
 */
export function canSplit(cards: readonly number[]): boolean {
  if (cards.length !== 2) return false;
  const a = cards[0];
  const b = cards[1];
  if (a === undefined || b === undefined) return false;
  return cardValue(a) === cardValue(b) && (isAce(a) ? isAce(b) : !isAce(b));
}
