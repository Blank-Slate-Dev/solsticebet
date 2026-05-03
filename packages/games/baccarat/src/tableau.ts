// packages/games/baccarat/src/tableau.ts
//
// Punto Banco drawing rules ("the tableau").
// See docs/BACCARAT.md § 2.2.

import { handTotal, pointValueOf } from './cards.js';
import type { BaccaratDeal, BaccaratHand, BaccaratWinner } from './types.js';

/**
 * Plays out a Baccarat coup from a sequence of card ranks.
 *
 * Cards are consumed in the standard dealing order: Player gets index 0 and 2,
 * Banker gets 1 and 3. If the tableau requires a Player third card, it's
 * card 4. If Banker draws a third, it's card 5 (or 4, if Player didn't draw).
 *
 * @param cards 6 card ranks (0..12); fewer than 6 may be consumed
 * @returns full deal record with both hands and the winner
 */
export function playTableau(cards: readonly number[]): BaccaratDeal {
  if (cards.length < 4) {
    throw new RangeError('Baccarat needs at least 4 cards to play');
  }

  // Initial deal
  // Indexed access on length-checked array narrows safely; non-null assertions
  // are forbidden by ESLint. We use checked variables and assert lengths.
  const c0 = cards[0];
  const c1 = cards[1];
  const c2 = cards[2];
  const c3 = cards[3];
  /* v8 ignore next 3 -- length checked above; defensive for noUncheckedIndexedAccess */
  if (c0 === undefined || c1 === undefined || c2 === undefined || c3 === undefined) {
    throw new Error('invariant: indexed cards are undefined despite length check');
  }
  const playerCards: number[] = [c0, c2];
  const bankerCards: number[] = [c1, c3];

  let playerTotal = handTotal(playerCards);
  let bankerTotal = handTotal(bankerCards);

  // Natural: 8 or 9 on the first two cards of either side → both stand
  const natural = playerTotal >= 8 || bankerTotal >= 8;
  let nextCardIndex = 4;
  let playerThirdValue: number | null = null;

  if (!natural) {
    // Player rule: 0–5 draw, 6–7 stand
    if (playerTotal <= 5) {
      const drawn = cards[nextCardIndex];
      /* v8 ignore next 3 -- defensive; cards length should be >= 5 in practice */
      if (drawn === undefined) {
        throw new RangeError('not enough cards for Player third draw');
      }
      playerCards.push(drawn);
      playerThirdValue = pointValueOf(drawn);
      nextCardIndex += 1;
      playerTotal = handTotal(playerCards);
    }

    // Banker rule depends on whether Player drew
    let bankerDraws = false;
    if (playerThirdValue === null) {
      // Player stood — Banker uses simple rule
      bankerDraws = bankerTotal <= 5;
    } else {
      // Player drew — Banker uses table
      bankerDraws = bankerDrawsAgainstThird(bankerTotal, playerThirdValue);
    }

    if (bankerDraws) {
      const drawn = cards[nextCardIndex];
      /* v8 ignore next 3 -- defensive; cards length should be >= 6 in practice */
      if (drawn === undefined) {
        throw new RangeError('not enough cards for Banker third draw');
      }
      bankerCards.push(drawn);
      bankerTotal = handTotal(bankerCards);
    }
  }

  const player: BaccaratHand = { cards: playerCards, total: playerTotal };
  const banker: BaccaratHand = { cards: bankerCards, total: bankerTotal };

  let winner: BaccaratWinner;
  if (playerTotal > bankerTotal) winner = 'player';
  else if (bankerTotal > playerTotal) winner = 'banker';
  else winner = 'tie';

  return { player, banker, winner, natural };
}

/**
 * The Banker's drawing decision when Player drew a third card.
 *
 * From the Punto Banco tableau:
 *   Banker total 0,1,2  → always draw
 *   Banker total 3      → draw unless Player's third was 8
 *   Banker total 4      → draw if Player's third was 2..7
 *   Banker total 5      → draw if Player's third was 4..7
 *   Banker total 6      → draw if Player's third was 6 or 7
 *   Banker total 7      → always stand
 *   Banker total 8,9    → already a natural (handled above)
 */
function bankerDrawsAgainstThird(bankerTotal: number, playerThirdValue: number): boolean {
  switch (bankerTotal) {
    case 0:
    case 1:
    case 2:
      return true;
    case 3:
      return playerThirdValue !== 8;
    case 4:
      return playerThirdValue >= 2 && playerThirdValue <= 7;
    case 5:
      return playerThirdValue >= 4 && playerThirdValue <= 7;
    case 6:
      return playerThirdValue === 6 || playerThirdValue === 7;
    case 7:
      return false;
    /* v8 ignore next 4 -- 8/9 are naturals handled before this function is called */
    default:
      throw new RangeError(
        `bankerDrawsAgainstThird invariant: total ${String(bankerTotal)} should not reach here`,
      );
  }
}
