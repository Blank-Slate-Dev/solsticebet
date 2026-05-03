// packages/games/blackjack/src/dealer.ts
//
// Dealer drawing logic. Hits soft 17 (H17 rule).
// See docs/BLACKJACK.md § 1.2.

import { handTotal } from './cards.js';

/**
 * Returns true if the dealer should hit on the given hand.
 *
 * H17 rules:
 *   - Hit on totals ≤ 16
 *   - Hit on soft 17 (Ace + 6)
 *   - Stand on hard 17+, soft 18+
 */
export function dealerShouldHit(cards: readonly number[]): boolean {
  const t = handTotal(cards);
  if (t.isBust) return false;
  if (t.total < 17) return true;
  // Total is 17–21
  if (t.total === 17 && t.isSoft) return true; // soft 17 → hit
  return false;
}

/**
 * Plays out the dealer's hand: keeps drawing cards until the H17 rule says stand
 * or the dealer busts.
 *
 * @param initialCards dealer's starting cards (typically 2)
 * @param shoe array of remaining cards to draw from
 * @param cursor index in `shoe` of the next card to draw
 * @returns updated cards and new cursor
 */
export function playDealer(
  initialCards: readonly number[],
  shoe: readonly number[],
  cursor: number,
): { cards: readonly number[]; cursor: number } {
  const cards: number[] = [...initialCards];
  let c = cursor;
  while (dealerShouldHit(cards)) {
    const card = shoe[c];
    /* v8 ignore next 3 -- defensive; shoe is pre-derived to 32 cards which exceeds any realistic dealer draw */
    if (card === undefined) {
      throw new RangeError('dealer ran out of cards in shoe');
    }
    cards.push(card);
    c += 1;
  }
  return { cards, cursor: c };
}
