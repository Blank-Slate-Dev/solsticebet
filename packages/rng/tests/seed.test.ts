// packages/rng/tests/seed.test.ts

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  generateDefaultClientSeed,
  generateServerSeed,
  hashServerSeed,
  verifyServerSeed,
} from '../src/seed.js';

describe('generateServerSeed', () => {
  it('returns a 64-char lowercase hex string', () => {
    const s = generateServerSeed();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces unique values on repeated calls', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      set.add(generateServerSeed());
    }
    expect(set.size).toBe(1000);
  });
});

describe('generateDefaultClientSeed', () => {
  it('returns a 16-char lowercase hex string', () => {
    const s = generateDefaultClientSeed();
    expect(s).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces unique values on repeated calls', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      set.add(generateDefaultClientSeed());
    }
    expect(set.size).toBe(1000);
  });
});

describe('hashServerSeed', () => {
  it('matches a manually-computed SHA-256 of the seed bytes', () => {
    const seed = '0123456789abcdef'.repeat(4);
    const seedBytes = Buffer.from(seed, 'hex');
    const expected = createHash('sha256').update(seedBytes).digest('hex');
    expect(hashServerSeed(seed)).toBe(expected);
  });

  it('returns a 64-char lowercase hex string', () => {
    const h = hashServerSeed('0'.repeat(64));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const seed = generateServerSeed();
    expect(hashServerSeed(seed)).toBe(hashServerSeed(seed));
  });

  it('rejects invalid seeds', () => {
    expect(() => hashServerSeed('xyz')).toThrow();
    expect(() => hashServerSeed('A'.repeat(64))).toThrow();
  });
});

describe('verifyServerSeed', () => {
  it('returns true for a matching seed/hash pair', () => {
    const seed = generateServerSeed();
    const hash = hashServerSeed(seed);
    expect(verifyServerSeed(seed, hash)).toBe(true);
  });

  it('returns false when the hash does not match the seed', () => {
    const seed = generateServerSeed();
    const wrongHash = hashServerSeed(generateServerSeed());
    expect(verifyServerSeed(seed, wrongHash)).toBe(false);
  });

  it('returns false for malformed expectedHash', () => {
    const seed = generateServerSeed();
    expect(verifyServerSeed(seed, '')).toBe(false);
    expect(verifyServerSeed(seed, 'short')).toBe(false);
    expect(verifyServerSeed(seed, 'z'.repeat(64))).toBe(false);
    expect(verifyServerSeed(seed, undefined as unknown as string)).toBe(false);
  });

  it('throws on invalid serverSeed (input contract)', () => {
    expect(() => verifyServerSeed('bad', 'a'.repeat(64))).toThrow();
  });
});
