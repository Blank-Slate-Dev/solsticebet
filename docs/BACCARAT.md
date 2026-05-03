# Baccarat — Game Specification

**Status:** Accepted v1.0
**Last updated:** 2026-05-03
**Owner:** Oakley
**Audience:** Engineering, certification labs, players

---

## 0. Purpose

Define rules and math for the Punto Banco variant of Baccarat — the standard variant in casinos worldwide. The simplest table game to engineer because the player makes no decisions after placing the bet: cards are dealt, the tableau (drawing rules) is mechanical, and one of three outcomes settles all bets.

---

## 1. Rules summary

The dealer deals two hands: **Player** and **Banker**. Each hand starts with two cards. Card values:

| Card        | Point value |
| ----------- | ----------- |
| Ace         | 1           |
| 2–9         | face value  |
| 10, J, Q, K | 0           |

Hand total = sum of point values **modulo 10**. So a hand of (7, 8) has total 5, not 15.

After the first two cards each, the **tableau** determines whether either or both hands draw a third card. After all drawing, the higher total wins. Tie if equal.

The player bets on **Player**, **Banker**, or **Tie** before any cards are dealt.

---

## 2. Math

### 2.1 Bet types and payouts

| Bet    | Pays                   | True probability | House edge |
| ------ | ---------------------- | ---------------- | ---------- |
| Player | 1:1                    | ~44.62%          | 1.24%      |
| Banker | 0.95:1 (5% commission) | ~45.86%          | 1.06%      |
| Tie    | 8:1                    | ~9.52%           | 14.36%     |

The 5% commission on Banker exists because Banker's drawing rules give it a small edge; without commission, Banker would have negative house edge. The 0.95:1 payout cancels that edge and leaves a small house take.

### 2.2 The tableau (drawing rules)

After the first 2 cards each, totals are evaluated:

**Natural:** if either Player or Banker has 8 or 9 on their first two cards, both hands stand. No more cards. (Highest total wins; tie is possible.)

If neither hand is a natural:

**Player draws first:**

- If Player total is 0–5: Player draws a third card.
- If Player total is 6–7: Player stands.

