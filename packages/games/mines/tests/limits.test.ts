// packages/games/mines/tests/limits.test.ts

import { describe, expect, it } from 'vitest';

import { parseAmount } from '@solsticebet/ledger';

import {
  assertValidMineCount,
  assertValidStake,
  assertValidStartInput,
  assertValidTileIndex,
  GRID_SIZE,
  MAX_MINE_COUNT,
  MAX_STAKE,
  MIN_MINE_COUNT,
  MIN_STAKE,
  MinesValidationError,
} from '../src/limits.js';
import type { StartMinesRoundInput } from '../src/types.js';

const goodInput = (over: Partial<StartMinesRoundInput> = {}): StartMinesRoundInput => ({
  roundId: 'r-1',
  userAccountId: 'user-1',
  escrowAccountId: 'escrow',
  houseAccountId: 'house',
  stake: parseAmount('10'),
  mineCount: 3,
  currency: 'INTERNAL_USDT',
  serverSeed: 'a'.repeat(64),
  clientSeed: 'cs',
  nonce: 0,
  ...over,
});

describe('assertValidStake', () => {
  it('accepts in-bounds stakes', () => {
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

describe('assertValidMineCount', () => {
  it('accepts the documented bounds', () => {
    expect(() => {
      assertValidMineCount(MIN_MINE_COUNT);
    }).not.toThrow();
    expect(() => {
      assertValidMineCount(MAX_MINE_COUNT);
    }).not.toThrow();
    expect(() => {
      assertValidMineCount(12);
    }).not.toThrow();
  });

  it('rejects out-of-bounds', () => {
    expect(() => {
      assertValidMineCount(0);
    }).toThrow(MinesValidationError);
    expect(() => {
      assertValidMineCount(25);
    }).toThrow(MinesValidationError);
  });

  it('rejects fractional', () => {
    expect(() => {
      assertValidMineCount(3.5);
    }).toThrow(MinesValidationError);
  });
});

describe('assertValidTileIndex', () => {
  it('accepts 0..GRID_SIZE-1', () => {
    for (let i = 0; i < GRID_SIZE; i++) {
      expect(() => {
        assertValidTileIndex(i);
      }).not.toThrow();
    }
  });

  it('rejects negative or >=GRID_SIZE', () => {
    expect(() => {
      assertValidTileIndex(-1);
    }).toThrow();
    expect(() => {
      assertValidTileIndex(GRID_SIZE);
    }).toThrow();
  });

  it('rejects fractional', () => {
    expect(() => {
      assertValidTileIndex(1.5);
    }).toThrow();
  });
});

describe('assertValidStartInput', () => {
  it('accepts a good input', () => {
    expect(() => {
      assertValidStartInput(goodInput());
    }).not.toThrow();
  });

  it('rejects empty roundId', () => {
    expect(() => {
      assertValidStartInput(goodInput({ roundId: '' }));
    }).toThrow(/roundId/);
  });

  it('rejects empty userAccountId', () => {
    expect(() => {
      assertValidStartInput(goodInput({ userAccountId: '' }));
    }).toThrow(/userAccountId/);
  });

  it('rejects empty escrowAccountId', () => {
    expect(() => {
      assertValidStartInput(goodInput({ escrowAccountId: '' }));
    }).toThrow(/escrowAccountId/);
  });

  it('rejects empty houseAccountId', () => {
    expect(() => {
      assertValidStartInput(goodInput({ houseAccountId: '' }));
    }).toThrow(/houseAccountId/);
  });

  it('rejects non-INTERNAL_USDT currency', () => {
    expect(() => {
      assertValidStartInput(goodInput({ currency: 'BTC' }));
    }).toThrow(/INTERNAL_USDT/);
  });

  it('cascades stake/mineCount validation', () => {
    expect(() => {
      assertValidStartInput(goodInput({ stake: 0n }));
    }).toThrow(MinesValidationError);
    expect(() => {
      assertValidStartInput(goodInput({ mineCount: 0 }));
    }).toThrow(MinesValidationError);
    expect(() => {
      assertValidStartInput(goodInput({ mineCount: 25 }));
    }).toThrow(MinesValidationError);
  });
});
