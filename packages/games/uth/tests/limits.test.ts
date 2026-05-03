// packages/games/uth/tests/limits.test.ts

import { describe, expect, it } from 'vitest';

import { parseAmount } from '@solsticebet/ledger';

import {
  assertValidAnte,
  assertValidStartInput,
  assertValidTrips,
  MAX_ANTE,
  MAX_TRIPS,
  MIN_ANTE,
  MIN_TRIPS,
  UthValidationError,
} from '../src/limits.js';
import type { StartUthCoupInput } from '../src/types.js';

describe('assertValidAnte', () => {
  it('accepts in-bounds', () => {
    expect(() => {
      assertValidAnte(MIN_ANTE);
    }).not.toThrow();
    expect(() => {
      assertValidAnte(MAX_ANTE);
    }).not.toThrow();
  });
  it('rejects below min', () => {
    expect(() => {
      assertValidAnte(MIN_ANTE - 1n);
    }).toThrow(/minimum/);
  });
  it('rejects above max', () => {
    expect(() => {
      assertValidAnte(MAX_ANTE + 1n);
    }).toThrow(/maximum/);
  });
  it('rejects non-bigint', () => {
    expect(() => {
      assertValidAnte(1 as unknown as bigint);
    }).toThrow(/bigint/);
  });
});

describe('assertValidTrips', () => {
  it('accepts 0 (no trips)', () => {
    expect(() => {
      assertValidTrips(0n);
    }).not.toThrow();
  });
  it('accepts in-bounds', () => {
    expect(() => {
      assertValidTrips(MIN_TRIPS);
    }).not.toThrow();
    expect(() => {
      assertValidTrips(MAX_TRIPS);
    }).not.toThrow();
  });
  it('rejects below min (non-zero)', () => {
    expect(() => {
      assertValidTrips(MIN_TRIPS - 1n);
    }).toThrow(/minimum/);
  });
  it('rejects above max', () => {
    expect(() => {
      assertValidTrips(MAX_TRIPS + 1n);
    }).toThrow(/maximum/);
  });
  it('rejects non-bigint', () => {
    expect(() => {
      assertValidTrips(1 as unknown as bigint);
    }).toThrow(/bigint/);
  });
});

const goodInput = (over: Partial<StartUthCoupInput> = {}): StartUthCoupInput => ({
  coupId: 'c-1',
  userAccountId: 'user',
  escrowAccountId: 'escrow',
  houseAccountId: 'house',
  ante: parseAmount('1'),
  trips: 0n,
  currency: 'INTERNAL_USDT',
  serverSeed: 'a'.repeat(64),
  clientSeed: 'cs',
  nonce: 0,
  ...over,
});

describe('assertValidStartInput', () => {
  it('accepts valid input', () => {
    expect(() => {
      assertValidStartInput(goodInput());
    }).not.toThrow();
  });
  it('rejects empty fields', () => {
    expect(() => {
      assertValidStartInput(goodInput({ coupId: '' }));
    }).toThrow(/coupId/);
    expect(() => {
      assertValidStartInput(goodInput({ userAccountId: '' }));
    }).toThrow(/userAccountId/);
    expect(() => {
      assertValidStartInput(goodInput({ escrowAccountId: '' }));
    }).toThrow(/escrowAccountId/);
    expect(() => {
      assertValidStartInput(goodInput({ houseAccountId: '' }));
    }).toThrow(/houseAccountId/);
  });
  it('rejects non-INTERNAL_USDT currency', () => {
    expect(() => {
      assertValidStartInput(goodInput({ currency: 'BTC' }));
    }).toThrow(/INTERNAL_USDT/);
  });
  it('cascades ante/trips validation', () => {
    expect(() => {
      assertValidStartInput(goodInput({ ante: 0n }));
    }).toThrow(UthValidationError);
    expect(() => {
      assertValidStartInput(goodInput({ trips: 1n }));
    }).toThrow(UthValidationError);
  });
});
