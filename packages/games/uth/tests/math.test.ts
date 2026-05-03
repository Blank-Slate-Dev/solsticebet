// packages/games/uth/tests/math.test.ts

import { describe, expect, it } from 'vitest';

import { BLIND_PAYTABLE, computePayout, TRIPS_PAYTABLE } from '../src/math.js';

describe('BLIND_PAYTABLE', () => {
  it('matches the published table', () => {
    expect(BLIND_PAYTABLE.royal_flush).toBe(500);
    expect(BLIND_PAYTABLE.straight_flush).toBe(50);
    expect(BLIND_PAYTABLE.four_kind).toBe(10);
    expect(BLIND_PAYTABLE.full_house).toBe(3);
    expect(BLIND_PAYTABLE.flush).toBe(1.5);
    expect(BLIND_PAYTABLE.straight).toBe(1);
    expect(BLIND_PAYTABLE.three_kind).toBe(1);
    expect(BLIND_PAYTABLE.two_pair).toBe(1);
    expect(BLIND_PAYTABLE.pair).toBe(1);
    expect(BLIND_PAYTABLE.high_card).toBe(1);
  });
});

describe('TRIPS_PAYTABLE', () => {
  it('matches the published table', () => {
    expect(TRIPS_PAYTABLE.royal_flush).toBe(50);
    expect(TRIPS_PAYTABLE.straight_flush).toBe(40);
    expect(TRIPS_PAYTABLE.four_kind).toBe(30);
    expect(TRIPS_PAYTABLE.full_house).toBe(8);
    expect(TRIPS_PAYTABLE.flush).toBe(7);
    expect(TRIPS_PAYTABLE.straight).toBe(4);
    expect(TRIPS_PAYTABLE.three_kind).toBe(3);
    expect(TRIPS_PAYTABLE.two_pair).toBe(0);
    expect(TRIPS_PAYTABLE.pair).toBe(0);
    expect(TRIPS_PAYTABLE.high_card).toBe(0);
  });
});

describe('computePayout', () => {
  const ONE = 10n ** 18n;

  it('1 stake @ 1:1 = 2', () => {
    expect(computePayout(ONE, 1)).toBe(2n * ONE);
  });

  it('1 stake @ 50:1 = 51', () => {
    expect(computePayout(ONE, 50)).toBe(51n * ONE);
  });

  it('1 stake @ 1.5:1 = 2.5', () => {
    expect(computePayout(ONE, 1.5)).toBe(2500000000000000000n);
  });

  it('1 stake @ 500:1 (royal blind) = 501', () => {
    expect(computePayout(ONE, 500)).toBe(501n * ONE);
  });

  it('rejects non-positive stake', () => {
    expect(() => computePayout(0n, 1)).toThrow();
    expect(() => computePayout(-1n, 1)).toThrow();
  });
  it('rejects negative or non-finite multiplier', () => {
    expect(() => computePayout(ONE, -1)).toThrow();
    expect(() => computePayout(ONE, Number.NaN)).toThrow();
  });
});
