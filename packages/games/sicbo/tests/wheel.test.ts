// packages/games/sicbo/tests/wheel.test.ts

import { describe, expect, it } from 'vitest';

import { FIXED_PAYOUTS, maxWinMultiplier, TOTAL_PAYOUTS, winMultiplierFor } from '../src/wheel.js';

describe('TOTAL_PAYOUTS', () => {
  it('matches the published table', () => {
    expect(TOTAL_PAYOUTS[4]).toBe(60);
    expect(TOTAL_PAYOUTS[5]).toBe(30);
    expect(TOTAL_PAYOUTS[6]).toBe(17);
    expect(TOTAL_PAYOUTS[7]).toBe(12);
    expect(TOTAL_PAYOUTS[8]).toBe(8);
    expect(TOTAL_PAYOUTS[9]).toBe(6);
    expect(TOTAL_PAYOUTS[10]).toBe(6);
    expect(TOTAL_PAYOUTS[11]).toBe(6);
    expect(TOTAL_PAYOUTS[12]).toBe(6);
    expect(TOTAL_PAYOUTS[13]).toBe(8);
    expect(TOTAL_PAYOUTS[14]).toBe(12);
    expect(TOTAL_PAYOUTS[15]).toBe(17);
    expect(TOTAL_PAYOUTS[16]).toBe(30);
    expect(TOTAL_PAYOUTS[17]).toBe(60);
  });

  it('is symmetric around 10.5', () => {
    expect(TOTAL_PAYOUTS[4]).toBe(TOTAL_PAYOUTS[17]);
    expect(TOTAL_PAYOUTS[5]).toBe(TOTAL_PAYOUTS[16]);
    expect(TOTAL_PAYOUTS[6]).toBe(TOTAL_PAYOUTS[15]);
    expect(TOTAL_PAYOUTS[7]).toBe(TOTAL_PAYOUTS[14]);
    expect(TOTAL_PAYOUTS[8]).toBe(TOTAL_PAYOUTS[13]);
    expect(TOTAL_PAYOUTS[9]).toBe(TOTAL_PAYOUTS[12]);
    expect(TOTAL_PAYOUTS[10]).toBe(TOTAL_PAYOUTS[11]);
  });
});

describe('FIXED_PAYOUTS', () => {
  it('matches expected values', () => {
    expect(FIXED_PAYOUTS.small).toBe(1);
    expect(FIXED_PAYOUTS.big).toBe(1);
    expect(FIXED_PAYOUTS.even).toBe(1);
    expect(FIXED_PAYOUTS.odd).toBe(1);
    expect(FIXED_PAYOUTS.any_triple).toBe(30);
    expect(FIXED_PAYOUTS.specific_triple).toBe(180);
    expect(FIXED_PAYOUTS.specific_double).toBe(10);
    expect(FIXED_PAYOUTS.two_dice_combo).toBe(5);
  });
});

describe('winMultiplierFor — small/big', () => {
  it('small wins on totals 4-10 (no triple)', () => {
    expect(winMultiplierFor('small', undefined, [1, 1, 2])).toBe(1); // total 4
    expect(winMultiplierFor('small', undefined, [3, 3, 4])).toBe(1); // total 10
    expect(winMultiplierFor('small', undefined, [4, 4, 4])).toBe(0); // triple loses
    expect(winMultiplierFor('small', undefined, [1, 1, 1])).toBe(0); // triple loses
    expect(winMultiplierFor('small', undefined, [4, 4, 5])).toBe(0); // total 13
  });
  it('big wins on totals 11-17 (no triple)', () => {
    expect(winMultiplierFor('big', undefined, [3, 4, 4])).toBe(1); // total 11
    expect(winMultiplierFor('big', undefined, [5, 6, 6])).toBe(1); // total 17
    expect(winMultiplierFor('big', undefined, [6, 6, 6])).toBe(0); // triple loses
    expect(winMultiplierFor('big', undefined, [1, 2, 3])).toBe(0); // total 6
  });
});

describe('winMultiplierFor — even/odd', () => {
  it('even wins on even totals (no triple)', () => {
    expect(winMultiplierFor('even', undefined, [1, 2, 3])).toBe(1); // total 6
    expect(winMultiplierFor('even', undefined, [2, 2, 2])).toBe(0); // triple even loses
  });
  it('odd wins on odd totals (no triple)', () => {
    expect(winMultiplierFor('odd', undefined, [1, 2, 4])).toBe(1); // total 7
    expect(winMultiplierFor('odd', undefined, [3, 3, 3])).toBe(0); // triple odd loses
  });
});

describe('winMultiplierFor — total', () => {
  it('matches target sum', () => {
    expect(winMultiplierFor('total', 4, [1, 1, 2])).toBe(60);
    expect(winMultiplierFor('total', 17, [5, 6, 6])).toBe(60);
    expect(winMultiplierFor('total', 7, [1, 2, 4])).toBe(12);
  });
  it('loses on mismatch', () => {
    expect(winMultiplierFor('total', 7, [1, 1, 1])).toBe(0);
  });
  it('rejects non-numeric or invalid target', () => {
    expect(() => winMultiplierFor('total', undefined, [1, 1, 1])).toThrow();
    expect(() => winMultiplierFor('total', 3, [1, 1, 1])).toThrow();
    expect(() => winMultiplierFor('total', 18, [6, 6, 6])).toThrow();
  });
});

