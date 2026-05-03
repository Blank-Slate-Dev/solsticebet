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

export { bytesToHex, hexToBytes, timingSafeEqualBytes, utf8ToBytes } from './hex.js';

export {
  generateServerSeed,
  generateDefaultClientSeed,
  hashServerSeed,
  verifyServerSeed,
} from './seed.js';

export {
  BACCARAT_MAX_CARDS,
  BACCARAT_RANKS,
  BLACKJACK_MAX_CARDS,
  BLACKJACK_RANKS,
  CRASH_MAX_MULTIPLIER,
  HILO_RANKS,
  KENO_DRAW,
  KENO_TOTAL,
  LIMBO_MAX_MULTIPLIER,
  deriveBaccarat,
  deriveBlackjack,
  deriveCoinFlip,
  deriveCrash,
  deriveDice,
  deriveHiLoCard,
  deriveKeno,
  deriveLimbo,
  deriveMines,
  derivePlinko,
  deriveRoulette,
  deriveSicBo,
  deriveUth,
  deriveWheel,
  MINES_TILE_COUNT,
  ROULETTE_POCKETS,
  SICBO_DICE,
  SICBO_FACES,
  UTH_CARDS,
} from './games.js';

export type {
  BaccaratOutcome,
  BlackjackOutcome,
  CoinFlipOutcome,
  CrashOutcome,
  DiceOutcome,
  HiLoCardOutcome,
  KenoOutcome,
  LimboOutcome,
  MinesOutcome,
  PlinkoOutcome,
  PlinkoRowCount,
  RouletteOutcome,
  SicBoOutcome,
  UthCard,
  UthOutcome,
  WheelOutcome,
} from './games.js';

export {
  assertValidServerSeed,
  assertValidClientSeed,
  assertValidNonce,
  assertValidCursor,
  MAX_NONCE,
  MAX_CLIENT_SEED_LENGTH,
} from './validate.js';
