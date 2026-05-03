# @solsticebet/game-sicbo

Sic Bo dice game engine. Three six-sided dice, ~97.2% RTP on the lowest-edge bets.

See `docs/SICBO.md` for the spec.

## Public API

- `placeSicBoRoll(ledger, input)` — full multi-bet pipeline
- `winMultiplierFor(type, target, dice)` — win predicate + payout
- `TOTAL_PAYOUTS`, `FIXED_PAYOUTS`, `maxWinMultiplier` — pay tables and helpers
- `computePayout(stake, multiplier)` — gross payout
- Validators and constants

## Dependencies

- `@solsticebet/rng` — derives 3 dice
- `@solsticebet/ledger` — money flows
