// packages/rng/src/hex.ts
//
// Browser-compatible hex encoding/decoding utilities.
// Node's `Buffer.from(s, 'hex')` is not available in browsers;
// these utilities work in both Node 22 and browsers.

/**
 * Decodes a hex string to a Uint8Array.
 * Assumes the input is valid (caller should validate first).
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new RangeError('hex string must have even length');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new RangeError('hex string contains non-hex characters');
    }
    out[i] = byte;
  }
  return out;
}

/**
 * Encodes a Uint8Array as a lowercase hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * UTF-8 encodes a string to a Uint8Array.
 * `TextEncoder` is available in Node 11+ and all modern browsers.
 */
export function utf8ToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/**
 * Constant-time equality check on two Uint8Arrays.
 * Length-mismatched inputs return false in constant time over the longer side.
 */
export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (const [i, av] of a.entries()) {
    diff |= av ^ (b[i] ?? 0);
  }
  return diff === 0;
}
