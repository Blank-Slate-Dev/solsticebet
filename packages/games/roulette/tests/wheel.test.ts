// packages/games/roulette/tests/wheel.test.ts

import { describe, expect, it } from 'vitest';

import {
  assertValidPocket,
  colorOf,
  columnOf,
  dozenOf,
  isWinningBet,
  PAYOUTS,
} from '../src/wheel.js';
import type { RouletteBetType } from '../src/types.js';

describe('colorOf', () => {
  it('0 is green', () => {
    expect(colorOf(0)).toBe('green');
  });

  it('matches the standard European red set', () => {
    const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    for (const n of reds) {
      expect(colorOf(n)).toBe('red');
    }
  });

  it('blacks are everything else 1..36', () => {
    const reds = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    for (let n = 1; n <= 36; n++) {
      if (!reds.has(n)) {
        expect(colorOf(n)).toBe('black');
      }
    }
  });

  it('rejects out-of-range pockets', () => {
    expect(() => colorOf(-1)).toThrow();
    expect(() => colorOf(37)).toThrow();
    expect(() => colorOf(1.5)).toThrow();
  });
});

describe('dozenOf', () => {
  it('0 is dozen 0', () => {
    expect(dozenOf(0)).toBe(0);
  });
  it('1-12 is dozen 1', () => {
    for (let n = 1; n <= 12; n++) expect(dozenOf(n)).toBe(1);
  });
  it('13-24 is dozen 2', () => {
    for (let n = 13; n <= 24; n++) expect(dozenOf(n)).toBe(2);
  });
  it('25-36 is dozen 3', () => {
    for (let n = 25; n <= 36; n++) expect(dozenOf(n)).toBe(3);
  });
});

describe('columnOf', () => {
  it('0 is column 0', () => {
    expect(columnOf(0)).toBe(0);
  });
  it('column 1: 1, 4, 7, ..., 34', () => {
    for (let n = 1; n <= 36; n++) {
      if (n % 3 === 1) expect(columnOf(n)).toBe(1);
    }
  });
  it('column 2: 2, 5, 8, ..., 35', () => {
    for (let n = 1; n <= 36; n++) {
      if (n % 3 === 2) expect(columnOf(n)).toBe(2);
    }
  });
  it('column 3: 3, 6, 9, ..., 36', () => {
    for (let n = 1; n <= 36; n++) {
      if (n % 3 === 0) expect(columnOf(n)).toBe(3);
    }
  });
});

describe('PAYOUTS', () => {
  it('matches the documented table', () => {
    expect(PAYOUTS.straight).toBe(35);
    expect(PAYOUTS.split).toBe(17);
    expect(PAYOUTS.street).toBe(11);
    expect(PAYOUTS.corner).toBe(8);
    expect(PAYOUTS.six_line).toBe(5);
    expect(PAYOUTS.column).toBe(2);
    expect(PAYOUTS.dozen).toBe(2);
    expect(PAYOUTS.red).toBe(1);
    expect(PAYOUTS.black).toBe(1);
    expect(PAYOUTS.even).toBe(1);
    expect(PAYOUTS.odd).toBe(1);
    expect(PAYOUTS.low).toBe(1);
    expect(PAYOUTS.high).toBe(1);
  });
});

describe('isWinningBet — straight', () => {
  it('wins on exact match', () => {
    expect(isWinningBet('straight', 17, 17)).toBe(true);
  });
  it('loses on miss', () => {
    expect(isWinningBet('straight', 17, 18)).toBe(false);
    expect(isWinningBet('straight', 17, 0)).toBe(false);
  });
  it('rejects array target', () => {
    expect(() => isWinningBet('straight', [17, 18], 17)).toThrow();
  });
});

