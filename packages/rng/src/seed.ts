// packages/rng/src/seed.ts
//
// Server seed lifecycle utilities: generation, hashing, validation.
// See docs/RNG.md § 4 for the full lifecycle.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { assertValidServerSeed } from './validate.js';

/**
 * Number of bytes in a server seed before hex encoding.
 */
const SERVER_SEED_BYTES = 32;

/**
 * Number of bytes in a default client seed before hex encoding.
 */
const DEFAULT_CLIENT_SEED_BYTES = 8;

/**
 * Generates a fresh server seed using the OS CSPRNG.
 *
 * Returns a 64-character lowercase hex string representing 32 random bytes.
 * Never use Math.random for this. Cert lab will fail you.
 *
 * @returns 64-char lowercase hex string
 */
export function generateServerSeed(): string {
  return randomBytes(SERVER_SEED_BYTES).toString('hex');
}

/**
 * Generates a default client seed for a new account.
 * 16-character hex string. Users can replace it at any time.
 *
 * @returns 16-char lowercase hex string
 */
export function generateDefaultClientSeed(): string {
  return randomBytes(DEFAULT_CLIENT_SEED_BYTES).toString('hex');
}

/**
 * Computes the SHA-256 hash of a server seed.
 * This is the hash we publish before the seed is ever used.
 *
 * @param serverSeed 64-char lowercase hex string
 * @returns 64-char lowercase hex string of the SHA-256 digest
 */
export function hashServerSeed(serverSeed: string): string {
  assertValidServerSeed(serverSeed);
  const seedBytes = Buffer.from(serverSeed, 'hex');
  return createHash('sha256').update(seedBytes).digest('hex');
}

/**
 * Constant-time check that a revealed seed matches a previously-published hash.
 * Use this whenever verifying a reveal to defend against timing attacks.
 *
 * @param serverSeed 64-char lowercase hex string
 * @param expectedHash 64-char lowercase hex string of the previously-published SHA-256
 * @returns true iff SHA-256(serverSeed) === expectedHash, in constant time
 */
export function verifyServerSeed(serverSeed: string, expectedHash: string): boolean {
  assertValidServerSeed(serverSeed);

  if (typeof expectedHash !== 'string' || expectedHash.length !== 64) {
    return false;
  }

  const computed = Buffer.from(hashServerSeed(serverSeed), 'hex');
  // Buffer.from(s, 'hex') doesn't throw on malformed input — it silently
  // truncates at the first invalid character. We rely on the regex check
  // above to ensure expectedHash is exactly 64 hex chars; the length
  // comparison below is the final guard.
  const expected = Buffer.from(expectedHash, 'hex');

  if (computed.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(computed, expected);
}
