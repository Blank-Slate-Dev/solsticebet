// packages/rng/src/core.ts
//
// Core provably-fair derivation. Pure functions only.
// See docs/RNG.md § 2 for the full algorithm.
//
// This file is on the certification path. Every line is reviewed by
// the cert lab. No surprises, no cleverness, no shortcuts.
//
// We use @noble/hashes for HMAC-SHA256: it is isomorphic (same code in
// Node and the browser), audited, and widely used in crypto casino
// codebases. Output bytes match Node's `node:crypto` exactly. Verified
// against committed test vectors in tests/fixtures/vectors.ts.

import { hmac as nobleHmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { hexToBytes, utf8ToBytes } from './hex.js';
import {
  assertValidClientSeed,
  assertValidCursor,
  assertValidNonce,
  assertValidServerSeed,
} from './validate.js';

/**
 * Number of bytes in an HMAC-SHA256 output.
 */
const HMAC_BYTES = 32;

/**
 * Number of bytes consumed per derived float.
 * @see deriveFloat
 */
const BYTES_PER_FLOAT = 4;

/**
 * Number of floats produced from a single HMAC output.
 */
export const FLOATS_PER_HMAC = HMAC_BYTES / BYTES_PER_FLOAT;

/**
 * Computes HMAC-SHA256(serverSeed_bytes, "clientSeed:nonce:cursor").
 *
 * @param serverSeed 64-char lowercase hex string
 * @param clientSeed printable ASCII, 1–64 chars
 * @param nonce non-negative integer < MAX_NONCE
 * @param cursor non-negative integer
 * @returns 32-byte HMAC output as a Uint8Array
 */
export function hmac(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor: number,
): Uint8Array {
  assertValidServerSeed(serverSeed);
  assertValidClientSeed(clientSeed);
  assertValidNonce(nonce);
  assertValidCursor(cursor);

  const keyBytes = hexToBytes(serverSeed);
  const message = `${clientSeed}:${String(nonce)}:${String(cursor)}`;
  const messageBytes = utf8ToBytes(message);

  return nobleHmac(sha256, keyBytes, messageBytes);
}

/**
 * Converts 4 bytes of an HMAC output to a uniform float in [0, 1).
 *
 * Stake-style construction: sum of bytes weighted by descending powers of 256.
 * See docs/RNG.md § 2.3.
 *
 * @param hmacBytes the 32-byte HMAC output
 * @param chunkIndex 0..7, which 4-byte chunk to convert
 * @returns float in [0, 1)
 */
export function deriveFloat(hmacBytes: Uint8Array, chunkIndex: number): number {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= FLOATS_PER_HMAC) {
    throw new RangeError(`chunkIndex must be an integer in [0, ${String(FLOATS_PER_HMAC)})`);
  }
  if (hmacBytes.length !== HMAC_BYTES) {
    throw new RangeError(`hmacBytes must be exactly ${String(HMAC_BYTES)} bytes`);
  }

  const offset = chunkIndex * BYTES_PER_FLOAT;
  // Reading 4 separate bytes is the spec — do not switch to a 32-bit read.
  // The spec defines the float as a positional sum over 4 byte slots; that
  // formulation is what cert labs verify against.
  // The ?? 0 fallbacks satisfy noUncheckedIndexedAccess; they are unreachable
  // because the length check above guarantees hmacBytes is exactly 32 bytes
  // and chunkIndex is in [0, 8) so offset+3 is always < 32.
  /* v8 ignore next 4 -- defensive ?? 0; unreachable given bounds checks above */
  const b0 = hmacBytes[offset] ?? 0;
  const b1 = hmacBytes[offset + 1] ?? 0;
  const b2 = hmacBytes[offset + 2] ?? 0;
  const b3 = hmacBytes[offset + 3] ?? 0;

  return b0 / 0x100 + b1 / 0x10000 + b2 / 0x1000000 + b3 / 0x100000000;
}

/**
 * Generates a stream of `count` uniform floats in [0, 1) for the given inputs.
 * See docs/RNG.md § 2.4.
 */
export function deriveFloats(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  count: number,
): number[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError('count must be a positive integer');
  }

  const out: number[] = [];
  let cursor = 0;

  while (out.length < count) {
    const block = hmac(serverSeed, clientSeed, nonce, cursor);
    for (let i = 0; i < FLOATS_PER_HMAC && out.length < count; i++) {
      out.push(deriveFloat(block, i));
    }
    cursor += 1;
  }

  return out;
}
