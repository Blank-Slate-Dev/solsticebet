// packages/rng/src/validate.ts
//
// Input validation for the provably-fair RNG.
// Throws on any invalid input — never silently coerces.
// See docs/RNG.md § 2.1 for input constraints.

const HEX_64_REGEX = /^[0-9a-f]{64}$/;
const ASCII_PRINTABLE_REGEX = /^[\x20-\x7E]+$/;

/**
 * The maximum nonce value we will accept. Beyond this, the seed must rotate.
 * See docs/RNG.md § 4.4 and § 8.
 */
export const MAX_NONCE = 1_000_000;

/**
 * Maximum length of a client seed in characters. Stake-style limit.
 */
export const MAX_CLIENT_SEED_LENGTH = 64;

/**
 * Asserts a server seed is exactly 64 lowercase hex characters.
 * Server seeds are produced by `generateServerSeed()` and always satisfy this.
 *
 * @throws if seed is not a 64-char lowercase hex string
 */
export function assertValidServerSeed(seed: string): void {
  if (typeof seed !== 'string') {
    throw new TypeError('serverSeed must be a string');
  }
  if (!HEX_64_REGEX.test(seed)) {
    throw new RangeError('serverSeed must be exactly 64 lowercase hex characters (32 bytes)');
  }
}

/**
 * Asserts a client seed is a non-empty ASCII string within the length limit.
 * The RNG itself accepts any non-empty string; the API layer should impose
 * stricter rules (e.g., disallowing whitespace) before calling.
 *
 * @throws if seed is empty, too long, or contains non-ASCII characters
 */
export function assertValidClientSeed(seed: string): void {
  if (typeof seed !== 'string') {
    throw new TypeError('clientSeed must be a string');
  }
  if (seed.length === 0) {
    throw new RangeError('clientSeed must not be empty');
  }
  if (seed.length > MAX_CLIENT_SEED_LENGTH) {
    throw new RangeError(`clientSeed must not exceed ${String(MAX_CLIENT_SEED_LENGTH)} characters`);
  }
  if (!ASCII_PRINTABLE_REGEX.test(seed)) {
    throw new RangeError('clientSeed must contain only printable ASCII characters (0x20–0x7E)');
  }
}

/**
 * Asserts a nonce is a non-negative integer below MAX_NONCE.
 *
 * @throws if nonce is not a safe non-negative integer below MAX_NONCE
 */
export function assertValidNonce(nonce: number): void {
  if (!Number.isInteger(nonce)) {
    throw new TypeError('nonce must be an integer');
  }
  if (nonce < 0) {
    throw new RangeError('nonce must be non-negative');
  }
  if (nonce >= MAX_NONCE) {
    throw new RangeError(
      `nonce must be less than MAX_NONCE (${String(MAX_NONCE)}); rotate the server seed`,
    );
  }
}

/**
 * Asserts a cursor is a non-negative integer.
 * Cursor has no enforced ceiling at this layer; game logic decides how many
 * floats it needs and therefore how high cursor goes.
 *
 * @throws if cursor is not a safe non-negative integer
 */
export function assertValidCursor(cursor: number): void {
  if (!Number.isInteger(cursor)) {
    throw new TypeError('cursor must be an integer');
  }
  if (cursor < 0) {
    throw new RangeError('cursor must be non-negative');
  }
  // Sanity ceiling: a cursor above 1e6 is a bug, not legitimate gameplay.
  if (cursor > 1_000_000) {
    throw new RangeError('cursor exceeds sanity limit; check caller logic');
  }
}
