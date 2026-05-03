// apps/demo-web/src/components/GameTabs.tsx

'use client';

import { useState } from 'react';

import { BaccaratGame } from './BaccaratGame';
import { BlackjackGame } from './BlackjackGame';
import { CoinFlipGame } from './CoinFlipGame';
import { CrashGame } from './CrashGame';
import { DiceGame } from './DiceGame';
import { HiLoGame } from './HiLoGame';
import { KenoGame } from './KenoGame';
import { LimboGame } from './LimboGame';
import { LuckyWheelGame } from './LuckyWheelGame';
import { MinesGame } from './MinesGame';
import { PlinkoGame } from './PlinkoGame';
import { RouletteGame } from './RouletteGame';
import { SicBoGame } from './SicBoGame';
import { UthGame } from './UthGame';

type Game =
  | 'dice'
  | 'mines'
  | 'plinko'
  | 'roulette'
  | 'baccarat'
  | 'blackjack'
  | 'crash'
  | 'uth'
  | 'sicbo'
  | 'coin-flip'
  | 'limbo'
  | 'lucky-wheel'
  | 'keno'
  | 'hi-lo';

const GAMES: readonly Game[] = [
  'dice',
  'mines',
  'plinko',
  'roulette',
  'baccarat',
  'blackjack',
  'crash',
  'uth',
  'sicbo',
  'coin-flip',
  'limbo',
  'lucky-wheel',
  'keno',
  'hi-lo',
];

const TAB_LABEL: Readonly<Record<Game, string>> = {
  dice: 'Dice',
  mines: 'Mines',
  plinko: 'Plinko',
  roulette: 'Roulette',
  baccarat: 'Baccarat',
  blackjack: 'Blackjack',
  crash: 'Crash',
  uth: 'UTH',
  sicbo: 'Sic Bo',
  'coin-flip': 'Coin Flip',
  limbo: 'Limbo',
  'lucky-wheel': 'Wheel',
  keno: 'Keno',
  'hi-lo': 'Hi-Lo',
};

export function GameTabs() {
  const [game, setGame] = useState<Game>('dice');

  return (
    <section className="rounded-lg border border-solstice-border bg-solstice-card/60 p-6">
      <div className="mb-6 flex flex-wrap gap-2 border-b border-solstice-border">
        {GAMES.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => {
              setGame(g);
            }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              game === g
                ? 'border-solstice-accent text-solstice-accent'
                : 'border-transparent text-solstice-muted hover:text-solstice-fg'
            }`}
          >
            {TAB_LABEL[g]}
          </button>
        ))}
      </div>

      {game === 'dice' && <DiceGame />}
      {game === 'mines' && <MinesGame />}
      {game === 'plinko' && <PlinkoGame />}
      {game === 'roulette' && <RouletteGame />}
      {game === 'baccarat' && <BaccaratGame />}
      {game === 'blackjack' && <BlackjackGame />}
      {game === 'crash' && <CrashGame />}
      {game === 'uth' && <UthGame />}
      {game === 'sicbo' && <SicBoGame />}
      {game === 'coin-flip' && <CoinFlipGame />}
      {game === 'limbo' && <LimboGame />}
      {game === 'lucky-wheel' && <LuckyWheelGame />}
      {game === 'keno' && <KenoGame />}
      {game === 'hi-lo' && <HiLoGame />}
    </section>
  );
}
