// packages/games/uth/src/evaluator.ts
//
// Five-card poker hand evaluator.
//
// Rank encoding (matches RNG/Baccarat/Blackjack):
//   0 = Ace, 1..8 = 2..9, 9 = 10, 10 = Jack, 11 = Queen, 12 = King
//
// For poker purposes, Aces are HIGH by default (rank value 14), but can
// also count as LOW (rank value 1) for wheel straights (A-2-3-4-5).

import type { UthCard } from '@solsticebet/rng';

import type { HandRankName, HandScore } from './types.js';

/**
 * Returns the poker rank value of a card. Aces count as 14 (high).
 * 2..9 → 2..9, 10 → 10, J → 11, Q → 12, K → 13, A → 14.
 */
function pokerRankValue(rank: number): number {
  if (rank === 0) return 14; // Ace high
  if (rank <= 8) return rank + 1; // 2..9
  if (rank === 9) return 10;
  if (rank === 10) return 11;
  if (rank === 11) return 12;
  return 13; // King
}

const HAND_RANK_INDEX: Readonly<Record<HandRankName, number>> = {
  high_card: 0,
  pair: 1,
  two_pair: 2,
  three_kind: 3,
  straight: 4,
  flush: 5,
  full_house: 6,
  four_kind: 7,
  straight_flush: 8,
  royal_flush: 9,
};

/**
 * Encodes a hand's tie-break info as a single number.
 * The hand class index dominates; tie-breakers fill the lower digits.
 */
function encodeScore(rankName: HandRankName, kickers: readonly number[]): number {
  // 9 hand-rank classes × ~10^7 kicker space.
  const base = HAND_RANK_INDEX[rankName] * 1e9;
  // Kickers ordered most-significant first. Each gets a base-15 digit.
  let kickerScore = 0;
  for (const k of kickers) {
    kickerScore = kickerScore * 15 + k;
  }
  return base + kickerScore;
}

/**
 * Evaluates a 5-card hand and returns its rank, score, and canonical cards.
 *
 * @throws RangeError if cards is not exactly 5 cards
 */
export function evaluateFive(cards: readonly UthCard[]): HandScore {
  if (cards.length !== 5) {
    throw new RangeError('evaluateFive requires exactly 5 cards');
  }

  // Get rank values and group counts
  const values = cards.map((c) => pokerRankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  // Group by value, count occurrences
  const counts = new Map<number, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  // Sort distinct values: by count desc, then by value desc
  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const isFlush = suits.every((s) => s === suits[0]);

  // Check straight: consecutive values, or wheel A-2-3-4-5
  const sortedAsc = [...values].sort((a, b) => a - b);
  const uniqueAsc = Array.from(new Set(sortedAsc));
  let isStraight = false;
  let straightHigh = 0;
  if (uniqueAsc.length === 5) {
    const a0 = uniqueAsc[0];
    const a4 = uniqueAsc[4];
    if (a0 !== undefined && a4 !== undefined && a4 - a0 === 4) {
      isStraight = true;
      straightHigh = a4;
    } else if (
      // Wheel: A-2-3-4-5 (values 14, 2, 3, 4, 5 → sorted asc: 2,3,4,5,14)
      uniqueAsc[0] === 2 &&
      uniqueAsc[1] === 3 &&
      uniqueAsc[2] === 4 &&
      uniqueAsc[3] === 5 &&
      uniqueAsc[4] === 14
    ) {
      isStraight = true;
      straightHigh = 5; // Ace plays low; 5 is the high card of the wheel
    }
  }

  // Royal flush: straight flush with high card == 14 (and not the wheel)
  if (isStraight && isFlush && straightHigh === 14) {
    return {
      rank: 'royal_flush',
      score: encodeScore('royal_flush', [14]),
      cards: [...cards],
    };
  }

  if (isStraight && isFlush) {
    return {
      rank: 'straight_flush',
      score: encodeScore('straight_flush', [straightHigh]),
      cards: [...cards],
    };
  }

  // Four of a kind: top group has count 4
  const g0 = groups[0];
  if (g0?.[1] === 4) {
    const four = g0[0];
    const kicker = groups[1]?.[0] ?? 0;
    return {
      rank: 'four_kind',
      score: encodeScore('four_kind', [four, kicker]),
      cards: [...cards],
    };
  }

  // Full house: top group 3, second group 2
  if (g0?.[1] === 3 && groups[1]?.[1] === 2) {
    const three = g0[0];
    const pair = groups[1][0];
    return {
      rank: 'full_house',
      score: encodeScore('full_house', [three, pair]),
      cards: [...cards],
    };
  }

  if (isFlush) {
    return {
      rank: 'flush',
      score: encodeScore('flush', values),
      cards: [...cards],
    };
  }

  if (isStraight) {
    return {
      rank: 'straight',
      score: encodeScore('straight', [straightHigh]),
      cards: [...cards],
    };
  }

  // Three of a kind: top group 3, second group !=2 (already covered full house)
  if (g0?.[1] === 3) {
    const three = g0[0];
    const kickers = groups
      .slice(1)
      .map((g) => g[0])
      .sort((a, b) => b - a);
    return {
      rank: 'three_kind',
      score: encodeScore('three_kind', [three, ...kickers]),
      cards: [...cards],
    };
  }

  // Two pair: first two groups both count 2
  if (g0?.[1] === 2 && groups[1]?.[1] === 2) {
    const pair1 = g0[0];
    const pair2 = groups[1][0];
    const kicker = groups[2]?.[0] ?? 0;
    return {
      rank: 'two_pair',
      score: encodeScore('two_pair', [pair1, pair2, kicker]),
      cards: [...cards],
    };
  }

  // Pair
  if (g0?.[1] === 2) {
    const pair = g0[0];
    const kickers = groups
      .slice(1)
      .map((g) => g[0])
      .sort((a, b) => b - a);
    return {
      rank: 'pair',
      score: encodeScore('pair', [pair, ...kickers]),
      cards: [...cards],
    };
  }

  // High card
  return {
    rank: 'high_card',
    score: encodeScore('high_card', values),
    cards: [...cards],
  };
}

/**
 * Returns the best 5-card hand from 7 cards (player's 2 hole + 5 community).
 * Evaluates all C(7,5) = 21 sub-hands and returns the highest-scoring one.
 */
export function bestOfSeven(cards: readonly UthCard[]): HandScore {
  if (cards.length !== 7) {
    throw new RangeError('bestOfSeven requires exactly 7 cards');
  }
  let best: HandScore | null = null;
  // Generate all 5-card combinations from 7 cards.
  // 21 combinations — enumerate by skipping 2 cards.
  for (let skipA = 0; skipA < 7; skipA++) {
    for (let skipB = skipA + 1; skipB < 7; skipB++) {
      const sub: UthCard[] = [];
      for (let i = 0; i < 7; i++) {
        if (i !== skipA && i !== skipB) {
          const c = cards[i];
          /* v8 ignore next 1 -- defensive; loop bounds match cards length */
          if (c !== undefined) sub.push(c);
        }
      }
      const score = evaluateFive(sub);
      if (best === null || score.score > best.score) {
        best = score;
      }
    }
  }
  /* v8 ignore next 3 -- 7 cards always yield ≥ 1 5-card combo */
  if (best === null) {
    throw new Error('invariant: bestOfSeven produced no result');
  }
  return best;
}
