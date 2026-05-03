// packages/rng/tests/hex.test.ts

import { describe, expect, it } from 'vitest';

import { bytesToHex, hexToBytes, timingSafeEqualBytes, utf8ToBytes } from '../src/hex.js';

describe('hexToBytes', () => {
  it('decodes empty string to empty array', () => {
    expect(hexToBytes('').length).toBe(0);
  });

  it('decodes single byte', () => {
    expect(Array.from(hexToBytes('00'))).toEqual([0]);
    expect(Array.from(hexToBytes('ff'))).toEqual([255]);
    expect(Array.from(hexToBytes('a5'))).toEqual([0xa5]);
  });

  it('decodes 32-byte server seed', () => {
    const seed = '0123456789abcdef'.repeat(4);
    const bytes = hexToBytes(seed);
    expect(bytes.length).toBe(32);
    expect(bytes[0]).toBe(0x01);
    expect(bytes[1]).toBe(0x23);
  });

  it('rejects odd-length hex string', () => {
    expect(() => hexToBytes('abc')).toThrow(/even length/);
    expect(() => hexToBytes('a')).toThrow(/even length/);
  });

  it('rejects non-hex characters', () => {
    expect(() => hexToBytes('zz')).toThrow(/non-hex/);
    expect(() => hexToBytes('00gh')).toThrow(/non-hex/);
  });
});

describe('bytesToHex', () => {
  it('round-trips through hexToBytes', () => {
    const samples = ['', '00', 'ff', 'deadbeef', '0123456789abcdef'.repeat(4)];
    for (const s of samples) {
      expect(bytesToHex(hexToBytes(s))).toBe(s);
    }
  });

  it('produces lowercase output', () => {
    expect(bytesToHex(new Uint8Array([0xab, 0xcd]))).toBe('abcd');
  });

  it('pads single-digit bytes with leading zero', () => {
    expect(bytesToHex(new Uint8Array([0x0a, 0x0b]))).toBe('0a0b');
  });
});

describe('utf8ToBytes', () => {
  it('encodes ASCII verbatim', () => {
    const bytes = utf8ToBytes('hello');
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111]);
  });

  it('encodes multi-byte UTF-8', () => {
    // "é" is 2 bytes in UTF-8 (0xc3, 0xa9)
    const bytes = utf8ToBytes('é');
    expect(bytes.length).toBe(2);
    expect(bytes[0]).toBe(0xc3);
    expect(bytes[1]).toBe(0xa9);
  });
});

describe('timingSafeEqualBytes', () => {
  it('returns true for equal arrays', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(timingSafeEqualBytes(a, b)).toBe(true);
  });

  it('returns false for different content', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 5]);
    expect(timingSafeEqualBytes(a, b)).toBe(false);
  });

  it('returns false for different lengths', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3, 0]);
    expect(timingSafeEqualBytes(a, b)).toBe(false);
  });

  it('returns true for two empty arrays', () => {
    expect(timingSafeEqualBytes(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });
});
