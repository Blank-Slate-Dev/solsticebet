// apps/demo-cli/src/main.ts
//
// Interactive PowerShell/terminal demo for Solstice.
//
// Spins up an in-memory ledger, funds a user, lets you place Dice bets
// (and Mines/Plinko bets too) against the real RNG and real ledger.
// Shows balance changes and ledger entries in real time.
//
// This is for demo/learning only. Not part of the production build path.
// Run with: pnpm demo

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import {
  formatAmountDisplay,
  InMemoryLedgerRepository,
  parseAmount,
  recordAdjustment,
  type LedgerRepository,
} from '@solsticebet/ledger';
import { generateDefaultClientSeed, generateServerSeed, hashServerSeed } from '@solsticebet/rng';
import { placeDiceBet } from '@solsticebet/game-dice';
import {
  cashOut,
  InMemoryMinesRoundRepository,
  multiplierFor as minesMultiplierFor,
  revealTile,
  startRound,
  TOTAL_TILES as MINES_TILES,
} from '@solsticebet/game-mines';
import { placePlinkoBet, type PlinkoRows } from '@solsticebet/game-plinko';

// ─── ANSI color helpers ──────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

const banner = `
${C.cyan}${C.bold}╔════════════════════════════════════════╗
║         SOLSTICE — DEMO CLI            ║
║   Provably-fair, real ledger, no UI    ║
╚════════════════════════════════════════╝${C.reset}
`;

// ─── State ───────────────────────────────────────────────────────────────

interface Session {
  ledger: LedgerRepository;
  minesRounds: InMemoryMinesRoundRepository;
  user: string;
  house: string;
  escrow: string;
  serverSeed: string;
  clientSeed: string;
  diceNonce: number;
  minesNonce: number;
  plinkoNonce: number;
  betCount: number;
}

