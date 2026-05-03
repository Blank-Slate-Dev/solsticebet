// packages/rng/src/seed.ts
//
// Server seed lifecycle utilities: generation, hashing, validation.
// See docs/RNG.md § 4 for the full lifecycle.
//
// Isomorphic: works in Node 22+ and modern browsers via the Web Crypto API
// (`globalThis.crypto`) and @noble/hashes.

import { sha256 } from '@noble/hashes/sha2.js';

import { bytesToHex, hexToBytes, timingSafeEqualBytes } from './hex.js';
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
 * Generates `n` cryptographically-random bytes via the Web Crypto API.
 * `globalThis.crypto.getRandomValues` is available in Node 19+ and all modern browsers.
 */
function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/**
 * Generates a fresh server seed using the OS CSPRNG.
 *
 * Returns a 64-character lowercase hex string representing 32 random bytes.
 *
 * @returns 64-char lowercase hex string
 */
export function generateServerSeed(): string {
  return bytesToHex(randomBytes(SERVER_SEED_BYTES));
}

/**
 * Generates a default client seed for a new account.
 * 16-character hex string. Users can replace it at any time.
 *
 * @returns 16-char lowercase hex string
 */
export function generateDefaultClientSeed(): string {
  return bytesToHex(randomBytes(DEFAULT_CLIENT_SEED_BYTES));
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
  const seedBytes = hexToBytes(serverSeed);
  return bytesToHex(sha256(seedBytes));
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

  const computed = hexToBytes(hashServerSeed(serverSeed));
  let expected: Uint8Array;
  try {
    expected = hexToBytes(expectedHash);
  } catch {
    return false;
  }

  return timingSafeEqualBytes(computed, expected);
}
