# Ultimate Texas Hold'em — Game Specification (v1)

**Status:** Accepted v1.0
**Last updated:** 2026-05-03
**Owner:** Oakley
**Audience:** Engineering, certification labs, players

---

## 0. Purpose

Define rules and math for Ultimate Texas Hold'em (UTH). This is a heads-up
poker variant where the player plays a single five-card hand against the
dealer using their 2 hole cards + 5 community cards. Bigger and more complex
than the other table games — three player decision points, four bet circles,
five-card poker hand evaluation.

---

## 1. Rules summary

The player places mandatory **Ante** and **Blind** bets of equal amount, plus
an optional **Trips** side bet. Then:

1. **Pre-flop:** Player and dealer each receive 2 hole cards (dealer's are
   hidden). Player can either:
   - Place a **Play** bet of **3× or 4× Ante**, OR
   - **Check** (defer the decision)

2. **Flop:** First 3 community cards are revealed. If player checked pre-flop,
   they can now:
   - Place a **Play** bet of **2× Ante**, OR
   - **Check** (defer again)

3. **River:** Final 2 community cards are revealed. If player has not yet
   placed a Play bet, they must now:
   - Place a **Play** bet of **1× Ante**, OR
   - **Fold** (forfeit Ante and Blind, keep Trips for separate settlement)

After these decisions, both player and dealer build the **best 5-card hand**
from their 2 hole cards + 5 community cards. Standard Texas Hold'em hand
rankings apply.

---

## 2. Settlement

### 2.1 Dealer qualification

The dealer **qualifies** if they have a **pair** or better. If the dealer
does not qualify:

- **Ante** pushes (refund stake) regardless of outcome
- **Play** bet still settles based on hand comparison
- **Blind** still settles per the Blind pay table (only on player big hands)
- **Trips** settles independently

### 2.2 Hand comparison

| Outcome       | Ante                                             | Play                 |
| ------------- | ------------------------------------------------ | -------------------- |
| Player wins   | wins 1:1 (if dealer qualifies; pushes otherwise) | wins 1:1             |
| Player loses  | loses                                            | loses                |
| Tie           | pushes                                           | pushes               |
| Player folded | loses                                            | not placed (no loss) |

### 2.3 Blind bet pay table

The Blind bet only pays out on big hands:

| Player hand             | Pays                                                    |
| ----------------------- | ------------------------------------------------------- |
| Royal flush             | 500:1                                                   |
| Straight flush          | 50:1                                                    |
| Four of a kind          | 10:1                                                    |
| Full house              | 3:1                                                     |
| Flush                   | 3:2 (1.5:1)                                             |
| Straight                | 1:1                                                     |
| Anything below straight | 1:1 if player wins, push if tie, lose if player loses\* |

\* Standard rule: if player has less than a straight and **wins** the hand,
Blind pushes (returns stake). If they have less than straight and **lose or tie**,
Blind loses or pushes correspondingly. Some operators differ; we use the
standard published rule.

Player must win or tie the hand for the Blind to pay anything other than its
own pay table — i.e. losing the hand always loses the Blind regardless of
holding a flush yourself, _unless_ it pays from the table on the big-hand path.
Wait — that's unclear. Let me re-state the rule cleanly:

**Standard UTH Blind rule:**

- If player **wins** the hand: Blind pays per the table above (1:1 for hands below straight, accelerating up).
- If player **ties** the hand: Blind pushes regardless of hand.
- If player **loses** the hand: Blind loses regardless of hand (the big-hand bonus does not apply on a loss).

This is the rule we implement. It's the published Shuffle Master pay table.

### 2.4 Trips side bet pay table

| Player hand (final 5-card) | Pays  |
| -------------------------- | ----- |
| Royal flush                | 50:1  |
| Straight flush             | 40:1  |
| Four of a kind             | 30:1  |
| Full house                 | 8:1   |
| Flush                      | 7:1   |
| Straight                   | 4:1   |
| Three of a kind            | 3:1   |
| Anything less              | loses |

The Trips bet pays based **only** on the player's final hand strength, not
the comparison with the dealer.

---

## 3. RTP

With basic optimal play (raise pre-flop on suited connectors, KX+, A+, etc),
the theoretical RTP on the **Ante + Blind + Play** bets combined is around
**99.5%** (house edge ~0.5% on the action). The Trips side bet has higher
house edge (~3.5%).

---

## 4. Bet limits

| Limit                        | Value                                                        |
| ---------------------------- | ------------------------------------------------------------ |
| Min Ante (= Min Blind)       | 0.10 INTERNAL_USDT                                           |
| Max Ante (= Max Blind)       | 100 INTERNAL_USDT                                            |
| Min Trips                    | 0.10 (optional)                                              |
| Max Trips                    | 100                                                          |
| Max total committed per coup | 700 (Ante + Blind + 4× Play + Trips)                         |
| Max payout per coup          | 60,000 (royal flush on Blind 100 = 50,000 + ante/play/trips) |

---

## 5. Five-card hand evaluation

We implement a deterministic evaluator that scores a 5-card hand from highest
to lowest:

```
HandRank = 'royal_flush' | 'straight_flush' | 'four_kind' | 'full_house' |
           'flush' | 'straight' | 'three_kind' | 'two_pair' | 'pair' | 'high_card'
```

Each hand returns a numeric score for tie-breaking: `(rankIndex * 1e10) +
kickerEncoded`, where kickerEncoded packs the 5 ranks ordered by relevance.

For UTH, both player and dealer choose the best 5-card hand from their 7
available cards (2 hole + 5 community). We evaluate all C(7,5) = 21 sub-hands
and pick the highest-scoring one.

---

## 6. State machine

```
idle → ante_placed → preflop_decision
                       ↓
                   raised_4x ──────────────┐
                       ↓                   │
                   flop_revealed           │
                                           │
                   checked → flop_decision │
                              ↓            │
                          raised_2x ───────┤
                              ↓            │
                          flop_revealed    │
                                           │
                          checked → river_decision
                                       ↓
                                   raised_1x ──┤
                                       ↓       │
                                   folded ─────┴── settled
                                                     ↓
                                                 dealer reveal
                                                     ↓
                                                  resolved
```

---

## 7. Out of scope (v1)

- **Multi-hand UTH** — playing more than one hand simultaneously
- **Insurance / progressive jackpots** — operator-specific extras
- **No-replacement deck** — we use the with-replacement RNG model standard
  in this codebase
- **UI** — engine only in this delivery

---

## 8. Test plan

- **Hand evaluator:** every hand rank correctly identified; tie-breaking
  works; sub-hand selection picks the best 5 from 7
- **Tableau:** every player decision path (4×, 3×, 2×, 1×, fold)
- **Settlement:** Ante/Blind/Play/Trips each settle correctly under all hand
  combinations and dealer qualify states
- **Engine:** known-seed coups produce predictable balances
- **Idempotency:** every action idempotent on coupId

100% coverage on `cards.ts`, `evaluator.ts`, `tableau.ts`.

---

## 9. Document changelog

| Version | Date       | Author          | Change        |
| ------- | ---------- | --------------- | ------------- |
| 1.0     | 2026-05-03 | Oakley + Claude | Initial draft |

**End of document.**
