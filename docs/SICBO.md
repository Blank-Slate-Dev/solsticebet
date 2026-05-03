# Sic Bo — Game Specification

**Status:** Accepted v1.0
**Last updated:** 2026-05-03
**Owner:** Oakley
**Audience:** Engineering, certification labs, players

---

## 0. Purpose

Define rules and math for Sic Bo. A traditional Asian dice game now standard at every major crypto casino. Three six-sided dice are rolled simultaneously; players bet on the outcome. Same multi-bet single-action shape as Roulette, scaled down to 216 possible outcomes (6³).

---

## 1. Rules summary

The dealer rolls three standard six-sided dice. The player can place any number of bets across many bet types before the roll. After the roll, every bet settles against the single result.

---

## 2. Math

### 2.1 Outcomes

Three independent uniform 1-6 dice produce 216 ordered outcomes (6³) or 56 distinct multisets when order doesn't matter. The total ranges from 3 (1-1-1) to 18 (6-6-6).

### 2.2 Bet types and payouts

We support the standard bet table used by Stake-derivative crypto casinos:

| Bet                           | Win condition                                                  | Payout (winnings:1) | House edge |
| ----------------------------- | -------------------------------------------------------------- | ------------------- | ---------- |
| **Small**                     | Total 4–10, no triple                                          | 1                   | 2.78%      |
| **Big**                       | Total 11–17, no triple                                         | 1                   | 2.78%      |
| **Even**                      | Total even, no triple                                          | 1                   | 2.78%      |
| **Odd**                       | Total odd, no triple                                           | 1                   | 2.78%      |
| **Total = 4**                 | Sum equals 4                                                   | 60                  | 15.28%     |
| **Total = 5**                 | Sum equals 5                                                   | 30                  | 13.89%     |
| **Total = 6**                 | Sum equals 6                                                   | 17                  | 16.67%     |
| **Total = 7**                 | Sum equals 7                                                   | 12                  | 9.72%      |
| **Total = 8**                 | Sum equals 8                                                   | 8                   | 12.50%     |
| **Total = 9**                 | Sum equals 9                                                   | 6                   | 18.98%     |
| **Total = 10**                | Sum equals 10                                                  | 6                   | 12.50%     |
| **Total = 11**                | Sum equals 11                                                  | 6                   | 12.50%     |
| **Total = 12**                | Sum equals 12                                                  | 6                   | 18.98%     |
| **Total = 13**                | Sum equals 13                                                  | 8                   | 12.50%     |
| **Total = 14**                | Sum equals 14                                                  | 12                  | 9.72%      |
| **Total = 15**                | Sum equals 15                                                  | 17                  | 16.67%     |
| **Total = 16**                | Sum equals 16                                                  | 30                  | 13.89%     |
| **Total = 17**                | Sum equals 17                                                  | 60                  | 15.28%     |
| **Any triple**                | Any three-of-a-kind                                            | 30                  | 13.89%     |
| **Specific triple** (1-6)     | All three dice = target                                        | 180                 | 16.20%     |
| **Specific double** (1-6)     | At least 2 dice = target                                       | 10                  | 18.52%     |
| **Two-dice combo** (e.g. 1+2) | Both target faces appear in the roll                           | 5                   | 16.67%     |
| **Single die** (1-6)          | Pays per matching die: 1 die → 1:1, 2 dice → 2:1, 3 dice → 3:1 | varies              | 7.87%      |

The Big/Small/Even/Odd bets at 2.78% are the lowest-house-edge bets; Specific triples are the worst at 16.20%. Player choice; the house always wins on average.

### 2.3 Big/Small/Even/Odd and triples

These four "even-money" bets all **lose on triples** regardless of hitting their condition. So Big (11-17) loses on triple-6, even though 6+6+6 = 18 is outside the range anyway; more importantly, Small (4-10) loses on triple-1 (1+1+1 = 3 is outside range, but the rule explicitly excludes any triple). The exclusion is documented; cert labs accept it.

Even/Odd lose on triples even if the parity matches.

### 2.4 Specific double payout

A **specific double** bet on, say, 5 wins if at least two of the three dice show 5. Triple-5 also pays the double bet (you have at least two 5s). The bet does not stack — you receive 10:1 once, regardless of two or three 5s.

### 2.5 Two-dice combo

A **two-dice combo** bet on (e.g.) "1 and 2" wins if the roll contains at least one 1 AND at least one 2. So rolls like 1-2-X or 1-2-2 or 2-1-1 all win. The bet pays once regardless of how many matching dice.

### 2.6 Single die ("Single number") payout

A single-die bet on (e.g.) 4 pays based on how many dice show 4:

- 0 dice show 4 → loss
- 1 die shows 4 → 1:1
- 2 dice show 4 → 2:1
- 3 dice show 4 (triple-4) → 3:1

Note: the triple-4 case also wins separately on the "Any triple" and "Specific triple 4" bets if the player has those bets.

---

## 3. Bet limits

| Limit                    | Value                 |
| ------------------------ | --------------------- |
| Min stake per bet        | 0.01 INTERNAL_USDT    |
| Max stake per bet        | 1,000 INTERNAL_USDT   |
| Max total stake per roll | 10,000 INTERNAL_USDT  |
| Max bets per roll        | 100                   |
| Max payout per roll      | 200,000 INTERNAL_USDT |

The 200k payout cap covers a max-stake specific-triple bet (1000 × 180 = 180k) plus other smaller wins simultaneously.

---

## 4. Bet flow

Same shape as Roulette/Baccarat. Multi-bet, single derivation, atomic settlement.

```
function placeSicBoRoll(input):
  validate(input)        // every bet's type, target, stake
  totalStake = sum of bet stakes

  // Phase 1: stake debit
  recordBetStake(repo, { stake: totalStake, betId: rollId })

  // Outcome
  dice = deriveSicBo(serverSeed, clientSeed, nonce)

  // Settle each bet
  totalPayout = 0
  for each bet:
    if bet wins: totalPayout += stake * (winMultiplier + 1)

  // Phase 2: settle (branch on totalPayout vs totalStake)

  return { rollId, dice, perBetOutcomes, totalPayout }
```

---

## 5. Provable fairness

Every roll records the seeds, nonce, and the three derived dice values. Verification is straightforward.

---

## 6. Edge cases

| Case                                         | Behaviour                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Triple on Big/Small/Even/Odd                 | Bet loses regardless                                                                        |
| Specific triple bet on a non-matching triple | Loses                                                                                       |
| Empty bets array                             | Rejected at API                                                                             |
| Same bet type+target queued twice            | Allowed (two stakes, settle independently). Some operators reject; we allow for simplicity. |
| Idempotent replay                            | Same rollId → same outcome, no double-spend                                                 |

---

## 7. Test plan

- **Win predicates:** every bet type correctly determines win/loss across all 216 dice combinations.
- **Pay tables:** matching the published reference (Stake/Roobet).
- **Engine integration:** known-seed rolls produce predictable balances.
- **RTP convergence:** large-sample simulation, RTP within tolerance of theoretical for each bet type.
- **Idempotency.**

100% coverage on `wheel.ts` (bet predicates), `math.ts`, `engine.ts`.

---

## 8. Document changelog

| Version | Date       | Author          | Change        |
| ------- | ---------- | --------------- | ------------- |
| 1.0     | 2026-05-03 | Oakley + Claude | Initial draft |

**End of document.**
