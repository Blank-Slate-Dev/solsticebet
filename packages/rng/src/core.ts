// packages/rng/src/core.ts
//
// Core provably-fair derivation. Pure functions only.
// See docs/RNG.md § 2 for the full algorithm.
//
// This file is on the certification path. Every line is reviewed by
// the cert lab. No surprises, no cleverness, no shortcuts.

import { createHmac } from 'node:crypto';
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
 * @returns 32-byte HMAC output as a Buffer
 */
export function hmac(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor: number,
): Buffer {
  assertValidServerSeed(serverSeed);
  assertValidClientSeed(clientSeed);
  assertValidNonce(nonce);
  assertValidCursor(cursor);

  const keyBytes = Buffer.from(serverSeed, 'hex');
  const message = `${clientSeed}:${String(nonce)}:${String(cursor)}`;

  return createHmac('sha256', keyBytes).update(message, 'utf8').digest();
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
export function deriveFloat(hmacBytes: Buffer, chunkIndex: number): number {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= FLOATS_PER_HMAC) {
    throw new RangeError(`chunkIndex must be an integer in [0, ${String(FLOATS_PER_HMAC)})`);
  }
  if (hmacBytes.length !== HMAC_BYTES) {
    throw new RangeError(`hmacBytes must be exactly ${String(HMAC_BYTES)} bytes`);
  }

  const offset = chunkIndex * BYTES_PER_FLOAT;
  // Reading 4 separate bytes is the spec — do not switch to readUInt32BE.
  // The spec defines the float as a positional sum over 4 byte slots; that
  // formulation is what cert labs verify against and what player-side
  // verification implementations replicate.
  // We use readUInt8 (which throws on out-of-bounds) rather than indexed
  // access (which returns `number | undefined`) for a clean, type-safe path.
  const b0 = hmacBytes.readUInt8(offset);
  const b1 = hmacBytes.readUInt8(offset + 1);
  const b2 = hmacBytes.readUInt8(offset + 2);
  const b3 = hmacBytes.readUInt8(offset + 3);

  return b0 / 0x100 + b1 / 0x10000 + b2 / 0x1000000 + b3 / 0x100000000;
}

/**
 * Generates a stream of `count` uniform floats in [0, 1) for the given inputs.
 * Internally calls `hmac` repeatedly with incrementing cursor when more than
 * 8 floats are needed. See docs/RNG.md § 2.4.
 *
 * @param serverSeed 64-char lowercase hex string
 * @param clientSeed printable ASCII, 1–64 chars
 * @param nonce non-negative integer < MAX_NONCE
 * @param count number of floats to produce; must be > 0
 * @returns an array of `count` floats, each in [0, 1)
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
