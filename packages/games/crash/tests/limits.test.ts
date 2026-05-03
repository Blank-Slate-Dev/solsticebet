// packages/games/crash/tests/limits.test.ts

import { describe, expect, it } from 'vitest';

import { parseAmount } from '@solsticebet/ledger';

import {
  assertValidAutoCashOut,
  assertValidBetInput,
  assertValidStake,
  CrashValidationError,
  MAX_AUTO_CASHOUT,
  MAX_STAKE,
  MIN_AUTO_CASHOUT,
  MIN_STAKE,
} from '../src/limits.js';
import type { CrashBetInput } from '../src/types.js';

describe('assertValidStake', () => {
  it('accepts in-bounds', () => {
    expect(() => {
      assertValidStake(MIN_STAKE);
    }).not.toThrow();
    expect(() => {
      assertValidStake(MAX_STAKE);
    }).not.toThrow();
  });
  it('rejects below min', () => {
    expect(() => {
      assertValidStake(MIN_STAKE - 1n);
    }).toThrow(/minimum/);
  });
  it('rejects above max', () => {
    expect(() => {
      assertValidStake(MAX_STAKE + 1n);
    }).toThrow(/maximum/);
  });
  it('rejects non-bigint', () => {
    expect(() => {
      assertValidStake(1 as unknown as bigint);
    }).toThrow(/bigint/);
  });
});

describe('assertValidAutoCashOut', () => {
  it('accepts the documented bounds', () => {
    expect(() => {
      assertValidAutoCashOut(MIN_AUTO_CASHOUT);
    }).not.toThrow();
    expect(() => {
      assertValidAutoCashOut(2.0);
    }).not.toThrow();
    expect(() => {
      assertValidAutoCashOut(100);
    }).not.toThrow();
    expect(() => {
      assertValidAutoCashOut(MAX_AUTO_CASHOUT);
    }).not.toThrow();
  });
  it('rejects below min', () => {
    expect(() => {
      assertValidAutoCashOut(1.0);
    }).toThrow();
    expect(() => {
      assertValidAutoCashOut(1.005);
    }).toThrow();
  });
  it('rejects above max', () => {
    expect(() => {
      assertValidAutoCashOut(MAX_AUTO_CASHOUT + 1);
    }).toThrow();
  });
  it('rejects non-finite', () => {
    expect(() => {
      assertValidAutoCashOut(Number.NaN);
    }).toThrow();
    expect(() => {
      assertValidAutoCashOut(Number.POSITIVE_INFINITY);
    }).toThrow();
  });
  it('rejects sub-0.01 precision', () => {
    expect(() => {
      assertValidAutoCashOut(2.005);
    }).toThrow(/0.01/);
  });
});

const goodInput = (over: Partial<CrashBetInput> = {}): CrashBetInput => ({
  betId: 'b-1',
  userAccountId: 'user-1',
  escrowAccountId: 'escrow',
  houseAccountId: 'house',
  stake: parseAmount('1'),
  autoCashOut: 2.0,
  currency: 'INTERNAL_USDT',
  serverSeed: 'a'.repeat(64),
  clientSeed: 'cs',
  nonce: 0,
  ...over,
});

describe('assertValidBetInput', () => {
  it('accepts valid input', () => {
    expect(() => {
      assertValidBetInput(goodInput());
    }).not.toThrow();
  });
  it('rejects empty fields', () => {
    expect(() => {
      assertValidBetInput(goodInput({ betId: '' }));
    }).toThrow(/betId/);
    expect(() => {
      assertValidBetInput(goodInput({ userAccountId: '' }));
    }).toThrow(/userAccountId/);
    expect(() => {
      assertValidBetInput(goodInput({ escrowAccountId: '' }));
    }).toThrow(/escrowAccountId/);
    expect(() => {
      assertValidBetInput(goodInput({ houseAccountId: '' }));
    }).toThrow(/houseAccountId/);
  });
  it('rejects non-INTERNAL_USDT currency', () => {
    expect(() => {
      assertValidBetInput(goodInput({ currency: 'BTC' }));
    }).toThrow(/INTERNAL_USDT/);
  });
  it('cascades stake/autoCashOut validation', () => {
    expect(() => {
      assertValidBetInput(goodInput({ stake: 0n }));
    }).toThrow(CrashValidationError);
    expect(() => {
      assertValidBetInput(goodInput({ autoCashOut: 1.0 }));
    }).toThrow(CrashValidationError);
  });
});