**Banker drawing logic** (depends on whether Player drew, and if so what Player's third card was):

| Banker's first-two total | Banker's action                         |
| ------------------------ | --------------------------------------- |
| 0, 1, 2                  | Always draws                            |
| 3                        | Draws unless Player's third card was 8  |
| 4                        | Draws if Player's third card was 2–7    |
| 5                        | Draws if Player's third card was 4–7    |
| 6                        | Draws if Player's third card was 6 or 7 |
| 7                        | Always stands                           |
| 8, 9                     | (Already a natural — covered above)     |

If Player stood (no third card), Banker uses the simple rule: 0–5 draw, 6–7 stand.

This is the **Punto Banco tableau**, fixed and standard worldwide.

### 2.3 Payout formulas

```
Player wins → bet pays 2× stake (1:1 + return stake)
Banker wins → bet pays 1.95× stake (0.95:1 + return stake; commission baked in)
Tie        → bet pays 9× stake (8:1 + return stake)

Losing Player and Banker bets when the other side wins → forfeit
A Tie outcome refunds Player and Banker bets at 1× (push), since they neither won nor lost
```

Wait — I should clarify the push rule. There are two operator conventions:

- **Push convention:** Tie outcome refunds Player/Banker stakes (loses nothing). House edge on Player/Banker bets remains unchanged because the push is already factored into the probability calculations.
- **Loss convention:** Tie outcome forfeits Player/Banker stakes entirely. This significantly worsens the house edge from the published 1.24%/1.06%.

We use the **push convention** because it matches the published RTP figures and is what most casinos use. Implementation: on Tie, Player and Banker bets settle as `bet_refund` (full stake back); only the Tie bet pays at 8:1.

### 2.4 Banker commission

The 5% commission is built into the payout: Banker bet stake × 1.95 = `0.95 × stake (winnings) + stake (returned)`. We implement this directly without a separate commission line item to keep the ledger simple.

A tiny rounding note: 0.95 isn't representable exactly in our 4-decimal multiplier scheme (`0.9500`), but it is — `0.95 × 10000 = 9500` exactly. So no rounding error.

---

## 3. Bet limits

| Limit                        | Value                                       |
| ---------------------------- | ------------------------------------------- |
| Minimum stake per bet        | 0.01 INTERNAL_USDT                          |
| Maximum stake per bet        | 1000 INTERNAL_USDT                          |
| Maximum total stake per coup | 5,000 INTERNAL_USDT                         |
| Maximum payout per coup      | 50,000 INTERNAL_USDT (factoring in 8:1 Tie) |
| Maximum bets per coup        | 3 (one each of Player, Banker, Tie at most) |

We allow at most one of each bet type — placing two Banker bets simultaneously is operationally meaningless (they'd settle identically) and confusing.

---

## 4. Hand flow

A "coup" is a single hand of Baccarat — a transaction with up to 3 bets atomically committed.

```
function placeBaccaratCoup(input):
  validate(input)
  totalStake = sum of bet stakes

  // Phase 1: stake debit
  recordBetStake(repo, { stake: totalStake, betId: coupId })

  // Deal
  cards = deriveBaccarat(serverSeed, clientSeed, nonce)
  hand = playTableau(cards)  // returns { player, banker, playerTotal, bankerTotal, winner }

  // Settle each bet against winner
  totalPayout = 0
  for each bet in input.bets:
    if (bet.type === winner) totalPayout += bet.stake * (multiplier + 1)
    else if (winner === 'tie' AND bet.type IN ['player', 'banker']) totalPayout += bet.stake  // push
    else /* loss */: nothing

  // Phase 2: settle (branch on totalPayout vs totalStake)
  // Same recipe pattern as Roulette/Plinko.

  return { coupId, hand, perBetOutcomes, totalPayout }
```

---

## 5. Provable fairness

Every coup records the seeds, nonce, and the 6 derived card ranks. The verification page derives the same cards, runs the tableau, and confirms the casino's reported outcome matches.

---

## 6. Edge cases

| Case                                    | Behaviour                                    |
| --------------------------------------- | -------------------------------------------- |
| Same bet type queued twice              | Rejected at API                              |
| Tie with both Player+Banker bets queued | Both refunded; Tie bet (if any) wins at 8:1  |
| Tableau short-circuits on natural       | Engine emits only 4 cards in the hand record |
| Idempotent replay                       | Same coupId → same outcome, no double-spend  |

---

## 7. Test plan

- **Card math:** point values, hand totals (mod 10), naturals.
- **Tableau:** every cell of the published Banker drawing-rules table is exercised.
- **Engine integration:** known-seed coups produce expected (winner, totals); single-bet wins/losses settle correctly; multi-bet coups (P + B + T) settle each bet's outcome separately.
- **Push semantics:** Tie outcome refunds non-Tie bets at exactly stake.
- **Idempotency:** same coupId is a no-op replay.
- **RTP convergence:** large-sample simulation, each bet type's empirical RTP matches its theoretical value within tolerance.

100% coverage on `cards.ts`, `tableau.ts`, `math.ts`, `engine.ts`.

---

## 8. Out of scope (v1)

- **Side bets** (Dragon Bonus, Pairs, Big/Small, etc.) — defer.
- **EZ Baccarat / no-commission variants** — tableau differs slightly on Banker 6 with 3 cards; defer.
- **Squeeze / live dealer presentation** — UI feature, not engine.
- **Card counting / shoe-dependent dealing** — the spec deals each coup independently from a fresh "deck" via the RNG. Real casinos use a 6/8-deck shoe and deal until cut, which gives skilled players a tiny edge. Our model is simpler and fairer to occasional players; it's the standard approach for online Baccarat.

---

## 9. Document changelog

| Version | Date       | Author          | Change        |
| ------- | ---------- | --------------- | ------------- |
| 1.0     | 2026-05-03 | Oakley + Claude | Initial draft |

**End of document.**
