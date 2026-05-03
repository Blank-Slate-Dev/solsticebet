# @solsticebet/game-dice

Dice game engine. Single-player provably-fair Dice with 99% RTP.

See `docs/DICE.md` for the full spec.

## Public API

- `placeDiceBet(repo, input)` — runs the full bet pipeline; returns `DiceBetOutcome`
- `computeMultiplier(target, mode)`, `winChancePercent(target, mode)`, `expectedRtp(target, mode)` — pure math
- `assertValidBetInput(input)`, `assertValidTarget`, `assertValidStake`, `assertValidMode` — input validation
- Constants: `MIN_STAKE`, `MAX_STAKE`, `MIN_TARGET`, `MAX_TARGET`, `MAX_PAYOUT`, `HOUSE_EDGE`

## Dependencies

- `@solsticebet/rng` — derives the roll
- `@solsticebet/ledger` — money flows