describe('winMultiplierFor — triples', () => {
  it('any_triple wins on any three-of-a-kind', () => {
    expect(winMultiplierFor('any_triple', undefined, [1, 1, 1])).toBe(30);
    expect(winMultiplierFor('any_triple', undefined, [6, 6, 6])).toBe(30);
    expect(winMultiplierFor('any_triple', undefined, [1, 1, 2])).toBe(0);
  });
  it('specific_triple wins only on matching triple', () => {
    expect(winMultiplierFor('specific_triple', 4, [4, 4, 4])).toBe(180);
    expect(winMultiplierFor('specific_triple', 4, [3, 3, 3])).toBe(0);
    expect(winMultiplierFor('specific_triple', 4, [4, 4, 5])).toBe(0);
  });
  it('rejects invalid face for specific_triple', () => {
    expect(() => winMultiplierFor('specific_triple', 0, [1, 1, 1])).toThrow();
    expect(() => winMultiplierFor('specific_triple', 7, [1, 1, 1])).toThrow();
    expect(() => winMultiplierFor('specific_triple', undefined, [1, 1, 1])).toThrow();
  });
});

describe('winMultiplierFor — specific double', () => {
  it('wins on at least 2 matching dice', () => {
    expect(winMultiplierFor('specific_double', 5, [5, 5, 1])).toBe(10);
    expect(winMultiplierFor('specific_double', 5, [5, 5, 5])).toBe(10); // triple counts as double
    expect(winMultiplierFor('specific_double', 5, [5, 1, 2])).toBe(0);
    expect(winMultiplierFor('specific_double', 5, [1, 2, 3])).toBe(0);
  });
  it('rejects malformed target', () => {
    expect(() => winMultiplierFor('specific_double', undefined, [1, 1, 1])).toThrow(/face target/);
    expect(() => winMultiplierFor('specific_double', 0, [1, 1, 1])).toThrow();
    expect(() => winMultiplierFor('specific_double', 7, [1, 1, 1])).toThrow();
  });
});

describe('winMultiplierFor — two-dice combo', () => {
  it('wins when both target faces appear', () => {
    expect(winMultiplierFor('two_dice_combo', [1, 2], [1, 2, 3])).toBe(5);
    expect(winMultiplierFor('two_dice_combo', [1, 2], [1, 1, 2])).toBe(5);
    expect(winMultiplierFor('two_dice_combo', [1, 2], [1, 2, 2])).toBe(5);
    expect(winMultiplierFor('two_dice_combo', [1, 2], [1, 3, 4])).toBe(0);
    expect(winMultiplierFor('two_dice_combo', [1, 2], [3, 4, 5])).toBe(0);
  });
  it('rejects malformed pairs', () => {
    expect(() => winMultiplierFor('two_dice_combo', undefined, [1, 1, 1])).toThrow();
    expect(() => winMultiplierFor('two_dice_combo', [1, 1], [1, 1, 1])).toThrow(/distinct/);
    expect(() => winMultiplierFor('two_dice_combo', [0, 2], [1, 1, 1])).toThrow();
    expect(() => winMultiplierFor('two_dice_combo', 5, [1, 1, 1])).toThrow();
  });
});

describe('winMultiplierFor — single die', () => {
  it('pays 1:1 / 2:1 / 3:1 based on match count', () => {
    expect(winMultiplierFor('single_die', 3, [3, 1, 2])).toBe(1);
    expect(winMultiplierFor('single_die', 3, [3, 3, 2])).toBe(2);
    expect(winMultiplierFor('single_die', 3, [3, 3, 3])).toBe(3);
    expect(winMultiplierFor('single_die', 3, [1, 2, 4])).toBe(0);
  });
  it('rejects invalid face', () => {
    expect(() => winMultiplierFor('single_die', 0, [1, 1, 1])).toThrow();
    expect(() => winMultiplierFor('single_die', undefined, [1, 1, 1])).toThrow();
  });
});

describe('maxWinMultiplier', () => {
  it('returns the headline cap per bet type', () => {
    expect(maxWinMultiplier('specific_triple', 1)).toBe(180);
    expect(maxWinMultiplier('any_triple', undefined)).toBe(30);
    expect(maxWinMultiplier('specific_double', 1)).toBe(10);
    expect(maxWinMultiplier('two_dice_combo', [1, 2])).toBe(5);
    expect(maxWinMultiplier('single_die', 1)).toBe(3);
    expect(maxWinMultiplier('total', 4)).toBe(60);
    expect(maxWinMultiplier('total', 9)).toBe(6);
    expect(maxWinMultiplier('small', undefined)).toBe(1);
    expect(maxWinMultiplier('big', undefined)).toBe(1);
    expect(maxWinMultiplier('even', undefined)).toBe(1);
    expect(maxWinMultiplier('odd', undefined)).toBe(1);
  });

  it('total without numeric target falls back to defensive 60', () => {
    expect(maxWinMultiplier('total', undefined)).toBe(60);
  });
});

describe('RTP property — small', () => {
  it('iterating all 216 outcomes gives the expected win count', () => {
    let smallWins = 0;
    let bigWins = 0;
    let triples = 0;
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        for (let cc = 1; cc <= 6; cc++) {
          const dice: [number, number, number] = [a, b, cc];
          if (a === b && b === cc) triples += 1;
          if (winMultiplierFor('small', undefined, dice) > 0) smallWins += 1;
          if (winMultiplierFor('big', undefined, dice) > 0) bigWins += 1;
        }
      }
    }
    expect(triples).toBe(6); // 6 triples
    // Small/Big each win on 105 of 216 outcomes → 105/216 = 48.61%
    // RTP = 105/216 * 2 = 210/216 = 97.22%
    expect(smallWins).toBe(105);
    expect(bigWins).toBe(105);
  });
});
