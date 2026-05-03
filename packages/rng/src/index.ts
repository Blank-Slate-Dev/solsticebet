// packages/rng/src/index.ts
//
// @solsticebet/rng — Provably-fair random number generator.
//
// ⚠️ RESTRICTED PACKAGE. See docs/ARCHITECTURE.md § 4.3.
// ⚠️ Specification: docs/RNG.md
//
// Public API surface:
//   - generateServerSeed, generateDefaultClientSeed
//   - hashServerSeed, verifyServerSeed
//   - hmac, deriveFloat, deriveFloats
//   - deriveDice, deriveMines, derivePlinko
//   - validation helpers and constants

export { hmac, deriveFloat, deriveFloats, FLOATS_PER_HMAC } from './core.js';

export {
  generateServerSeed,
  generateDefaultClientSeed,
  hashServerSeed,
  verifyServerSeed,
} from './seed.js';

export { deriveDice, deriveMines, derivePlinko, MINES_TILE_COUNT } from './games.js';

export type { DiceOutcome, MinesOutcome, PlinkoOutcome, PlinkoRowCount } from './games.js';

export {
  assertValidServerSeed,
  assertValidClientSeed,
  assertValidNonce,
  assertValidCursor,
  MAX_NONCE,
  MAX_CLIENT_SEED_LENGTH,
} from './validate.js';
