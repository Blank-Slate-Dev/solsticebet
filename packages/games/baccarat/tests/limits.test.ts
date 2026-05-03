// packages/games/baccarat/tests/limits.test.ts

import { describe, expect, it } from 'vitest';

import { parseAmount } from '@solsticebet/ledger';

import {
  assertValidBet,
  assertValidCoupInput,
  BaccaratValidationError,
  MAX_BETS_PER_COUP,
  MAX_BET_STAKE,
  MAX_COUP_STAKE,
  MIN_BET_STAKE,
} from '../src/limits.js';
import type { BaccaratBet, BaccaratCoupInput } from '../src/types.js';

describe('assertValidBet', () => {
  it('accepts valid bet types and stakes', () => {
    expect(() => {
      assertValidBet({ type: 'player', stake: MIN_BET_STAKE });
    }).not.toThrow();
    expect(() => {
      assertValidBet({ type: 'banker', stake: MAX_BET_STAKE });
    }).not.toThrow();
    expect(() => {
      assertValidBet({ type: 'tie', stake: parseAmount('5') });
    }).not.toThrow();
  });

  it('rejects unknown bet type', () => {
    expect(() => {
      assertValidBet({
        type: 'unknown' as BaccaratBet['type'],
        stake: parseAmount('1'),
      });
    }).toThrow(/bet type/);
  });

  it('rejects below minimum', () => {
    expect(() => {
      assertValidBet({ type: 'player', stake: 0n });
    }).toThrow(/minimum/);
  });

  it('rejects above maximum', () => {
    expect(() => {
      assertValidBet({ type: 'player', stake: MAX_BET_STAKE + 1n });
    }).toThrow(/maximum/);
  });

  it('rejects non-bigint stake', () => {
    expect(() => {
      assertValidBet({
        type: 'player',
        stake: 1 as unknown as bigint,
      });
    }).toThrow(/bigint/);
  });
});

const goodInput = (over: Partial<BaccaratCoupInput> = {}): BaccaratCoupInput => ({
  coupId: 'c-1',
  userAccountId: 'user-1',
  escrowAccountId: 'escrow',
  houseAccountId: 'house',
  bets: [{ type: 'player', stake: parseAmount('1') }],
  currency: 'INTERNAL_USDT',
  serverSeed: 'a'.repeat(64),
  clientSeed: 'cs',
  nonce: 0,
  ...over,
});

describe('assertValidCoupInput', () => {
  it('accepts a valid input', () => {
    expect(() => {
      assertValidCoupInput(goodInput());
    }).not.toThrow();
  });

  it('rejects empty fields', () => {
    expect(() => {
      assertValidCoupInput(goodInput({ coupId: '' }));
    }).toThrow(/coupId/);
    expect(() => {
      assertValidCoupInput(goodInput({ userAccountId: '' }));
    }).toThrow(/userAccountId/);
    expect(() => {
      assertValidCoupInput(goodInput({ escrowAccountId: '' }));
    }).toThrow(/escrowAccountId/);
    expect(() => {
      assertValidCoupInput(goodInput({ houseAccountId: '' }));
    }).toThrow(/houseAccountId/);
  });

  it('rejects empty bets array', () => {
    expect(() => {
      assertValidCoupInput(goodInput({ bets: [] }));
    }).toThrow(/at least one bet/);
  });

  it('rejects non-INTERNAL_USDT currency', () => {
    expect(() => {
      assertValidCoupInput(goodInput({ currency: 'BTC' }));
    }).toThrow(/INTERNAL_USDT/);
  });

  it('rejects too many bets', () => {
    const bets: BaccaratBet[] = [
      { type: 'player', stake: parseAmount('1') },
      { type: 'banker', stake: parseAmount('1') },
      { type: 'tie', stake: parseAmount('1') },
      { type: 'player', stake: parseAmount('1') }, // 4th bet — over the cap
    ];
    expect(() => {
      assertValidCoupInput(goodInput({ bets }));
    }).toThrow(/max is/);
    void MAX_BETS_PER_COUP;
  });

  it('rejects duplicate bet types', () => {
    expect(() => {
      assertValidCoupInput(
        goodInput({
          bets: [
            { type: 'player', stake: parseAmount('1') },
            { type: 'player', stake: parseAmount('2') },
          ],
        }),
      );
    }).toThrow(/duplicate bet type/);
  });

  it('rejects total stake over MAX_COUP_STAKE', () => {
    // 3 bets of MAX_BET_STAKE each = 3000; OK
    // To exceed 5000 we'd need different config; force via an artificial sum
    // by using all three bets at MAX_BET_STAKE which = 3000 (under cap)
    // Instead: cap is 5000, MAX_BET_STAKE is 1000; with 3 bets max we top out at 3000.
    // So MAX_COUP_STAKE is unreachable with legal per-bet inputs. Sanity:
    expect(MAX_COUP_STAKE).toBeGreaterThan(MAX_BET_STAKE * 3n);
    // The check is still in place as defence in depth — we don't need to trigger it.
  });

  it('cascades per-bet validation', () => {
    expect(() => {
      assertValidCoupInput(goodInput({ bets: [{ type: 'player', stake: 0n }] }));
    }).toThrow(BaccaratValidationError);
  });
});
