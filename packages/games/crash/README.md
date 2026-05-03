# @solsticebet/game-crash

Crash engine, single-player v1. ~97% RTP. The multiplayer real-time variant is layered on top of this engine when the game-server is built; the bust math, RNG derivation, ledger flow, and validation are all reusable.

See `docs/CRASH.md` for the spec.

## Public API

- `placeCrashBet(ledger, input)` — full bet pipeline
- `computePayout(stake, multiplier)`, `isWinningBet(bustAt, autoCashOut)` — pure math
- Validators and constants

## Dependencies

- `@solsticebet/rng` — derives the bust multiplier
- `@solsticebet/ledger` — money flows
