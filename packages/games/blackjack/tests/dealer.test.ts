// packages/games/blackjack/tests/dealer.test.ts

import { describe, expect, it } from 'vitest';

import { dealerShouldHit, playDealer } from '../src/dealer.js';

describe('dealerShouldHit', () => {
  it('hits on 16 or below', () => {
    expect(dealerShouldHit([9, 5])).toBe(true); // 10+6=16
    expect(dealerShouldHit([4, 4, 4])).toBe(true); // 5+5+5=15
    expect(dealerShouldHit([0, 0])).toBe(true); // soft 12
  });
  it('hits on soft 17 (H17 rule)', () => {
    expect(dealerShouldHit([0, 5])).toBe(true); // Ace + 6 = soft 17
  });
  it('stands on hard 17', () => {
    expect(dealerShouldHit([9, 6])).toBe(false); // 10 + 7 = 17
  });
  it('stands on soft 18+', () => {
    expect(dealerShouldHit([0, 6])).toBe(false); // Ace + 7 = soft 18
    expect(dealerShouldHit([0, 9])).toBe(false); // Ace + 10 = soft 21
  });
  it('stands when busted', () => {
    expect(dealerShouldHit([9, 10, 6])).toBe(false); // 26
  });
});

describe('playDealer', () => {
  it('plays out and returns final cards + cursor', () => {
    // Dealer 16, draws and gets a 5 → 21
    const result = playDealer([9, 5], [4], 0);
    expect(result.cards).toEqual([9, 5, 4]);
    expect(result.cursor).toBe(1);
  });
  it('stops on hard 17', () => {
    const result = playDealer([9, 6], [], 0);
    expect(result.cards).toEqual([9, 6]);
    expect(result.cursor).toBe(0);
  });
  it('hits soft 17 (H17)', () => {
    // Dealer Ace + 6 → soft 17, should hit
    const result = playDealer([0, 5], [9], 0); // hits a 10 → busts at 17? 1+6+10=17 (hard) — stands
    // Soft 17 → 11+6=17, hits, draws 10. Now total: 1+6+10=17 (hard), stands
    expect(result.cards).toEqual([0, 5, 9]);
  });
  it('keeps hitting until standing or busting', () => {
    // Dealer 4+4=8, draws 5,3,7 → 8+5=13, +3=16, +7=23 bust
    const result = playDealer([3, 3], [4, 2, 6], 0);
    expect(result.cards).toEqual([3, 3, 4, 2, 6]); // 4+4+5+3+7=23
    expect(result.cursor).toBe(3);
  });
});
