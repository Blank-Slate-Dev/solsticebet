# @solsticebet/game-plinko

Plinko game engine. 8/12/16 row counts × low/medium/high risk = 9 multiplier tables. ~99% RTP across all configurations.

See `docs/PLINKO.md` for the spec.

## Public API

- `placePlinkoBet(ledger, input)` — full bet pipeline
- `getTable(rows, risk)`, `multiplierForBucket(rows, risk, bucket)`, `maxMultiplier(rows, risk)`, `rtpFor(rows, risk)` — pure math/lookup
- `assertValidBetInput`, `assertValidRows`, `assertValidRisk`, `assertValidStake` — validation
- `MIN_STAKE`, `MAX_STAKE`, `MAX_PAYOUT`, `ROWS_VALUES`, `RISK_VALUES` — constants

## Dependencies

- `@solsticebet/rng` — derives the path
- `@solsticebet/ledger` — bet stake / win / partial / refund
