// packages/games/sicbo/tests/limits.test.ts

import { describe, expect, it } from 'vitest';

import { parseAmount } from '@solsticebet/ledger';

import {
  assertValidBet,
  assertValidRollInput,
  MAX_BETS_PER_ROLL,
  MAX_BET_STAKE,
  MIN_BET_STAKE,
  SicBoValidationError,
} from '../src/limits.js';
import type { SicBoBet, SicBoRollInput } from '../src/types.js';

describe('assertValidBet', () => {
  it('accepts in-bounds', () => {
    expect(() => {
      assertValidBet({ type: 'small', stake: MIN_BET_STAKE });
    }).not.toThrow();
    expect(() => {
      assertValidBet({ type: 'big', stake: MAX_BET_STAKE });
    }).not.toThrow();
  });
  it('rejects below min', () => {
    expect(() => {
      assertValidBet({ type: 'small', stake: 0n });
    }).toThrow(/minimum/);
  });
  it('rejects above max', () => {
    expect(() => {
      assertValidBet({ type: 'small', stake: MAX_BET_STAKE + 1n });
    }).toThrow(/maximum/);
  });
  it('rejects non-bigint', () => {
    expect(() => {
      assertValidBet({ type: 'small', stake: 1 as unknown as bigint });
    }).toThrow(/bigint/);
  });
});

const goodInput = (over: Partial<SicBoRollInput> = {}): SicBoRollInput => ({
  rollId: 'r-1',
  userAccountId: 'user',
  escrowAccountId: 'escrow',
  houseAccountId: 'house',
  bets: [{ type: 'small', stake: parseAmount('1') }],
  currency: 'INTERNAL_USDT',
  serverSeed: 'a'.repeat(64),
  clientSeed: 'cs',
  nonce: 0,
  ...over,
});

describe('assertValidRollInput', () => {
  it('accepts valid input', () => {
    expect(() => {
      assertValidRollInput(goodInput());
    }).not.toThrow();
  });
  it('rejects empty fields', () => {
    expect(() => {
      assertValidRollInput(goodInput({ rollId: '' }));
    }).toThrow(/rollId/);
    expect(() => {
      assertValidRollInput(goodInput({ userAccountId: '' }));
    }).toThrow(/userAccountId/);
    expect(() => {
      assertValidRollInput(goodInput({ escrowAccountId: '' }));
    }).toThrow(/escrowAccountId/);
    expect(() => {
      assertValidRollInput(goodInput({ houseAccountId: '' }));
    }).toThrow(/houseAccountId/);
  });
  it('rejects empty bets', () => {
    expect(() => {
      assertValidRollInput(goodInput({ bets: [] }));
    }).toThrow(/at least one bet/);
  });
  it('rejects too many bets', () => {
    const bets: SicBoBet[] = Array.from({ length: MAX_BETS_PER_ROLL + 1 }, () => ({
      type: 'small' as const,
      stake: parseAmount('0.01'),
    }));
    expect(() => {
      assertValidRollInput(goodInput({ bets }));
    }).toThrow(/max is/);
  });
  it('rejects non-INTERNAL_USDT currency', () => {
    expect(() => {
      assertValidRollInput(goodInput({ currency: 'BTC' }));
    }).toThrow(/INTERNAL_USDT/);
  });
  it('rejects total stake over MAX_ROLL_STAKE', () => {
    // 11 bets of 1000 each = 11,000 > 10,000
    const bets: SicBoBet[] = Array.from({ length: 11 }, () => ({
      type: 'small' as const,
      stake: MAX_BET_STAKE,
    }));
    expect(() => {
      assertValidRollInput(goodInput({ bets }));
    }).toThrow(/total roll stake/);
  });
  it('cascades per-bet validation', () => {
    expect(() => {
      assertValidRollInput(goodInput({ bets: [{ type: 'small', stake: 0n }] }));
    }).toThrow(SicBoValidationError);
  });
});
