// apps/demo-web/src/lib/session.ts
//
// Demo session bootstrapping. All state is in-memory and lives only as
// long as the page is open. Refresh = fresh session.

import {
  InMemoryLedgerRepository,
  parseAmount,
  recordAdjustment,
  type LedgerRepository,
} from '@solsticebet/ledger';
import { generateDefaultClientSeed, generateServerSeed, hashServerSeed } from '@solsticebet/rng';
import { InMemoryMinesRoundRepository } from '@solsticebet/game-mines';
import { InMemoryBlackjackRoundRepository } from '@solsticebet/game-blackjack';

export interface DemoSession {
  ledger: LedgerRepository;
  minesRounds: InMemoryMinesRoundRepository;
  blackjackRounds: InMemoryBlackjackRoundRepository;
  user: string;
  house: string;
  escrow: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  diceNonce: number;
  minesNonce: number;
  plinkoNonce: number;
  rouletteNonce: number;
  baccaratNonce: number;
  blackjackNonce: number;
  betCount: number;
}

export const STARTING_BALANCE_USDT = '1000';

const USER_ID = 'demo-user';
const HOUSE_ID = 'demo-house';
const ESCROW_ID = 'demo-escrow';

export async function bootstrapSession(): Promise<DemoSession> {
  const ledger = new InMemoryLedgerRepository();
  const minesRounds = new InMemoryMinesRoundRepository();
  const blackjackRounds = new InMemoryBlackjackRoundRepository();

  await ledger.createAccount({
    id: USER_ID,
    type: 'user',
    ownerId: 'demo-u-1',
    currency: 'INTERNAL_USDT',
  });
  await ledger.createAccount({
    id: HOUSE_ID,
    type: 'house',
    ownerId: null,
    currency: 'INTERNAL_USDT',
  });
  await ledger.createAccount({
    id: ESCROW_ID,
    type: 'escrow',
    ownerId: null,
    currency: 'INTERNAL_USDT',
  });
  await recordAdjustment(ledger, {
    userAccountId: USER_ID,
    houseAccountId: HOUSE_ID,
    amount: parseAmount(STARTING_BALANCE_USDT),
    currency: 'INTERNAL_USDT',
    direction: 'credit',
    adminId: 'demo-system',
    requestId: 'starting-balance',
    reason: 'demo session start',
  });

  const serverSeed = generateServerSeed();
  const clientSeed = generateDefaultClientSeed();

  return {
    ledger,
    minesRounds,
    blackjackRounds,
    user: USER_ID,
    house: HOUSE_ID,
    escrow: ESCROW_ID,
    serverSeed,
    serverSeedHash: hashServerSeed(serverSeed),
    clientSeed,
    diceNonce: 0,
    minesNonce: 0,
    plinkoNonce: 0,
    rouletteNonce: 0,
    baccaratNonce: 0,
    blackjackNonce: 0,
    betCount: 0,
  };
}
