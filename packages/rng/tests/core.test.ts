// packages/rng/tests/core.test.ts

import { describe, expect, it } from 'vitest';

import { deriveFloat, deriveFloats, FLOATS_PER_HMAC, hmac } from '../src/core.js';
import { bytesToHex, hexToBytes } from '../src/hex.js';
import { vectors } from './fixtures/vectors.js';

describe('hmac', () => {
  it('produces 32-byte buffers', () => {
    const out = hmac('0'.repeat(64), 'a', 0, 0);
    expect(out).toHaveLength(32);
  });

  it('matches every committed test vector', () => {
    for (const v of vectors) {
      const out = hmac(v.serverSeed, v.clientSeed, v.nonce, v.cursor);
      expect(bytesToHex(out)).toBe(v.hmacHex);
    }
  });

  it('is deterministic', () => {
    const a = hmac('0'.repeat(64), 'x', 1, 0);
    const b = hmac('0'.repeat(64), 'x', 1, 0);
    expect(bytesToHex(a)).toBe(bytesToHex(b));
  });

  it('changes when any input changes', () => {
    const base = bytesToHex(hmac('0'.repeat(64), 'x', 0, 0));
    expect(bytesToHex(hmac('1' + '0'.repeat(63), 'x', 0, 0))).not.toBe(base);
    expect(bytesToHex(hmac('0'.repeat(64), 'y', 0, 0))).not.toBe(base);
    expect(bytesToHex(hmac('0'.repeat(64), 'x', 1, 0))).not.toBe(base);
    expect(bytesToHex(hmac('0'.repeat(64), 'x', 0, 1))).not.toBe(base);
  });
});

describe('deriveFloat', () => {
  it('matches the vector floats for all committed vectors', () => {
    for (const v of vectors) {
      const buf = hexToBytes(v.hmacHex);
      for (let i = 0; i < FLOATS_PER_HMAC; i++) {
        expect(deriveFloat(buf, i)).toBe(v.floats[i]);
      }
    }
  });

  it('produces values in [0, 1)', () => {
    for (const v of vectors) {
      const buf = hexToBytes(v.hmacHex);
      for (let i = 0; i < FLOATS_PER_HMAC; i++) {
        const f = deriveFloat(buf, i);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(1);
      }
    }
  });

  it('rejects out-of-range chunkIndex', () => {
    const buf = new Uint8Array(32);
    expect(() => deriveFloat(buf, -1)).toThrow();
    expect(() => deriveFloat(buf, FLOATS_PER_HMAC)).toThrow();
    expect(() => deriveFloat(buf, 1.5)).toThrow();
  });

  it('rejects wrong-length buffers', () => {
    expect(() => deriveFloat(new Uint8Array(31), 0)).toThrow();
    expect(() => deriveFloat(new Uint8Array(33), 0)).toThrow();
  });

  it('returns 0 for an all-zero hmac', () => {
    expect(deriveFloat(new Uint8Array(32), 0)).toBe(0);
  });

  it('returns close-to-1 for an all-0xFF hmac', () => {
    const buf = new Uint8Array(32).fill(0xff);
    const f = deriveFloat(buf, 0);
    expect(f).toBeLessThan(1);
    expect(f).toBeGreaterThan(0.999);
  });
});

describe('deriveFloats', () => {
  it('returns the requested count', () => {
    expect(deriveFloats('0'.repeat(64), 'a', 0, 1)).toHaveLength(1);
    expect(deriveFloats('0'.repeat(64), 'a', 0, 8)).toHaveLength(8);
    expect(deriveFloats('0'.repeat(64), 'a', 0, 24)).toHaveLength(24);
    expect(deriveFloats('0'.repeat(64), 'a', 0, 100)).toHaveLength(100);
  });

  it('is deterministic', () => {
    const a = deriveFloats('0'.repeat(64), 'x', 5, 50);
    const b = deriveFloats('0'.repeat(64), 'x', 5, 50);
    expect(a).toEqual(b);
  });

  it('first 8 floats match the cursor=0 vector', () => {
    for (const v of vectors) {
      if (v.cursor !== 0) continue;
      const got = deriveFloats(v.serverSeed, v.clientSeed, v.nonce, 8);
      expect(got).toEqual([...v.floats]);
    }
  });

  it('floats 9-16 match the cursor=1 result for nonce 0, default seed', () => {
    // Cross-check: deriveFloats(count=16) at nonce=0, the second 8 floats
    // must match what hmac(... cursor=1) yields.
    const all = deriveFloats(
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      'default',
      0,
      16,
    );
    // Find the cursor=1 vector
    const v1 = vectors.find(
      (v) =>
        v.serverSeed === '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' &&
        v.clientSeed === 'default' &&
        v.nonce === 0 &&
        v.cursor === 1,
    );
    expect(v1).toBeDefined();
    if (v1 === undefined) throw new Error('unreachable');
    expect(all.slice(8, 16)).toEqual([...v1.floats]);
  });

  it('rejects non-positive count', () => {
    expect(() => deriveFloats('0'.repeat(64), 'a', 0, 0)).toThrow();
    expect(() => deriveFloats('0'.repeat(64), 'a', 0, -1)).toThrow();
    expect(() => deriveFloats('0'.repeat(64), 'a', 0, 1.5)).toThrow();
  });

  it('all floats are in [0, 1)', () => {
    const xs = deriveFloats('0'.repeat(64), 'broad-test', 0, 1000);
    for (const f of xs) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });
});
