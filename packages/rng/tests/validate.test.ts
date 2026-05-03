// packages/rng/tests/validate.test.ts

import { describe, expect, it } from 'vitest';

import {
  assertValidClientSeed,
  assertValidCursor,
  assertValidNonce,
  assertValidServerSeed,
  MAX_CLIENT_SEED_LENGTH,
  MAX_NONCE,
} from '../src/validate.js';

describe('assertValidServerSeed', () => {
  it('accepts a valid 64-char lowercase hex string', () => {
    expect(() => {
      assertValidServerSeed('a'.repeat(64));
    }).not.toThrow();
    expect(() => {
      assertValidServerSeed('0123456789abcdef'.repeat(4));
    }).not.toThrow();
  });

  it('rejects uppercase hex', () => {
    expect(() => {
      assertValidServerSeed('A'.repeat(64));
    }).toThrow(/64 lowercase hex/);
  });

  it('rejects too short', () => {
    expect(() => {
      assertValidServerSeed('a'.repeat(63));
    }).toThrow(/64 lowercase hex/);
  });

  it('rejects too long', () => {
    expect(() => {
      assertValidServerSeed('a'.repeat(65));
    }).toThrow(/64 lowercase hex/);
  });

  it('rejects non-hex chars', () => {
    expect(() => {
      assertValidServerSeed('z'.repeat(64));
    }).toThrow(/64 lowercase hex/);
  });

  it('rejects empty string', () => {
    expect(() => {
      assertValidServerSeed('');
    }).toThrow(/64 lowercase hex/);
  });

  it('rejects non-string', () => {
    // We deliberately pass through the type system to test the runtime guard.
    expect(() => {
      assertValidServerSeed(undefined as unknown as string);
    }).toThrow(/must be a string/);
    expect(() => {
      assertValidServerSeed(null as unknown as string);
    }).toThrow(/must be a string/);
    expect(() => {
      assertValidServerSeed(123 as unknown as string);
    }).toThrow(/must be a string/);
  });
});

describe('assertValidClientSeed', () => {
  it('accepts simple ASCII strings', () => {
    expect(() => {
      assertValidClientSeed('hello');
    }).not.toThrow();
    expect(() => {
      assertValidClientSeed('player-default-seed-2026');
    }).not.toThrow();
  });

  it('accepts the maximum length', () => {
    expect(() => {
      assertValidClientSeed('a'.repeat(MAX_CLIENT_SEED_LENGTH));
    }).not.toThrow();
  });

  it('rejects empty', () => {
    expect(() => {
      assertValidClientSeed('');
    }).toThrow(/must not be empty/);
  });

  it('rejects too long', () => {
    expect(() => {
      assertValidClientSeed('a'.repeat(MAX_CLIENT_SEED_LENGTH + 1));
    }).toThrow(/must not exceed/);
  });

  it('rejects non-printable ASCII', () => {
    expect(() => {
      assertValidClientSeed('hello\x00world');
    }).toThrow(/printable ASCII/);
    expect(() => {
      assertValidClientSeed('hello\nworld');
    }).toThrow(/printable ASCII/);
  });

  it('rejects non-ASCII', () => {
    expect(() => {
      assertValidClientSeed('café');
    }).toThrow(/printable ASCII/);
    expect(() => {
      assertValidClientSeed('🎲');
    }).toThrow(/printable ASCII/);
  });

  it('rejects non-string', () => {
    expect(() => {
      assertValidClientSeed(undefined as unknown as string);
    }).toThrow(/must be a string/);
  });
});

describe('assertValidNonce', () => {
  it('accepts zero', () => {
    expect(() => {
      assertValidNonce(0);
    }).not.toThrow();
  });

  it('accepts positive integers below MAX_NONCE', () => {
    expect(() => {
      assertValidNonce(1);
    }).not.toThrow();
    expect(() => {
      assertValidNonce(MAX_NONCE - 1);
    }).not.toThrow();
  });

  it('rejects negative', () => {
    expect(() => {
      assertValidNonce(-1);
    }).toThrow(/non-negative/);
  });

  it('rejects fractional', () => {
    expect(() => {
      assertValidNonce(1.5);
    }).toThrow(/integer/);
  });

  it('rejects MAX_NONCE itself (boundary)', () => {
    expect(() => {
      assertValidNonce(MAX_NONCE);
    }).toThrow(/MAX_NONCE/);
  });

  it('rejects above MAX_NONCE', () => {
    expect(() => {
      assertValidNonce(MAX_NONCE + 1);
    }).toThrow(/MAX_NONCE/);
  });

  it('rejects NaN, Infinity', () => {
    expect(() => {
      assertValidNonce(Number.NaN);
    }).toThrow();
    expect(() => {
      assertValidNonce(Number.POSITIVE_INFINITY);
    }).toThrow();
  });
});

describe('assertValidCursor', () => {
  it('accepts zero', () => {
    expect(() => {
      assertValidCursor(0);
    }).not.toThrow();
  });

  it('accepts large but reasonable values', () => {
    expect(() => {
      assertValidCursor(1000);
    }).not.toThrow();
  });

  it('rejects negative', () => {
    expect(() => {
      assertValidCursor(-1);
    }).toThrow(/non-negative/);
  });

  it('rejects fractional', () => {
    expect(() => {
      assertValidCursor(0.5);
    }).toThrow(/integer/);
  });

  it('rejects above sanity ceiling', () => {
    expect(() => {
      assertValidCursor(2_000_000);
    }).toThrow(/sanity/);
  });
});
