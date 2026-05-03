# @solsticebet/game-blackjack

Blackjack engine. H17, 6-deck (modeled), BJ pays 3:2, double on any 2, split up to 4 hands. ~99.5% RTP at basic strategy.

See `docs/BLACKJACK.md` for the spec.

## Public API

- `startRound(ledger, rounds, input)` — start a round
- `hit / stand / doubleDown / split (ledger, rounds, roundId)` — player actions
- `playDealer(cards, shoe, cursor)`, `dealerShouldHit(cards)` — dealer logic
- `handTotal(cards)`, `cardValue(rank)`, `isBlackjack(cards)`, `canSplit(cards)` — card math
- `computeWinPayout(stake, isBlackjack)` — payouts
- `InMemoryBlackjackRoundRepository` — repo for tests; production impl in @solsticebet/db

## Dependencies

- `@solsticebet/rng` — pre-derives the 32-card shoe
- `@solsticebet/ledger` — money flows
