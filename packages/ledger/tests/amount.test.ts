// packages/ledger/tests/amount.test.ts

import { describe, expect, it } from 'vitest';

import {
  assertNonNegative,
  assertPositive,
  formatAmount,
  formatAmountDisplay,
  MAX_AMOUNT_BIGINT,
  money,
  parseAmount,
  SCALE,
  SCALE_FACTOR,
} from '../src/amount.js';

describe('parseAmount', () => {
  it('parses integer values', () => {
    expect(parseAmount('0')).toBe(0n);
    expect(parseAmount('1')).toBe(SCALE_FACTOR);
    expect(parseAmount('100')).toBe(100n * SCALE_FACTOR);
  });

  it('parses decimal values up to SCALE digits', () => {
    expect(parseAmount('0.5')).toBe(SCALE_FACTOR / 2n);
    expect(parseAmount('0.1')).toBe(SCALE_FACTOR / 10n);
    expect(parseAmount('1.234567890123456789')).toBe(1234567890123456789n);
  });

  it('parses negative values', () => {
    expect(parseAmount('-1')).toBe(-SCALE_FACTOR);
    expect(parseAmount('-0.5')).toBe(-SCALE_FACTOR / 2n);
  });

  it('handles whitespace via trim', () => {
    expect(parseAmount('  1.5  ')).toBe(SCALE_FACTOR + SCALE_FACTOR / 2n);
  });

  it('rejects empty string', () => {
    expect(() => parseAmount('')).toThrow(/empty/);
    expect(() => parseAmount('   ')).toThrow(/empty/);
  });

  it('rejects non-numeric strings', () => {
    expect(() => parseAmount('abc')).toThrow(/invalid amount/);
    expect(() => parseAmount('1.2.3')).toThrow(/invalid amount/);
    expect(() => parseAmount('1e5')).toThrow(/invalid amount/);
    expect(() => parseAmount('+1')).toThrow(/invalid amount/);
  });

  it('rejects more than SCALE fractional digits', () => {
    const too_many = `0.${'1'.repeat(SCALE + 1)}`;
    expect(() => parseAmount(too_many)).toThrow(/fractional digits/);
  });

  it('rejects non-string input', () => {
    expect(() => parseAmount(undefined as unknown as string)).toThrow(/amount string required/);
    expect(() => parseAmount(123 as unknown as string)).toThrow(/amount string required/);
  });

  it('rejects overflow', () => {
    // 10^20 has 21 digits in integer part; combined with SCALE=18 fractional zeros
    // would be 39 digits and exceed MAX_AMOUNT_BIGINT (38-digit max).
    expect(() => parseAmount('100000000000000000000')).toThrow(/overflow/);
    expect(() => parseAmount('-100000000000000000000')).toThrow(/overflow/);
  });
});

describe('formatAmount', () => {
  it('round-trips through parseAmount', () => {
    const samples = [
      '0.000000000000000000',
      '1.000000000000000000',
      '0.500000000000000000',
      '-1.234567890123456789',
    ];
    for (const s of samples) {
      expect(formatAmount(parseAmount(s))).toBe(s);
    }
  });

  it('formats zero', () => {
    expect(formatAmount(0n)).toBe('0.000000000000000000');
  });

  it('formats negative values with leading minus', () => {
    expect(formatAmount(-SCALE_FACTOR)).toBe('-1.000000000000000000');
  });

  it('preserves all SCALE fractional digits', () => {
    const out = formatAmount(SCALE_FACTOR / 10n);
    expect(out).toBe('0.100000000000000000');
    expect(out.split('.')[1]).toHaveLength(SCALE);
  });
});

describe('formatAmountDisplay', () => {
  it('strips trailing zeros', () => {
    expect(formatAmountDisplay(parseAmount('1.5'))).toBe('1.5');
    expect(formatAmountDisplay(parseAmount('100'))).toBe('100');
    expect(formatAmountDisplay(parseAmount('0.10'))).toBe('0.1');
  });

  it('respects maxFractionDigits', () => {
    expect(formatAmountDisplay(parseAmount('1.123456789'), 4)).toBe('1.1234');
    expect(formatAmountDisplay(parseAmount('1.10000'), 8)).toBe('1.1');
  });

  it('handles zero', () => {
    expect(formatAmountDisplay(0n)).toBe('0');
  });

  it('handles negative', () => {
    expect(formatAmountDisplay(parseAmount('-1.5'))).toBe('-1.5');
  });

  it('rejects invalid maxFractionDigits', () => {
    expect(() => formatAmountDisplay(0n, -1)).toThrow();
    expect(() => formatAmountDisplay(0n, 1.5)).toThrow();
    expect(() => formatAmountDisplay(0n, SCALE + 1)).toThrow();
  });
});

describe('assertPositive / assertNonNegative', () => {
  it('assertPositive accepts positive', () => {
    expect(() => {
      assertPositive(1n);
    }).not.toThrow();
  });

  it('assertPositive rejects zero and negative', () => {
    expect(() => {
      assertPositive(0n);
    }).toThrow(/positive/);
    expect(() => {
      assertPositive(-1n);
    }).toThrow(/positive/);
  });

  it('assertNonNegative accepts zero and positive', () => {
    expect(() => {
      assertNonNegative(0n);
    }).not.toThrow();
    expect(() => {
      assertNonNegative(1n);
    }).not.toThrow();
  });

  it('assertNonNegative rejects negative', () => {
    expect(() => {
      assertNonNegative(-1n);
    }).toThrow(/non-negative/);
  });
});

describe('money', () => {
  it('produces a tagged amount', () => {
    const m = money(parseAmount('5'), 'INTERNAL_USDT');
    expect(m.amount).toBe(parseAmount('5'));
    expect(m.currency).toBe('INTERNAL_USDT');
  });
});

describe('MAX_AMOUNT_BIGINT', () => {
  it('is the documented 38-digit ceiling minus one', () => {
    expect(MAX_AMOUNT_BIGINT).toBe(10n ** 38n - 1n);
  });
});
