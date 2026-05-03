// packages/ledger/src/amount.ts
//
// Money math via bigint with implicit 18 decimal places.
// Never use JavaScript `number` for amounts. Float arithmetic on money is
// catastrophic — 0.1 + 0.2 = 0.30000000000000004, and casinos that learn this
// in production lose money on every bet.

import type { Currency } from './types.js';

/**
 * Implied decimal places for the bigint representation.
 * 18 matches Ethereum's wei precision; safe for any currency.
 */
export const SCALE = 18;

/**
 * 10^SCALE as a bigint, used for parsing/formatting.
 */
const SCALE_FACTOR = 10n ** BigInt(SCALE);

/**
 * Maximum representable amount. 38 total digits, 18 fractional, 20 integer.
 * In practice, casinos handle amounts well below this ceiling.
 */
export const MAX_AMOUNT_BIGINT = 10n ** 38n - 1n;

/**
 * Parses a decimal string ("123.456") into a scaled bigint.
 * Accepts any number of fractional digits up to SCALE; pads or rejects beyond.
 *
 * @throws on non-numeric input, on more than SCALE fractional digits, on overflow
 */
export function parseAmount(s: string): bigint {
  if (typeof s !== 'string') {
    throw new TypeError('amount string required');
  }
  const trimmed = s.trim();
  if (trimmed === '') {
    throw new RangeError('amount string must not be empty');
  }

  // Allow optional leading minus, integer part, optional fractional part.
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    throw new RangeError(`invalid amount: "${s}"`);
  }
  const sign = match[1] ?? '';
  const intPart = match[2] ?? '';
  const fracRaw = match[3] ?? '';

  if (fracRaw.length > SCALE) {
    throw new RangeError(`amount has more than ${String(SCALE)} fractional digits: "${s}"`);
  }

  const fracPadded = fracRaw.padEnd(SCALE, '0');
  const combined = `${sign}${intPart}${fracPadded}`;
  const result = BigInt(combined);

  if (result > MAX_AMOUNT_BIGINT || result < -MAX_AMOUNT_BIGINT) {
    throw new RangeError(`amount overflow: "${s}"`);
  }

  return result;
}

/**
 * Formats a scaled bigint back to its decimal string representation.
 * Trailing zeros after the decimal point are preserved up to SCALE.
 *
 * Use `formatAmountDisplay` for human-readable output.
 */
export function formatAmount(amount: bigint): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const asString = abs.toString().padStart(SCALE + 1, '0');
  const intPart = asString.slice(0, asString.length - SCALE);
  const fracPart = asString.slice(asString.length - SCALE);
  const sign = negative ? '-' : '';
  return `${sign}${intPart}.${fracPart}`;
}

/**
 * Formats an amount for human display: trims trailing zeros, optionally
 * limits to a max number of fractional digits.
 *
 * @param amount scaled bigint
 * @param maxFractionDigits max digits after the decimal point (default 8 — safe for crypto)
 */
export function formatAmountDisplay(amount: bigint, maxFractionDigits = 8): string {
  if (!Number.isInteger(maxFractionDigits) || maxFractionDigits < 0) {
    throw new RangeError('maxFractionDigits must be a non-negative integer');
  }
  if (maxFractionDigits > SCALE) {
    throw new RangeError(`maxFractionDigits must be <= ${String(SCALE)}`);
  }

  const full = formatAmount(amount);
  const dotIdx = full.indexOf('.');
  /* v8 ignore next 1 -- formatAmount always emits a decimal point */
  if (dotIdx < 0) return full;

  const intPart = full.slice(0, dotIdx);
  const fracFull = full.slice(dotIdx + 1);
  let frac = fracFull.slice(0, maxFractionDigits);
  // Strip trailing zeros
  while (frac.endsWith('0')) {
    frac = frac.slice(0, -1);
  }
  return frac.length > 0 ? `${intPart}.${frac}` : intPart;
}

/**
 * Asserts an amount is strictly positive. Used at API boundaries where
 * inputs must be amounts users meant to deposit/withdraw/bet.
 *
 * @throws if amount <= 0
 */
export function assertPositive(amount: bigint): void {
  if (amount <= 0n) {
    throw new RangeError(`amount must be positive: got ${amount.toString()}`);
  }
}

/**
 * Asserts an amount is non-negative.
 *
 * @throws if amount < 0
 */
export function assertNonNegative(amount: bigint): void {
  if (amount < 0n) {
    throw new RangeError(`amount must be non-negative: got ${amount.toString()}`);
  }
}

/**
 * Tagged value pairing an amount with its currency.
 * Use this in business-logic code to prevent currency mix-ups at the type level.
 */
export interface Money {
  readonly amount: bigint;
  readonly currency: Currency;
}

export function money(amount: bigint, currency: Currency): Money {
  return { amount, currency };
}

/** SCALE_FACTOR exported for advanced callers that need to compose math. */
export { SCALE_FACTOR };
