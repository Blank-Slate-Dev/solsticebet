# European Roulette — Game Specification

**Status:** Accepted v1.0
**Last updated:** 2026-05-03
**Owner:** Oakley
**Audience:** Engineering, certification labs, players

---

## 0. Purpose

Define the rules and math for the European Roulette game. Single-zero variant. The first table game on the platform — structurally simpler than Mines (single action per spin, no persistent round state) but novel because **a single spin settles multiple bets**: a player can place dozens of bets simultaneously on different bet types and number combinations, and one wheel result determines the outcome of all of them.

---

## 1. Rules summary

The wheel has **37 pockets**, numbered 0 to 36. Pocket 0 is green. The other 36 are alternately red and black per the standard European arrangement.

Each spin, the player can place any number of bets on different positions on the table. When the wheel is spun:

1. The RNG derives a single result (0–36)
2. Every bet is checked: did this number satisfy the bet's win condition?
3. Winning bets pay out at the bet type's locked multiplier; losing bets forfeit their stake

---

## 2. Math

### 2.1 RTP and house edge

| Property          | Value           |
| ----------------- | --------------- |
| Number of pockets | 37              |
| RTP               | 36/37 ≈ 97.297% |
| House edge        | 1/37 ≈ 2.703%   |

The house edge comes entirely from the single zero pocket: every "even-money" bet (red, black, even, odd, etc.) covers 18 of the 37 pockets, not 18 of 36. Every roulette bet has the **same** RTP. The math is identical regardless of which bets the player makes — the house edge is a property of the wheel, not of the bet type.

### 2.2 Bet types and payouts

| Bet type                       | Numbers covered | Payout | Win prob |
| ------------------------------ | --------------- | ------ | -------- |
| `straight` (single number)     | 1               | 35:1   | 1/37     |
| `split` (two adjacent)         | 2               | 17:1   | 2/37     |
| `street` (row of 3)            | 3               | 11:1   | 3/37     |
| `corner` (4 in a square)       | 4               | 8:1    | 4/37     |
| `six_line` (two adjacent rows) | 6               | 5:1    | 6/37     |
| `column`                       | 12              | 2:1    | 12/37    |
| `dozen` (1-12, 13-24, 25-36)   | 12              | 2:1    | 12/37    |
| `red`                          | 18              | 1:1    | 18/37    |
| `black`                        | 18              | 1:1    | 18/37    |
| `even` (2-36 even)             | 18              | 1:1    | 18/37    |
| `odd`                          | 18              | 1:1    | 18/37    |
| `low` (1-18)                   | 18              | 1:1    | 18/37    |
| `high` (19-36)                 | 18              | 1:1    | 18/37    |

Verification: for any bet, `expectedValue = winProb × payout - loseProb × 1 = (n/37) × (37/n × 36/37 - 1) - 1`. After reduction this gives `-1/37` for every bet — house edge of 1/37. RTP = 36/37.

### 2.3 Number colours

Pocket 0 is green. The 36 numbered pockets follow the standard European red/black assignment:

```
Red:   1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
Black: 2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35
```

(Memorisable as: 1–10 and 19–28 follow odd=red/even=black; 11–18 and 29–36 invert the rule.)

### 2.4 Payout computation

For a winning bet:

```
payout = stake × (multiplier + 1)
```

(The +1 returns the original stake along with the winnings. `recordBetWin` in the ledger is given the gross payout including the returned stake.)

For a losing bet, payout is 0 — the stake stays with the house.

---

## 3. Bet limits

| Limit                        | Value                 |
| ---------------------------- | --------------------- |
| Minimum stake per bet        | 0.01 INTERNAL_USDT    |
| Maximum stake per bet        | 1000 INTERNAL_USDT    |
| Maximum total stake per spin | 10,000 INTERNAL_USDT  |
| Maximum bets per spin        | 200                   |
| Maximum payout per spin      | 100,000 INTERNAL_USDT |

