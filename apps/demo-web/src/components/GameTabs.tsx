// apps/demo-web/src/components/GameTabs.tsx

'use client';

import { useState } from 'react';

import { BaccaratGame } from './BaccaratGame';
import { BlackjackGame } from './BlackjackGame';
import { DiceGame } from './DiceGame';
import { MinesGame } from './MinesGame';
import { PlinkoGame } from './PlinkoGame';
import { RouletteGame } from './RouletteGame';

type Game = 'dice' | 'mines' | 'plinko' | 'roulette' | 'baccarat' | 'blackjack';

export function GameTabs() {
  const [game, setGame] = useState<Game>('dice');

  return (
    <section className="rounded-lg border border-solstice-border bg-solstice-card/60 p-6">
      <div className="mb-6 flex flex-wrap gap-2 border-b border-solstice-border">
        {(['dice', 'mines', 'plinko', 'roulette', 'baccarat', 'blackjack'] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => {
              setGame(g);
            }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize transition ${
              game === g
                ? 'border-solstice-accent text-solstice-accent'
                : 'border-transparent text-solstice-muted hover:text-solstice-fg'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {game === 'dice' && <DiceGame />}
      {game === 'mines' && <MinesGame />}
      {game === 'plinko' && <PlinkoGame />}
      {game === 'roulette' && <RouletteGame />}
      {game === 'baccarat' && <BaccaratGame />}
      {game === 'blackjack' && <BlackjackGame />}
    </section>
  );
}