async function bootstrap(): Promise<Session> {
  const ledger = new InMemoryLedgerRepository();
  const minesRounds = new InMemoryMinesRoundRepository();

  const USER = 'demo-user';
  const HOUSE = 'demo-house';
  const ESCROW = 'demo-escrow';

  await ledger.createAccount({
    id: USER,
    type: 'user',
    ownerId: 'u-1',
    currency: 'INTERNAL_USDT',
  });
  await ledger.createAccount({
    id: HOUSE,
    type: 'house',
    ownerId: null,
    currency: 'INTERNAL_USDT',
  });
  await ledger.createAccount({
    id: ESCROW,
    type: 'escrow',
    ownerId: null,
    currency: 'INTERNAL_USDT',
  });
  // Fund the user with 1000 USDT
  await recordAdjustment(ledger, {
    userAccountId: USER,
    houseAccountId: HOUSE,
    amount: parseAmount('1000'),
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
    user: USER,
    house: HOUSE,
    escrow: ESCROW,
    serverSeed,
    clientSeed,
    diceNonce: 0,
    minesNonce: 0,
    plinkoNonce: 0,
    betCount: 0,
  };
}

async function showBalance(session: Session): Promise<void> {
  const balance = await session.ledger.getBalance(session.user, 'INTERNAL_USDT');
  console.log(
    `\n${C.bold}Balance:${C.reset} ${C.green}${formatAmountDisplay(balance)} USDT${C.reset}`,
  );
}

function showSeeds(session: Session): void {
  const hash = hashServerSeed(session.serverSeed);
  console.log(`${C.dim}Server seed (committed via hash): ${hash}${C.reset}`);
  console.log(`${C.dim}Client seed:                      ${session.clientSeed}${C.reset}`);
  console.log(
    `${C.dim}Nonces — dice: ${String(session.diceNonce)}, mines: ${String(session.minesNonce)}, plinko: ${String(session.plinkoNonce)}${C.reset}`,
  );
}

// ─── Game flows ──────────────────────────────────────────────────────────

async function diceFlow(session: Session, rl: ReturnType<typeof createInterface>): Promise<void> {
  const stakeStr = (await rl.question(`${C.cyan}Stake (USDT, e.g. 5):${C.reset} `)).trim();
  const targetStr = (await rl.question(`${C.cyan}Target (2.00 to 98.00):${C.reset} `)).trim();
  const modeStr = (await rl.question(`${C.cyan}Mode — over or under:${C.reset} `))
    .trim()
    .toLowerCase();

  if (modeStr !== 'over' && modeStr !== 'under') {
    console.log(`${C.red}Invalid mode. Use 'over' or 'under'.${C.reset}`);
    return;
  }

  let stake: bigint;
  let target: number;
  try {
    stake = parseAmount(stakeStr);
    target = Number.parseFloat(targetStr);
    if (!Number.isFinite(target)) throw new Error('target NaN');
  } catch (err) {
    console.log(`${C.red}Bad input: ${(err as Error).message}${C.reset}`);
    return;
  }

  session.betCount += 1;
  const betId = `demo-dice-${String(session.betCount)}`;

  console.log(`\n${C.dim}Placing dice bet...${C.reset}`);
  try {
    const out = await placeDiceBet(session.ledger, {
      betId,
      userAccountId: session.user,
      escrowAccountId: session.escrow,
      houseAccountId: session.house,
      stake,
      target,
      mode: modeStr,
      currency: 'INTERNAL_USDT',
      serverSeed: session.serverSeed,
      clientSeed: session.clientSeed,
      nonce: session.diceNonce,
    });
    session.diceNonce += 1;

    const winColor = out.isWin ? C.green : C.red;
    const winLabel = out.isWin ? 'WIN' : 'LOSS';
    console.log(`\n  ${C.bold}Roll:${C.reset}       ${C.yellow}${out.roll.toFixed(2)}${C.reset}`);
    console.log(`  ${C.bold}Target:${C.reset}     ${target.toFixed(2)} (${modeStr})`);
    console.log(`  ${C.bold}Multiplier:${C.reset} ${out.multiplier.toFixed(4)}×`);
    console.log(`  ${C.bold}Outcome:${C.reset}    ${winColor}${C.bold}${winLabel}${C.reset}`);
    if (out.isWin) {
      console.log(
        `  ${C.bold}Payout:${C.reset}     ${C.green}+${formatAmountDisplay(out.payout)} USDT${C.reset}`,
      );
    } else {
      console.log(
        `  ${C.bold}Lost:${C.reset}       ${C.red}-${formatAmountDisplay(stake)} USDT${C.reset}`,
      );
    }
  } catch (err) {
    console.log(`${C.red}Bet failed: ${(err as Error).message}${C.reset}`);
  }
}

async function minesFlow(session: Session, rl: ReturnType<typeof createInterface>): Promise<void> {
  const stakeStr = (await rl.question(`${C.cyan}Stake (USDT, e.g. 5):${C.reset} `)).trim();
  const minesStr = (await rl.question(`${C.cyan}Mine count (1 to 24):${C.reset} `)).trim();

  let stake: bigint;
  let mineCount: number;
  try {
    stake = parseAmount(stakeStr);
    mineCount = Number.parseInt(minesStr, 10);
  } catch (err) {
    console.log(`${C.red}Bad input: ${(err as Error).message}${C.reset}`);
    return;
  }

  session.betCount += 1;
  const roundId = `demo-mines-${String(session.betCount)}`;

  let round;
  try {
    round = await startRound(session.ledger, session.minesRounds, {
      roundId,
      userAccountId: session.user,
      escrowAccountId: session.escrow,
      houseAccountId: session.house,
      stake,
      mineCount,
      currency: 'INTERNAL_USDT',
      serverSeed: session.serverSeed,
      clientSeed: session.clientSeed,
      nonce: session.minesNonce,
    });
    session.minesNonce += 1;
  } catch (err) {
    console.log(`${C.red}Could not start round: ${(err as Error).message}${C.reset}`);
    return;
  }

  console.log(
    `\n${C.dim}Round started. ${String(MINES_TILES - mineCount)} safe tiles, ${String(mineCount)} mines.${C.reset}`,
  );
  console.log(
    `${C.dim}Pick tile indices 0..24, or type 'cash' to cash out, 'quit' to abandon.${C.reset}`,
  );

  while (round.state === 'active') {
    const mul = minesMultiplierFor(mineCount, round.revealed.length);
    const potential = (Number(stake) / 1e18) * mul;
    console.log(
      `${C.dim}Revealed: ${String(round.revealed.length)} | Multiplier: ${mul.toFixed(4)}× | Potential payout: ${potential.toFixed(2)} USDT${C.reset}`,
    );
    const choice = (await rl.question(`${C.cyan}Tile (0-24) / cash / quit:${C.reset} `)).trim();

    if (choice === 'quit') {
      console.log(
        `${C.yellow}Abandoning round (escrow remains; restart the demo to release).${C.reset}`,
      );
      return;
    }

    if (choice === 'cash') {
      if (round.revealed.length === 0) {
        console.log(`${C.red}Cannot cash out before any reveal.${C.reset}`);
        continue;
      }
      try {
        const out = await cashOut(session.ledger, session.minesRounds, roundId);
        round = out.round;
        console.log(`\n  ${C.bold}Cashed out at ${out.currentMultiplier.toFixed(4)}×${C.reset}`);
        console.log(
          `  ${C.green}${C.bold}Payout: ${formatAmountDisplay(out.round.payout ?? 0n)} USDT${C.reset}`,
        );
      } catch (err) {
        console.log(`${C.red}Cash out failed: ${(err as Error).message}${C.reset}`);
      }
      continue;
    }

    const tile = Number.parseInt(choice, 10);
    if (!Number.isInteger(tile) || tile < 0 || tile >= MINES_TILES) {
      console.log(`${C.red}Invalid tile.${C.reset}`);
      continue;
    }
    if (round.revealed.includes(tile)) {
      console.log(`${C.yellow}Tile already revealed.${C.reset}`);
      continue;
    }

    try {
      const out = await revealTile(session.ledger, session.minesRounds, roundId, tile);
      round = out.round;
      if (out.wasMine === true) {
        console.log(
          `\n  ${C.red}${C.bold}💥 MINE! Tile ${String(tile)} was a mine. Round busted.${C.reset}`,
        );
      } else {
        console.log(`  ${C.green}✓ Safe! Tile ${String(tile)}${C.reset}`);
      }
    } catch (err) {
      console.log(`${C.red}Reveal failed: ${(err as Error).message}${C.reset}`);
    }
  }
}

async function plinkoFlow(session: Session, rl: ReturnType<typeof createInterface>): Promise<void> {
  const stakeStr = (await rl.question(`${C.cyan}Stake (USDT, e.g. 1):${C.reset} `)).trim();
  const rowsStr = (await rl.question(`${C.cyan}Rows (8, 12, 16):${C.reset} `)).trim();
  const riskStr = (await rl.question(`${C.cyan}Risk (low / medium / high):${C.reset} `))
    .trim()
    .toLowerCase();

  let stake: bigint;
  let rows: PlinkoRows;
  try {
    stake = parseAmount(stakeStr);
    const r = Number.parseInt(rowsStr, 10);
    if (r !== 8 && r !== 12 && r !== 16) throw new Error('rows must be 8, 12, or 16');
    rows = r;
  } catch (err) {
    console.log(`${C.red}Bad input: ${(err as Error).message}${C.reset}`);
    return;
  }

  if (riskStr !== 'low' && riskStr !== 'medium' && riskStr !== 'high') {
    console.log(`${C.red}Risk must be low, medium, or high.${C.reset}`);
    return;
  }

  session.betCount += 1;
  const betId = `demo-plinko-${String(session.betCount)}`;

  try {
    const out = await placePlinkoBet(session.ledger, {
      betId,
      userAccountId: session.user,
      escrowAccountId: session.escrow,
      houseAccountId: session.house,
      stake,
      rows,
      risk: riskStr,
      currency: 'INTERNAL_USDT',
      serverSeed: session.serverSeed,
      clientSeed: session.clientSeed,
      nonce: session.plinkoNonce,
    });
    session.plinkoNonce += 1;

    // Render the path: '<' for left, '>' for right
    const pathStr = out.path.map((d) => (d === 'left' ? '<' : '>')).join(' ');
    console.log(`\n  ${C.bold}Path:${C.reset}       ${C.dim}${pathStr}${C.reset}`);
    console.log(`  ${C.bold}Bucket:${C.reset}     ${String(out.bucket)} of ${String(rows)}`);
    console.log(`  ${C.bold}Multiplier:${C.reset} ${out.multiplier.toFixed(4)}×`);
    if (out.payout > out.stake) {
      console.log(
        `  ${C.green}${C.bold}WIN:${C.reset}        ${C.green}+${formatAmountDisplay(out.payout - out.stake)} USDT${C.reset}`,
      );
    } else if (out.payout === out.stake) {
      console.log(`  ${C.yellow}${C.bold}PUSH:${C.reset}       stake refunded`);
    } else {
      const lost = out.stake - out.payout;
      console.log(
        `  ${C.red}${C.bold}LOSS:${C.reset}       ${C.red}-${formatAmountDisplay(lost)} USDT${C.reset} ${C.dim}(${formatAmountDisplay(out.payout)} returned)${C.reset}`,
      );
    }
  } catch (err) {
    console.log(`${C.red}Bet failed: ${(err as Error).message}${C.reset}`);
  }
}

async function showLedger(session: Session): Promise<void> {
  const entries = await session.ledger.getEntries(session.user, { limit: 20 });
  if (entries.length === 0) {
    console.log(`${C.dim}No ledger entries yet.${C.reset}`);
    return;
  }
  console.log(`\n${C.bold}Last ${String(entries.length)} ledger entries (newest first):${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(80)}${C.reset}`);
  console.log(`${C.dim}id    | type              | amount         | reference${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(80)}${C.reset}`);
  for (const e of entries) {
    const sign = e.amount >= 0n ? '+' : '';
    const color = e.amount >= 0n ? C.green : C.red;
    const amountStr = `${sign}${formatAmountDisplay(e.amount, 4).padStart(12)}`;
    const idStr = String(e.id).padStart(5);
    const typeStr = e.transactionType.padEnd(18);
    const refStr = e.referenceId ?? '';
    console.log(
      `${idStr} | ${typeStr} | ${color}${amountStr}${C.reset} | ${C.dim}${refStr}${C.reset}`,
    );
  }
}

// ─── Main loop ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(banner);
  console.log(`${C.dim}Bootstrapping in-memory ledger and provably-fair RNG...${C.reset}`);
  const session = await bootstrap();
  console.log(`${C.dim}User funded with 1000.00 USDT. Server seed generated.${C.reset}`);
  showSeeds(session);
  await showBalance(session);

  const rl = createInterface({ input: stdin, output: stdout });

  let running = true;
  while (running) {
    console.log(`\n${C.bold}Choose:${C.reset}`);
    console.log(`  ${C.cyan}1${C.reset}) Place a Dice bet`);
    console.log(`  ${C.cyan}2${C.reset}) Play a Mines round (interactive)`);
    console.log(`  ${C.cyan}3${C.reset}) Place a Plinko bet`);
    console.log(`  ${C.cyan}4${C.reset}) Show recent ledger entries`);
    console.log(`  ${C.cyan}5${C.reset}) Show seeds and balance`);
    console.log(`  ${C.cyan}q${C.reset}) Quit`);

    const choice = (await rl.question(`\n${C.cyan}>${C.reset} `)).trim().toLowerCase();

    if (choice === 'q' || choice === 'quit' || choice === 'exit') {
      console.log(`\n${C.dim}Goodbye.${C.reset}`);
      running = false;
      continue;
    }
    if (choice === '1') await diceFlow(session, rl);
    else if (choice === '2') await minesFlow(session, rl);
    else if (choice === '3') await plinkoFlow(session, rl);
    else if (choice === '4') await showLedger(session);
    else if (choice === '5') {
      showSeeds(session);
      await showBalance(session);
      continue;
    } else {
      console.log(`${C.red}Unknown choice.${C.reset}`);
      continue;
    }
    await showBalance(session);
  }

  rl.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
