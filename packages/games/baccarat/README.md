# @solsticebet/game-baccarat

Punto Banco Baccarat engine. ~98.94% RTP on Banker, ~98.76% on Player, ~85.64% on Tie.

See `docs/BACCARAT.md` for the spec.

## Public API

- `placeBaccaratCoup(ledger, input)` — full multi-bet coup
- `playTableau(cards)` — pure tableau, no I/O
- `pointValueOf(rank)`, `handTotal(cards)` — card math
- `computePayout(stake, type)`, `PAYOUTS` — payouts
- Validators and constants

## Dependencies

- `@solsticebet/rng` — derives the cards
- `@solsticebet/ledger` — money flows
