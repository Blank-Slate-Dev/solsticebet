// packages/games/roulette/tests/limits.test.ts

import { describe, expect, it } from 'vitest';

import { parseAmount } from '@solsticebet/ledger';

import {
  assertValidBet,
  assertValidSpinInput,
  MAX_BETS_PER_SPIN,
  MAX_BET_STAKE,
  MAX_SPIN_STAKE,
  MIN_BET_STAKE,
  RouletteValidationError,
} from '../src/limits.js';
import type { RouletteBet, RouletteSpinInput } from '../src/types.js';

describe('assertValidBet', () => {
  it('accepts in-bounds stakes', () => {
    expect(() => {
      assertValidBet({ type: 'red', stake: MIN_BET_STAKE });
    }).not.toThrow();
    expect(() => {
      assertValidBet({ type: 'red', stake: MAX_BET_STAKE });
    }).not.toThrow();
  });

  it('rejects below minimum', () => {
    expect(() => {
      assertValidBet({ type: 'red', stake: 0n });
    }).toThrow(/minimum/);
  });

  it('rejects above maximum', () => {
    expect(() => {
      assertValidBet({ type: 'red', stake: MAX_BET_STAKE + 1n });
    }).toThrow(/maximum/);
  });

  it('rejects non-bigint stake', () => {
    expect(() => {
      assertValidBet({
        type: 'red',
        stake: 1 as unknown as bigint,
      });
    }).toThrow(/bigint/);
  });
});

const goodInput = (over: Partial<RouletteSpinInput> = {}): RouletteSpinInput => ({
  spinId: 's-1',
  userAccountId: 'user-1',
  escrowAccountId: 'escrow',
  houseAccountId: 'house',
  bets: [{ type: 'red', stake: parseAmount('1') }],
  currency: 'INTERNAL_USDT',
  serverSeed: 'a'.repeat(64),
  clientSeed: 'cs',
  nonce: 0,
  ...over,
});

describe('assertValidSpinInput', () => {
  it('accepts a valid input', () => {
    expect(() => {
      assertValidSpinInput(goodInput());
    }).not.toThrow();
  });

  it('rejects empty fields', () => {
    expect(() => {
      assertValidSpinInput(goodInput({ spinId: '' }));
    }).toThrow(/spinId/);
    expect(() => {
      assertValidSpinInput(goodInput({ userAccountId: '' }));
    }).toThrow(/userAccountId/);
    expect(() => {
      assertValidSpinInput(goodInput({ escrowAccountId: '' }));
    }).toThrow(/escrowAccountId/);
    expect(() => {
      assertValidSpinInput(goodInput({ houseAccountId: '' }));
    }).toThrow(/houseAccountId/);
  });

  it('rejects empty bets array', () => {
    expect(() => {
      assertValidSpinInput(goodInput({ bets: [] }));
    }).toThrow(/at least one bet/);
  });

  it('rejects non-INTERNAL_USDT currency', () => {
    expect(() => {
      assertValidSpinInput(goodInput({ currency: 'BTC' }));
    }).toThrow(/INTERNAL_USDT/);
  });

  it('rejects too many bets', () => {
    const bets: RouletteBet[] = Array.from(
      { length: MAX_BETS_PER_SPIN + 1 },
      () => ({ type: 'red', stake: parseAmount('0.01') }) as const,
    );
    expect(() => {
      assertValidSpinInput(goodInput({ bets }));
    }).toThrow(/max is/);
  });

  it('rejects total stake over MAX_SPIN_STAKE', () => {
    // 11 bets of 1000 each = 11,000 > MAX_SPIN_STAKE 10,000
    const bets: RouletteBet[] = Array.from({ length: 11 }, () => ({
      type: 'red',
      stake: MAX_BET_STAKE,
    }));
    expect(() => {
      assertValidSpinInput(goodInput({ bets }));
    }).toThrow(/total spin stake/);
    void MAX_SPIN_STAKE; // referenced to avoid unused-import warning
  });

  it('cascades per-bet validation', () => {
    expect(() => {
      assertValidSpinInput(goodInput({ bets: [{ type: 'red', stake: 0n }] }));
    }).toThrow(RouletteValidationError);
  });
});
