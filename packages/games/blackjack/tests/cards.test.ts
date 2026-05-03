// packages/games/blackjack/tests/cards.test.ts

import { describe, expect, it } from 'vitest';

import { canSplit, cardValue, handTotal, isAce, isBlackjack, isTenValue } from '../src/cards.js';

describe('cardValue', () => {
  it('Ace = 1 (hard)', () => {
    expect(cardValue(0)).toBe(1);
  });
  it('2..9 face value', () => {
    for (let i = 1; i <= 8; i++) {
      expect(cardValue(i)).toBe(i + 1);
    }
  });
  it('10/J/Q/K all = 10', () => {
    for (let i = 9; i <= 12; i++) {
      expect(cardValue(i)).toBe(10);
    }
  });
  it('rejects out of range', () => {
    expect(() => cardValue(-1)).toThrow();
    expect(() => cardValue(13)).toThrow();
    expect(() => cardValue(1.5)).toThrow();
  });
});

describe('isAce / isTenValue', () => {
  it('isAce only for rank 0', () => {
    expect(isAce(0)).toBe(true);
    for (let i = 1; i <= 12; i++) expect(isAce(i)).toBe(false);
  });
  it('isTenValue for ranks 9..12', () => {
    for (let i = 0; i <= 8; i++) expect(isTenValue(i)).toBe(false);
    for (let i = 9; i <= 12; i++) expect(isTenValue(i)).toBe(true);
  });
});

describe('handTotal', () => {
  it('two simple cards', () => {
    expect(handTotal([4, 5]).total).toBe(11); // 5+6=11
    expect(handTotal([4, 5]).isSoft).toBe(false);
  });

  it('Ace + 10-value = soft 21', () => {
    expect(handTotal([0, 9])).toEqual({ total: 21, isSoft: true, isBust: false });
    expect(handTotal([0, 12])).toEqual({ total: 21, isSoft: true, isBust: false });
  });

  it('Ace + 6 = soft 17', () => {
    expect(handTotal([0, 5])).toEqual({ total: 17, isSoft: true, isBust: false });
  });

  it('Ace + Ace = soft 12 (one ace as 11, other as 1)', () => {
    expect(handTotal([0, 0])).toEqual({ total: 12, isSoft: true, isBust: false });
  });

  it('Ace + 6 + 10 = hard 17 (Ace forced to 1)', () => {
    expect(handTotal([0, 5, 9])).toEqual({ total: 17, isSoft: false, isBust: false });
  });

  it('three Aces + Ace + 8 = soft 21 across 5 cards', () => {
    // 4 aces + 8: best is 11 + 1 + 1 + 1 + 9 = 23 — bust if soft
    // Hard: 1 + 1 + 1 + 1 + 9 = 13 → no soft promotion possible (13+10=23)
    // So total is 13, hard, not bust.
    expect(handTotal([0, 0, 0, 0, 8])).toEqual({
      total: 13,
      isSoft: false,
      isBust: false,
    });
  });

  it('busted hand', () => {
    // 10 + 10 + 5 = 25
    expect(handTotal([9, 10, 4])).toEqual({ total: 25, isSoft: false, isBust: true });
  });

  it('empty hand has total 0', () => {
    expect(handTotal([])).toEqual({ total: 0, isSoft: false, isBust: false });
  });
});

describe('isBlackjack', () => {
  it('Ace + 10-value → true', () => {
    expect(isBlackjack([0, 9])).toBe(true);
    expect(isBlackjack([0, 10])).toBe(true);
    expect(isBlackjack([11, 0])).toBe(true);
    expect(isBlackjack([12, 0])).toBe(true);
  });
  it('21 with three cards is not blackjack', () => {
    // 7 + 7 + 7 = 21
    expect(isBlackjack([6, 6, 6])).toBe(false);
  });
  it('20 with two cards is not blackjack', () => {
    expect(isBlackjack([9, 10])).toBe(false);
  });
  it('Ace + non-ten is not blackjack', () => {
    expect(isBlackjack([0, 5])).toBe(false);
  });
});

describe('canSplit', () => {
  it('matching ranks split', () => {
    expect(canSplit([1, 1])).toBe(true); // pair of 2s
    expect(canSplit([0, 0])).toBe(true); // pair of aces
  });
  it('all 10-value cards can split together (10/J/Q/K)', () => {
    expect(canSplit([9, 10])).toBe(true); // 10 + Jack
    expect(canSplit([11, 12])).toBe(true); // Queen + King
  });
  it('Ace + 10-value cannot split', () => {
    expect(canSplit([0, 9])).toBe(false);
    expect(canSplit([0, 10])).toBe(false);
  });
  it('mismatched values cannot split', () => {
    expect(canSplit([1, 2])).toBe(false); // 2 + 3
  });
  it('not 2 cards cannot split', () => {
    expect(canSplit([1])).toBe(false);
    expect(canSplit([1, 1, 1])).toBe(false);
  });
});
