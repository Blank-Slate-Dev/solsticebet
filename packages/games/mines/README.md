# @solsticebet/game-mines

Mines game engine. 5×5 grid, 1–24 mines, 97% RTP. Multi-action round lifecycle (start → reveal × N → cash out / bust).

See `docs/MINES.md` for the full spec.

## Public API

- `startRound(ledger, rounds, input)` — opens a round, debits stake
- `revealTile(ledger, rounds, roundId, tileIndex)` — reveals a tile; auto-cashes if all safe tiles uncovered
- `cashOut(ledger, rounds, roundId)` — pays out the player at the current multiplier
- `multiplierFor(mineCount, safeRevealed)` — pure math
- `InMemoryMinesRoundRepository` — for tests; the production impl lives in @solsticebet/db

## Dependencies

- `@solsticebet/rng` — derives the mine layout
- `@solsticebet/ledger` — money flows
