// packages/games/blackjack/tests/limits.test.ts

import { describe, expect, it } from 'vitest';

import { parseAmount } from '@solsticebet/ledger';

import {
  assertValidStake,
  assertValidStartInput,
  BlackjackValidationError,
  MAX_STAKE,
  MIN_STAKE,
} from '../src/limits.js';
import type { StartBlackjackRoundInput } from '../src/types.js';

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

const goodInput = (over: Partial<StartBlackjackRoundInput> = {}): StartBlackjackRoundInput => ({
  roundId: 'r-1',
  userAccountId: 'user',
  escrowAccountId: 'escrow',
  houseAccountId: 'house',
  stake: parseAmount('10'),
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
      assertValidStartInput(goodInput({ roundId: '' }));
    }).toThrow(/roundId/);
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
  it('cascades stake validation', () => {
    expect(() => {
      assertValidStartInput(goodInput({ stake: 0n }));
    }).toThrow(BlackjackValidationError);
  });
});
