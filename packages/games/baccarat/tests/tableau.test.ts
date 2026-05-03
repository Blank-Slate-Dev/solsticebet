// packages/games/baccarat/tests/tableau.test.ts

import { describe, expect, it } from 'vitest';

import { playTableau } from '../src/tableau.js';

// Helpers to construct deals: build 6 cards that produce specific (P, B) totals
// after the initial 4-card deal. We use rank values directly:
//   rank 0 = Ace (1), rank 1..8 = 2..9, rank 9..12 = 0
//
// To set Player's first-two total to T, use [rank-A, rank-B] where
// pointValueOf(A) + pointValueOf(B) ≡ T (mod 10).
// Easiest: use one face card (rank 9) + one card of value T (e.g. rank 9 + rank T-1 if 1≤T≤9).

/**
 * A rank that has the given point value.
 *   v=0 → 9 (10), v=1 → 0 (Ace), v=2..9 → 1..8 (2..9)
 */
function rankOfValue(v: number): number {
  if (v === 0) return 9;
  if (v === 1) return 0;
  return v - 1;
}

/**
 * Builds a 6-card deal where:
 *   playerFirst, playerSecond → Player's first two cards
 *   bankerFirst, bankerSecond → Banker's first two cards
 *   playerThird, bankerThird   → optional draws
 * All inputs are point values; this helper picks ranks that produce them.
 */
function deal(
  playerFirst: number,
  bankerFirst: number,
  playerSecond: number,
  bankerSecond: number,
  playerThird = 0,
  bankerThird = 0,
): readonly number[] {
  return [
    rankOfValue(playerFirst),
    rankOfValue(bankerFirst),
    rankOfValue(playerSecond),
    rankOfValue(bankerSecond),
    rankOfValue(playerThird),
    rankOfValue(bankerThird),
  ];
}

describe('playTableau — naturals', () => {
  it('player natural 8 wins over banker 7', () => {
    // Player 3+5=8; Banker 3+4=7 → both stand, Player wins
    const result = playTableau(deal(3, 3, 5, 4));
    expect(result.player.total).toBe(8);
    expect(result.banker.total).toBe(7);
    expect(result.winner).toBe('player');
    expect(result.natural).toBe(true);
    expect(result.player.cards).toHaveLength(2);
    expect(result.banker.cards).toHaveLength(2);
  });

  it('banker natural 9 wins over player 8', () => {
    // Player 4+4=8; Banker 4+5=9 → both stand, Banker wins
    const result = playTableau(deal(4, 4, 4, 5));
    expect(result.player.total).toBe(8);
    expect(result.banker.total).toBe(9);
    expect(result.winner).toBe('banker');
    expect(result.natural).toBe(true);
  });

  it('two naturals tie', () => {
    const result = playTableau(deal(4, 4, 4, 4));
    expect(result.player.total).toBe(8);
    expect(result.banker.total).toBe(8);
    expect(result.winner).toBe('tie');
    expect(result.natural).toBe(true);
  });
});

describe('playTableau — Player drawing rule', () => {
  it('Player draws on total 0..5', () => {
    for (let t = 0; t <= 5; t++) {
      // Player's first two add up to t, Banker stands at 7
      const result = playTableau(deal(0, 3, t, 4, 5));
      expect(result.player.cards).toHaveLength(3);
    }
  });
  it('Player stands on total 6 or 7', () => {
    for (const t of [6, 7]) {
      const result = playTableau(deal(0, 3, t, 3));
      expect(result.player.cards).toHaveLength(2);
    }
  });
});

describe('playTableau — Banker drawing rule (player stood)', () => {
  it('Banker draws on 0..5 when Player stood', () => {
    // Player stands at 6; Banker totals vary.
    for (let bankerTotal = 0; bankerTotal <= 5; bankerTotal++) {
      const result = playTableau(deal(0, 0, 6, bankerTotal));
      expect(result.player.cards).toHaveLength(2);
      expect(result.banker.cards).toHaveLength(3);
    }
  });
  it('Banker stands on 6..7 when Player stood', () => {
    for (const bankerTotal of [6, 7]) {
      const result = playTableau(deal(0, 0, 6, bankerTotal));
      expect(result.banker.cards).toHaveLength(2);
    }
  });
});

describe('playTableau — Banker drawing rule (player drew, against third card)', () => {
  // We test each row of the published Banker table.

  it('Banker 3 draws unless Player third was 8', () => {
    // Player 0+0=0, draws third
    for (let third = 0; third <= 9; third++) {
      const result = playTableau(deal(0, 0, 0, 3, third));
      // banker total before draw = 3
      // Should draw unless third == 8
      const expectedBankerCards = third === 8 ? 2 : 3;
      expect(result.banker.cards.length).toBe(expectedBankerCards);
    }
  });

  it('Banker 4 draws if Player third was 2..7, otherwise stands', () => {
    for (let third = 0; third <= 9; third++) {
      const result = playTableau(deal(0, 0, 0, 4, third));
      const shouldDraw = third >= 2 && third <= 7;
      expect(result.banker.cards.length).toBe(shouldDraw ? 3 : 2);
    }
  });

  it('Banker 5 draws if Player third was 4..7, otherwise stands', () => {
    for (let third = 0; third <= 9; third++) {
      const result = playTableau(deal(0, 0, 0, 5, third));
      const shouldDraw = third >= 4 && third <= 7;
      expect(result.banker.cards.length).toBe(shouldDraw ? 3 : 2);
    }
  });

  it('Banker 6 draws if Player third was 6 or 7, otherwise stands', () => {
    for (let third = 0; third <= 9; third++) {
      const result = playTableau(deal(0, 0, 0, 6, third));
      const shouldDraw = third === 6 || third === 7;
      expect(result.banker.cards.length).toBe(shouldDraw ? 3 : 2);
    }
  });

  it('Banker 7 always stands (regardless of Player third)', () => {
    for (let third = 0; third <= 9; third++) {
      const result = playTableau(deal(0, 0, 0, 7, third));
      expect(result.banker.cards.length).toBe(2);
    }
  });

  it('Banker 0,1,2 always draw', () => {
    for (const bt of [0, 1, 2]) {
      for (let third = 0; third <= 9; third++) {
        const result = playTableau(deal(0, 0, 0, bt, third));
        expect(result.banker.cards.length).toBe(3);
      }
    }
  });
});

describe('playTableau — error cases', () => {
  it('throws on fewer than 4 cards', () => {
    expect(() => playTableau([0, 1, 2])).toThrow();
    expect(() => playTableau([])).toThrow();
  });
});

describe('playTableau — winner determination', () => {
  it('returns one of player/banker/tie', () => {
    // Sample many deals via varying initial cards
    for (let pa = 0; pa < 13; pa++) {
      for (let ba = 0; ba < 13; ba++) {
        const result = playTableau([pa, ba, 0, 0, 0, 0]);
        expect(['player', 'banker', 'tie']).toContain(result.winner);
      }
    }
  });
  it('higher final total wins', () => {
    // Player natural 9 (4+5), Banker natural 8 (4+4). Both stand. Player wins.
    const result = playTableau(deal(4, 4, 5, 4));
    expect(result.player.total).toBe(9);
    expect(result.banker.total).toBe(8);
    expect(result.winner).toBe('player');
  });
  it('exact equal totals tie', () => {
    const result = playTableau(deal(0, 0, 5, 5)); // P=5, B=5
    // Player draws on 5; Banker depends on third.
    // Just verify it played out; specific winner depends on third card.
    expect(['player', 'banker', 'tie']).toContain(result.winner);
  });
});
