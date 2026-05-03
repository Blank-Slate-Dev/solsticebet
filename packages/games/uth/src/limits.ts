// packages/games/uth/src/limits.ts
//
// UTH bet limits and validation.
// See docs/UTH.md § 4.

import { parseAmount } from '@solsticebet/ledger';

import type { StartUthCoupInput } from './types.js';

export class UthValidationError extends Error {
  override readonly name: string = 'UthValidationError';
}

/** Minimum Ante (= minimum Blind, since Blind = Ante in UTH). */
export const MIN_ANTE: bigint = parseAmount('0.10');

/** Maximum Ante. */
export const MAX_ANTE: bigint = parseAmount('100');

/** Minimum optional Trips bet (0 means no trips bet placed). */
export const MIN_TRIPS: bigint = parseAmount('0.10');

/** Maximum Trips. */
export const MAX_TRIPS: bigint = parseAmount('100');

/** Maximum total committed across the coup. */
export const MAX_COUP_STAKE: bigint = parseAmount('700');

/** Maximum payout per coup (defence in depth). */
export const MAX_COUP_PAYOUT: bigint = parseAmount('60000');

export function assertValidAnte(ante: bigint): void {
  if (typeof ante !== 'bigint') {
    throw new UthValidationError('ante must be a bigint');
  }
  if (ante < MIN_ANTE) {
    throw new UthValidationError('ante is below minimum');
  }
  if (ante > MAX_ANTE) {
    throw new UthValidationError('ante exceeds maximum');
  }
}

export function assertValidTrips(trips: bigint): void {
  if (typeof trips !== 'bigint') {
    throw new UthValidationError('trips must be a bigint');
  }
  if (trips === 0n) return; // Trips is optional; 0 means none
  if (trips < MIN_TRIPS) {
    throw new UthValidationError('trips is below minimum');
  }
  if (trips > MAX_TRIPS) {
    throw new UthValidationError('trips exceeds maximum');
  }
}

export function assertValidStartInput(input: StartUthCoupInput): void {
  if (typeof input.coupId !== 'string' || input.coupId.length === 0) {
    throw new UthValidationError('coupId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new UthValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new UthValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new UthValidationError('houseAccountId must be a non-empty string');
  }
  if (input.currency !== 'INTERNAL_USDT') {
    throw new UthValidationError(`uth coups must be in INTERNAL_USDT, got ${input.currency}`);
  }
  assertValidAnte(input.ante);
  assertValidTrips(input.trips);
}