The per-spin caps are defence in depth. A player placing 200 straight-up bets at max stake would cover almost every number; their net result is bounded by the math regardless.

---

## 4. Bet flow

A "spin" is a transaction with **N bets** atomically committed. Pseudocode:

```
function placeRouletteSpin(input):
  validate(input)         // every bet's type, target, stake
  totalStake = sum of bet stakes
  assert totalStake within limits

  // Phase 1: debit the entire spin's total stake
  recordBetStake(repo, { stake: totalStake, betId: spinId })

  // Outcome
  result = deriveRoulette(serverSeed, clientSeed, nonce)

  // Compute total payout across all winning bets
  totalPayout = 0
  for each bet in input.bets:
    if bet wins: totalPayout += bet.stake * (multiplier + 1)

  // Phase 2: settle
  if totalPayout > totalStake:  recordBetWin
  elif totalPayout == totalStake: recordBetRefund
  elif totalPayout > 0:          recordBetPartialPayout
  else:                          recordBetLoss

  return { spinId, result, perBetOutcomes, totalPayout }
```

A multi-bet spin maps to a single ledger transaction. We don't write per-bet ledger entries — that would be 200 small entries for one spin and would be terrible for both performance and audit clarity. The bet record table (deferred to `@solsticebet/db`) will store per-bet detail; the ledger only sees the net.

---

## 5. Provable fairness

Every spin records the seeds, nonce, the derived result (0–36), and the full list of bets. After seed rotation, the player can verify:

1. Run `deriveRoulette(serverSeed, clientSeed, nonce)` on the verification page
2. Confirm the result matches what the casino reported
3. Confirm each individual bet's win/loss matches the result

Single-result determinism makes Roulette one of the easiest games to audit.

---

## 6. Edge cases

| Case                                                     | Behaviour                                               |
| -------------------------------------------------------- | ------------------------------------------------------- |
| Bet on number outside [0, 36]                            | Rejected at API                                         |
| Invalid combination (e.g. split on non-adjacent numbers) | Rejected at API; engine validates the bet's target list |
| Empty bet list                                           | Rejected; a spin with no bets is a no-op and confusing  |
| Single bet                                               | Allowed; the multi-bet machinery degrades gracefully    |
| Idempotent replay on same spinId                         | Same result, no double-spend                            |

---

## 7. Test plan

- **Wheel tests:** colour assignment, even/odd, dozen membership, column membership all match the standard European table.
- **Math tests:** every bet type has RTP = 36/37, payout = stake × (multiplier + 1) on win, win predicates are correct for every (bet type, target, result) combination.
- **Bet validation:** every bet type rejects out-of-bounds targets; split rejects non-adjacent pairs.
- **Engine integration:** start with funded user, place a single-bet spin, confirm balance change matches the math.
- **Multi-bet spin:** 5–10 bets with a known seed, verify total payout matches sum of individual bet payouts, ledger gets exactly one stake debit and one settlement entry.
- **Idempotency:** replaying same spinId is a no-op.
- **RTP convergence:** 1000+ random multi-bet spins; total RTP within tolerance of 36/37.

100% coverage on `wheel.ts`, `math.ts`, `engine.ts`.

---

## 8. What's deferred (not v1)

- **Special bets:** "Voisins du Zéro", "Tier", "Orphans" — French-style neighbour bets. Standard European tables include these but they're niche; defer to v1.5.
- **Racetrack betting layout** — UI feature, not engine. Same underlying bet types, just a different layout.
- **La partage / en prison** — half-back rules on even-money bets when zero hits. Reduces house edge to ~1.35%. Some operators offer; we don't in v1 to keep math uniform.

---

## 9. Document changelog

| Version | Date       | Author          | Change        |
| ------- | ---------- | --------------- | ------------- |
| 1.0     | 2026-05-03 | Oakley + Claude | Initial draft |

**End of document.**
