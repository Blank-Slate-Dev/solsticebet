# @solsticebet/game-roulette

European Roulette engine. Single zero, 37 pockets, 97.30% RTP. Multi-bet spins where one wheel result settles N bets atomically.

See `docs/ROULETTE.md` for the spec.

## Public API

- `placeRouletteSpin(ledger, input)` — full multi-bet pipeline
- `colorOf(n)`, `dozenOf(n)`, `columnOf(n)`, `isWinningBet(type, target, result)` — wheel queries
- `computePayout(stake, type)` — gross payout calculator
- `PAYOUTS`, `THEORETICAL_RTP`, `POCKETS` — constants

## Dependencies

- `@solsticebet/rng` — derives the spin result
- `@solsticebet/ledger` — bet stake / win / partial / refund / loss
