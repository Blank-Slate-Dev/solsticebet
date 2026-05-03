// packages/games/plinko/tests/limits.test.ts

import { describe, expect, it } from 'vitest';

import { parseAmount } from '@solsticebet/ledger';

import {
  assertValidBetInput,
  assertValidRisk,
  assertValidRows,
  assertValidStake,
  MAX_STAKE,
  MIN_STAKE,
  PlinkoValidationError,
} from '../src/limits.js';
import type { PlinkoBetInput } from '../src/types.js';

const goodInput = (over: Partial<PlinkoBetInput> = {}): PlinkoBetInput => ({
  betId: 'b-1',
  userAccountId: 'user-1',
  escrowAccountId: 'escrow',
  houseAccountId: 'house',
  stake: parseAmount('1'),
  rows: 8,
  risk: 'medium',
  currency: 'INTERNAL_USDT',
  serverSeed: 'a'.repeat(64),
  clientSeed: 'cs',
  nonce: 0,
  ...over,
});

describe('assertValidStake', () => {
  it('accepts in-bounds', () => {
    expect(() => {
      assertValidStake(MIN_STAKE);
    }).not.toThrow();
    expect(() => {
      assertValidStake(MAX_STAKE);
    }).not.toThrow();
  });

  it('rejects below minimum', () => {
    expect(() => {
      assertValidStake(MIN_STAKE - 1n);
    }).toThrow(/minimum/);
  });

  it('rejects above maximum', () => {
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

describe('assertValidRows', () => {
  it('accepts 8, 12, 16', () => {
    expect(() => {
      assertValidRows(8);
    }).not.toThrow();
    expect(() => {
      assertValidRows(12);
    }).not.toThrow();
    expect(() => {
      assertValidRows(16);
    }).not.toThrow();
  });

  it('rejects other values', () => {
    expect(() => {
      assertValidRows(7);
    }).toThrow(PlinkoValidationError);
    expect(() => {
      assertValidRows(20);
    }).toThrow(PlinkoValidationError);
    expect(() => {
      assertValidRows(0);
    }).toThrow(PlinkoValidationError);
  });
});

describe('assertValidRisk', () => {
  it('accepts low, medium, high', () => {
    expect(() => {
      assertValidRisk('low');
    }).not.toThrow();
    expect(() => {
      assertValidRisk('medium');
    }).not.toThrow();
    expect(() => {
      assertValidRisk('high');
    }).not.toThrow();
  });

  it('rejects other strings', () => {
    expect(() => {
      assertValidRisk('safe');
    }).toThrow(PlinkoValidationError);
    expect(() => {
      assertValidRisk('LOW');
    }).toThrow(PlinkoValidationError);
    expect(() => {
      assertValidRisk('');
    }).toThrow(PlinkoValidationError);
  });
});

describe('assertValidBetInput', () => {
  it('accepts a good input', () => {
    expect(() => {
      assertValidBetInput(goodInput());
    }).not.toThrow();
  });

  it('rejects empty betId/account fields', () => {
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

  it('cascades stake/rows/risk validation', () => {
    expect(() => {
      assertValidBetInput(goodInput({ stake: 0n }));
    }).toThrow(PlinkoValidationError);
    expect(() => {
      assertValidBetInput(goodInput({ rows: 7 as unknown as PlinkoBetInput['rows'] }));
    }).toThrow(PlinkoValidationError);
    expect(() => {
      assertValidBetInput(goodInput({ risk: 'safe' as unknown as PlinkoBetInput['risk'] }));
    }).toThrow(PlinkoValidationError);
  });
});
