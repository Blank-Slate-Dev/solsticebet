// packages/games/dice/tests/limits.test.ts

import { describe, expect, it } from 'vitest';

import { parseAmount } from '@solsticebet/ledger';

import {
  assertValidBetInput,
  assertValidMode,
  assertValidStake,
  assertValidTarget,
  DiceValidationError,
  MAX_STAKE,
  MAX_TARGET,
  MIN_STAKE,
  MIN_TARGET,
  MODES,
} from '../src/limits.js';
import type { DiceBetInput } from '../src/types.js';

const goodInput = (over: Partial<DiceBetInput> = {}): DiceBetInput => ({
  betId: 'bet-1',
  userAccountId: 'user-1',
  escrowAccountId: 'escrow',
  houseAccountId: 'house',
  stake: parseAmount('10'),
  target: 50,
  mode: 'under',
  currency: 'INTERNAL_USDT',
  serverSeed: 'a'.repeat(64),
  clientSeed: 'cs',
  nonce: 0,
  ...over,
});

describe('assertValidTarget', () => {
  it('accepts the documented bounds', () => {
    expect(() => {
      assertValidTarget(MIN_TARGET);
    }).not.toThrow();
    expect(() => {
      assertValidTarget(MAX_TARGET);
    }).not.toThrow();
    expect(() => {
      assertValidTarget(50.5);
    }).not.toThrow();
    expect(() => {
      assertValidTarget(50.01);
    }).not.toThrow();
  });

  it('rejects below minimum', () => {
    expect(() => {
      assertValidTarget(1.99);
    }).toThrow(DiceValidationError);
    expect(() => {
      assertValidTarget(0);
    }).toThrow(DiceValidationError);
  });

  it('rejects above maximum', () => {
    expect(() => {
      assertValidTarget(98.01);
    }).toThrow(DiceValidationError);
    expect(() => {
      assertValidTarget(100);
    }).toThrow(DiceValidationError);
  });

  it('rejects non-finite', () => {
    expect(() => {
      assertValidTarget(Number.NaN);
    }).toThrow(DiceValidationError);
    expect(() => {
      assertValidTarget(Number.POSITIVE_INFINITY);
    }).toThrow(DiceValidationError);
  });

  it('rejects sub-0.01 precision', () => {
    expect(() => {
      assertValidTarget(50.005);
    }).toThrow(/0.01/);
    expect(() => {
      assertValidTarget(50.123);
    }).toThrow(/0.01/);
  });
});

describe('assertValidMode', () => {
  it('accepts valid modes', () => {
    for (const m of MODES) {
      expect(() => {
        assertValidMode(m);
      }).not.toThrow();
    }
  });

  it('rejects invalid modes', () => {
    expect(() => {
      assertValidMode('exact');
    }).toThrow(DiceValidationError);
    expect(() => {
      assertValidMode('');
    }).toThrow(DiceValidationError);
    expect(() => {
      assertValidMode('OVER');
    }).toThrow(DiceValidationError);
  });
});

describe('assertValidStake', () => {
  it('accepts in-bounds stakes', () => {
    expect(() => {
      assertValidStake(MIN_STAKE);
    }).not.toThrow();
    expect(() => {
      assertValidStake(MAX_STAKE);
    }).not.toThrow();
    expect(() => {
      assertValidStake(parseAmount('100'));
    }).not.toThrow();
  });

  it('rejects below minimum', () => {
    expect(() => {
      assertValidStake(MIN_STAKE - 1n);
    }).toThrow(/minimum/);
    expect(() => {
      assertValidStake(0n);
    }).toThrow(/minimum/);
  });

  it('rejects above maximum', () => {
    expect(() => {
      assertValidStake(MAX_STAKE + 1n);
    }).toThrow(/maximum/);
  });

  it('rejects non-bigint', () => {
    expect(() => {
      assertValidStake(10 as unknown as bigint);
    }).toThrow(/bigint/);
  });
});

describe('assertValidBetInput', () => {
  it('accepts a valid input', () => {
    expect(() => {
      assertValidBetInput(goodInput());
    }).not.toThrow();
  });

  it('rejects empty betId', () => {
    expect(() => {
      assertValidBetInput(goodInput({ betId: '' }));
    }).toThrow(/betId/);
  });

  it('rejects empty userAccountId', () => {
    expect(() => {
      assertValidBetInput(goodInput({ userAccountId: '' }));
    }).toThrow(/userAccountId/);
  });

  it('rejects empty escrowAccountId', () => {
    expect(() => {
      assertValidBetInput(goodInput({ escrowAccountId: '' }));
    }).toThrow(/escrowAccountId/);
  });

  it('rejects empty houseAccountId', () => {
    expect(() => {
      assertValidBetInput(goodInput({ houseAccountId: '' }));
    }).toThrow(/houseAccountId/);
  });

  it('rejects non-INTERNAL_USDT currency', () => {
    expect(() => {
      assertValidBetInput(goodInput({ currency: 'BTC' }));
    }).toThrow(/INTERNAL_USDT/);
  });

  it('cascades stake/target/mode validation', () => {
    expect(() => {
      assertValidBetInput(goodInput({ stake: 0n }));
    }).toThrow(DiceValidationError);
    expect(() => {
      assertValidBetInput(goodInput({ target: 0 }));
    }).toThrow(DiceValidationError);
    expect(() => {
      assertValidBetInput(goodInput({ mode: 'exact' as unknown as DiceBetInput['mode'] }));
    }).toThrow(DiceValidationError);
  });
});
