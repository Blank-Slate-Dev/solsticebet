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
import { InMemoryUthCoupRepository } from '@solsticebet/game-uth';
import { InMemoryHiLoRoundRepository } from '@solsticebet/game-hi-lo';

export interface DemoSession {
  ledger: LedgerRepository;
  minesRounds: InMemoryMinesRoundRepository;
  blackjackRounds: InMemoryBlackjackRoundRepository;
  uthCoups: InMemoryUthCoupRepository;
  hiLoRounds: InMemoryHiLoRoundRepository;
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
  crashNonce: number;
  uthNonce: number;
  sicboNonce: number;
  coinFlipNonce: number;
  limboNonce: number;
  luckyWheelNonce: number;
  kenoNonce: number;
  hiLoNonce: number;
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
  const uthCoups = new InMemoryUthCoupRepository();
  const hiLoRounds = new InMemoryHiLoRoundRepository();

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
    uthCoups,
    hiLoRounds,
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
    crashNonce: 0,
    uthNonce: 0,
    sicboNonce: 0,
    coinFlipNonce: 0,
    limboNonce: 0,
    luckyWheelNonce: 0,
    kenoNonce: 0,
    hiLoNonce: 0,
    betCount: 0,
  };
}
