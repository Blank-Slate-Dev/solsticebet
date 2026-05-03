# @solsticebet/game-uth

Ultimate Texas Hold'em engine. ~99.5% RTP on the action (Ante + Blind + Play). Trips side bet has separate higher house edge.

See `docs/UTH.md` for the spec.

## Public API

- `startCoup`, `raise4x`, `raise3x`, `checkPreflop`, `raise2x`, `checkFlop`, `raise1x`, `fold`
- `evaluateFive(cards)`, `bestOfSeven(cards)` — five-card poker evaluator
- `BLIND_PAYTABLE`, `TRIPS_PAYTABLE`, `computePayout`
- `InMemoryUthCoupRepository`

## Dependencies

- `@solsticebet/rng` — derives 9 suited cards
- `@solsticebet/ledger` — money flows