describe('isWinningBet — split', () => {
  it('wins on either number', () => {
    expect(isWinningBet('split', [1, 2], 1)).toBe(true);
    expect(isWinningBet('split', [1, 2], 2)).toBe(true);
  });
  it('loses on neither', () => {
    expect(isWinningBet('split', [1, 2], 3)).toBe(false);
  });
  it('accepts horizontal adjacency: [1,2] / [4,5] / [35,36]', () => {
    expect(isWinningBet('split', [1, 2], 1)).toBe(true);
    expect(isWinningBet('split', [4, 5], 5)).toBe(true);
    expect(isWinningBet('split', [35, 36], 36)).toBe(true);
  });
  it('accepts vertical adjacency: [1,4] / [33,36]', () => {
    expect(isWinningBet('split', [1, 4], 4)).toBe(true);
    expect(isWinningBet('split', [33, 36], 36)).toBe(true);
  });
  it('rejects non-adjacent splits', () => {
    expect(() => isWinningBet('split', [1, 5], 1)).toThrow(/not adjacent/);
    expect(() => isWinningBet('split', [3, 4], 1)).toThrow(/not adjacent/); // different rows
  });
  it('rejects zero-splits in v1', () => {
    expect(() => isWinningBet('split', [0, 1], 0)).toThrow(/zero-splits/);
  });
  it('rejects malformed array', () => {
    expect(() => isWinningBet('split', [1], 1)).toThrow();
    expect(() => isWinningBet('split', [1, 1], 1)).toThrow();
  });
});

describe('isWinningBet — street', () => {
  it('wins for any of the 3 numbers in the row', () => {
    expect(isWinningBet('street', 1, 1)).toBe(true);
    expect(isWinningBet('street', 1, 2)).toBe(true);
    expect(isWinningBet('street', 1, 3)).toBe(true);
  });
  it('loses outside the row', () => {
    expect(isWinningBet('street', 1, 4)).toBe(false);
    expect(isWinningBet('street', 1, 0)).toBe(false);
  });
  it('rejects invalid start', () => {
    expect(() => isWinningBet('street', 2, 0)).toThrow();
    expect(() => isWinningBet('street', 35, 0)).toThrow();
  });
});

describe('isWinningBet — corner', () => {
  it('wins on any of the 4 numbers in the square', () => {
    // Corner at 1 covers 1, 2, 4, 5
    expect(isWinningBet('corner', 1, 1)).toBe(true);
    expect(isWinningBet('corner', 1, 2)).toBe(true);
    expect(isWinningBet('corner', 1, 4)).toBe(true);
    expect(isWinningBet('corner', 1, 5)).toBe(true);
    expect(isWinningBet('corner', 1, 3)).toBe(false);
    expect(isWinningBet('corner', 1, 6)).toBe(false);
  });
  it('rejects column-3 starts (no rightward neighbour)', () => {
    expect(() => isWinningBet('corner', 3, 0)).toThrow(/column 1 or 2/);
  });
  it('rejects out-of-range corner starts', () => {
    expect(() => isWinningBet('corner', 0, 0)).toThrow(/out of range/);
    expect(() => isWinningBet('corner', 33, 0)).toThrow(/out of range/);
  });
});

describe('isWinningBet — six_line', () => {
  it('wins on any of the 6 numbers spanning two rows', () => {
    // six_line at 1 covers 1..6
    for (let n = 1; n <= 6; n++) {
      expect(isWinningBet('six_line', 1, n)).toBe(true);
    }
    expect(isWinningBet('six_line', 1, 7)).toBe(false);
  });
  it('rejects invalid starts', () => {
    expect(() => isWinningBet('six_line', 2, 0)).toThrow();
    expect(() => isWinningBet('six_line', 34, 0)).toThrow();
  });
});

describe('isWinningBet — column', () => {
  it('wins on the matching column', () => {
    expect(isWinningBet('column', 1, 1)).toBe(true);
    expect(isWinningBet('column', 1, 4)).toBe(true);
    expect(isWinningBet('column', 1, 34)).toBe(true);
    expect(isWinningBet('column', 2, 2)).toBe(true);
    expect(isWinningBet('column', 3, 36)).toBe(true);
  });
  it('loses on zero', () => {
    expect(isWinningBet('column', 1, 0)).toBe(false);
    expect(isWinningBet('column', 2, 0)).toBe(false);
    expect(isWinningBet('column', 3, 0)).toBe(false);
  });
  it('rejects invalid column index', () => {
    expect(() => isWinningBet('column', 4, 1)).toThrow();
    expect(() => isWinningBet('column', 0, 1)).toThrow();
  });
});

describe('isWinningBet — dozen', () => {
  it('matches dozen membership', () => {
    expect(isWinningBet('dozen', 1, 1)).toBe(true);
    expect(isWinningBet('dozen', 1, 12)).toBe(true);
    expect(isWinningBet('dozen', 1, 13)).toBe(false);
    expect(isWinningBet('dozen', 2, 13)).toBe(true);
    expect(isWinningBet('dozen', 2, 24)).toBe(true);
    expect(isWinningBet('dozen', 3, 25)).toBe(true);
    expect(isWinningBet('dozen', 3, 36)).toBe(true);
  });
  it('zero loses every dozen', () => {
    expect(isWinningBet('dozen', 1, 0)).toBe(false);
    expect(isWinningBet('dozen', 2, 0)).toBe(false);
    expect(isWinningBet('dozen', 3, 0)).toBe(false);
  });
  it('rejects invalid dozen index', () => {
    expect(() => isWinningBet('dozen', 0, 0)).toThrow();
    expect(() => isWinningBet('dozen', 4, 0)).toThrow();
  });
});

describe('isWinningBet — even-money bets', () => {
  it('red wins only on red', () => {
    expect(isWinningBet('red', undefined, 1)).toBe(true);
    expect(isWinningBet('red', undefined, 2)).toBe(false);
    expect(isWinningBet('red', undefined, 0)).toBe(false);
  });
  it('black wins only on black', () => {
    expect(isWinningBet('black', undefined, 2)).toBe(true);
    expect(isWinningBet('black', undefined, 1)).toBe(false);
    expect(isWinningBet('black', undefined, 0)).toBe(false);
  });
  it('even loses on zero', () => {
    expect(isWinningBet('even', undefined, 2)).toBe(true);
    expect(isWinningBet('even', undefined, 4)).toBe(true);
    expect(isWinningBet('even', undefined, 1)).toBe(false);
    expect(isWinningBet('even', undefined, 0)).toBe(false);
  });
  it('odd loses on zero', () => {
    expect(isWinningBet('odd', undefined, 1)).toBe(true);
    expect(isWinningBet('odd', undefined, 2)).toBe(false);
    expect(isWinningBet('odd', undefined, 0)).toBe(false);
  });
  it('low wins 1-18', () => {
    expect(isWinningBet('low', undefined, 1)).toBe(true);
    expect(isWinningBet('low', undefined, 18)).toBe(true);
    expect(isWinningBet('low', undefined, 19)).toBe(false);
    expect(isWinningBet('low', undefined, 0)).toBe(false);
  });
  it('high wins 19-36', () => {
    expect(isWinningBet('high', undefined, 19)).toBe(true);
    expect(isWinningBet('high', undefined, 36)).toBe(true);
    expect(isWinningBet('high', undefined, 18)).toBe(false);
    expect(isWinningBet('high', undefined, 0)).toBe(false);
  });
});

describe('assertValidPocket', () => {
  it('accepts 0..36', () => {
    for (let n = 0; n <= 36; n++) {
      expect(() => {
        assertValidPocket(n);
      }).not.toThrow();
    }
  });
  it('rejects out of range', () => {
    expect(() => {
      assertValidPocket(-1);
    }).toThrow();
    expect(() => {
      assertValidPocket(37);
    }).toThrow();
  });
});

describe('RTP property', () => {
  it('every bet type has RTP exactly 36/37 across all 37 pockets', () => {
    const bets: { type: RouletteBetType; target: number | readonly number[] | undefined }[] = [
      { type: 'straight', target: 17 },
      { type: 'split', target: [17, 18] },
      { type: 'street', target: 16 },
      { type: 'corner', target: 16 },
      { type: 'six_line', target: 16 },
      { type: 'column', target: 1 },
      { type: 'dozen', target: 2 },
      { type: 'red', target: undefined },
      { type: 'black', target: undefined },
      { type: 'even', target: undefined },
      { type: 'odd', target: undefined },
      { type: 'low', target: undefined },
      { type: 'high', target: undefined },
    ];

    for (const { type, target } of bets) {
      let totalReturn = 0;
      let wins = 0;
      for (let r = 0; r < 37; r++) {
        if (isWinningBet(type, target, r)) {
          wins += 1;
          totalReturn += PAYOUTS[type] + 1; // gross payout for 1 unit stake
        }
      }
      const rtp = totalReturn / 37;
      // RTP for every bet on European roulette is exactly 36/37.
      expect(rtp).toBeCloseTo(36 / 37, 9);
      expect(wins).toBeGreaterThan(0);
    }
  });
});
