# Blackjack — Game Specification

**Status:** Accepted v1.0
**Last updated:** 2026-05-03
**Owner:** Oakley
**Audience:** Engineering, certification labs, players

---

## 0. Purpose

Define rules and math for the Blackjack game. The most complex single-player game on the platform — a real state machine where the player makes multiple decisions per round (hit, stand, double, split). Multi-action lifecycle similar to Mines but with branching state (splits create multiple parallel hands).

---

## 1. Rules summary

The dealer deals two cards to the Player and two cards to the Dealer. The Dealer's first card is face-up; the second is face-down ("hole card"). Each card has a value:

| Rank        | Value                     |
| ----------- | ------------------------- |
| Ace         | 1 or 11 (whichever helps) |
| 2–9         | face value                |
| 10, J, Q, K | 10                        |

The hand total is the sum of card values. If the total exceeds 21 — **bust** — the hand loses immediately. If a hand contains an Ace counted as 11, it's a "soft" hand (the ace can revert to 1 if a hit would otherwise bust).

**Goal:** beat the Dealer's total without busting.

### 1.1 Player actions

After the initial deal, the Player can take actions on each of their hands:

| Action     | When allowed                           | Effect                                                                                                                                                                               |
| ---------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Stand**  | Always                                 | Hand is final. Move to next hand or dealer phase.                                                                                                                                    |
| **Hit**    | Always (unless busted/bj/standing)     | Draw one more card. Repeat until stand or bust.                                                                                                                                      |
| **Double** | Only on a 2-card hand                  | Stake doubles. Draw exactly one card. Hand auto-stands.                                                                                                                              |
| **Split**  | Only on a 2-card hand of matching rank | Stake doubled (new bet equal to original). Hand becomes two hands, each starting with one of the original cards plus a fresh draw. Each played independently. Maximum 4 hands total. |

**Split-Aces special rule:** after splitting Aces, each new hand receives exactly one card and stands automatically. No further actions.

### 1.2 Dealer behaviour

After all Player hands resolve, the Dealer reveals the hole card and plays:

- **Total ≤ 16:** Dealer hits.
- **Total = 17 with a soft Ace ("soft 17"):** Dealer **hits** (H17 rule).
- **Total ≥ 17 (hard) or ≥ 18 (soft):** Dealer stands.

### 1.3 Settlement

For each Player hand, compare to Dealer's final total:

| Player hand state                             | Dealer state         | Result                              |
| --------------------------------------------- | -------------------- | ----------------------------------- |
| Bust                                          | any                  | Player loses (1× stake)             |
| Blackjack (Ace + 10-value, 2 cards, no split) | Dealer not blackjack | Player wins 3:2 (1.5× stake profit) |
| Blackjack                                     | Dealer blackjack     | Push (refund)                       |
| ≤ 21                                          | Dealer bust          | Player wins 1:1                     |
| ≤ 21, > Dealer                                | Dealer ≤ 21          | Player wins 1:1                     |
| ≤ 21, < Dealer                                | Dealer ≤ 21          | Player loses                        |
| ≤ 21, == Dealer                               | Dealer ≤ 21          | Push (refund)                       |

Notes:

- A hand created by splitting cannot be a "natural" Blackjack — even if the split hand totals 21, it pays 1:1, not 3:2. Standard rule.
- Doubled hands settle exactly like regular hands but at 2× stake.

---

## 2. Math

### 2.1 RTP

With basic strategy and these rules (H17, 6 deck, no surrender, BJ 3:2, double on any 2, split up to 4 hands, split aces 1 card), the theoretical RTP is **~99.55%**, house edge ~0.45%.

We do not penalise sub-optimal play — any player choice is allowed (hitting on 20, standing on 5, etc). The 99.55% RTP assumes basic strategy. Players who deviate get worse RTP.

The infinite-deck simplification (uniform draw with replacement, our model) shifts RTP slightly compared to a finite shoe (what physical casinos use). The shift is < 0.1% in either direction; we treat it as part of the published RTP.

### 2.2 Payout multipliers

| Outcome     | Payout (per hand stake)              |
| ----------- | ------------------------------------ |
| Win         | 2× (1× profit + 1× stake return)     |
| Blackjack   | 2.5× (1.5× profit + 1× stake return) |
| Push        | 1× (refund)                          |
| Loss / bust | 0                                    |

For doubled or split hands, "stake" refers to the per-hand stake (which may have grown via doubling).

---

## 3. State machine

```
┌─────────┐   start   ┌───────┐
│ created │──────────▶│ dealt │
└─────────┘           └───┬───┘
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
         ┌─────────────┐    (player blackjack /
         │ player_turn │     dealer blackjack /
         │ (per hand)  │      no decisions needed)
         └──────┬──────┘
                │  hit / stand / double / split
                ▼
         (per-hand actions until each hand stands or busts)
                │
                ▼
         ┌──────────────┐
         │ dealer_phase │
         └──────┬───────┘
                ▼
         ┌──────────┐
         │ settled  │
         └──────────┘
```

### 3.1 Action API

- **`startRound(input)`** — places stake, deals 4 cards, transitions to player_turn (or settled if both have blackjack, etc).
- **`hit(roundId, handIndex)`** — draws a card on the specified hand. May bust.
- **`stand(roundId, handIndex)`** — finalises the hand; advances to next hand or dealer phase.
- **`double(roundId, handIndex)`** — debits an additional stake equal to original, draws exactly one card, auto-stands. Only on 2-card hands.
- **`split(roundId, handIndex)`** — debits an additional stake. The hand becomes two hands. Only on 2-card matching-rank hands; max 4 total hands.

When all player hands are finalised (stood, busted, doubled-then-stood, or auto-stood from split-aces), the engine automatically runs the dealer phase and settles.

### 3.2 Idempotency

Every action is idempotent on `(roundId, action_kind, hand_index, action_count)` tuple. Repeating the same action with the same parameters returns the current state without side effects (or throws if the round has moved on).

---

## 4. Bet limits

| Limit                                              | Value                |
| -------------------------------------------------- | -------------------- |
| Minimum stake                                      | 0.01 INTERNAL_USDT   |
| Maximum stake                                      | 1000 INTERNAL_USDT   |
| Maximum total bet per round (after splits/doubles) | 8000 INTERNAL_USDT   |
| Maximum payout per round                           | 12,000 INTERNAL_USDT |

Math: 4 hands max, each potentially doubled = 4 × 2 × 1000 = 8000 max staked. Each hand pays max 2.5× (blackjack), but split hands can't be blackjack, so the max-payout case is doubled non-blackjack wins: 4 × 2 × 1000 × 2 = 16,000. The cap is set conservatively at 12,000 because realistic max-payouts (good cards on doubled splits) cap well under that.

---

## 5. Provable fairness

Every round records the seeds, nonce, and the 32 derived card ranks. The engine consumes cards in order; the verification page can replay the exact sequence given the player's actions to verify the resulting hands.

Because Blackjack involves player decisions, the "verification" is two-step:

1. The cards used by the engine are reproducible from seeds (the standard provably-fair claim).
2. The dealer's plays are mechanical given the cards (the published H17 rules).

The player's own decisions are theirs — the engine just enforces validity.

---

## 6. Edge cases

| Case                                                                         | Behaviour                                                |
| ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| Both Player and Dealer have blackjack                                        | Push (refund)                                            |
| Player has blackjack, Dealer does not                                        | 3:2 payout                                               |
| Player blackjack on a split hand                                             | Counts as regular 21, pays 1:1                           |
| Hit on 21                                                                    | Allowed (player can self-bust); engine doesn't intervene |
| Hit after stand                                                              | Rejected at API                                          |
| Action on a finalised round                                                  | Rejected with terminal-state error                       |
| Action on a hand that already busted/stood                                   | Rejected                                                 |
| Split when hand is not eligible (3+ cards, mismatched ranks, max splits hit) | Rejected                                                 |
| Double when hand is not eligible (3+ cards, insufficient balance)            | Rejected                                                 |

---

## 7. What's deferred (not v1)

- **Insurance** — side bet on dealer blackjack when dealer shows Ace. Niche; defer.
- **Surrender** (early or late) — give up half the stake. Defer.
- **Multi-hand blackjack** at the table layer (player playing multiple parallel rounds) — defer. v1 is one round at a time.
- **Card counting concerns** — irrelevant given our infinite-deck model.
- **Side bets** (Perfect Pairs, 21+3, etc.) — defer.

---

## 8. Test plan

- **Card math:** value of each rank, hand total with/without aces (soft/hard), bust detection, blackjack detection.
- **Dealer rules:** every soft/hard total triggers correct hit/stand decision (H17 rules).
- **Action validation:** double rejected on 3-card hands, split rejected on mismatched ranks, etc.
- **Engine integration:** known-seed rounds produce predictable outcomes; idempotency on every action; balance changes match settlement math.
- **Split mechanics:** splitting a pair creates two hands, each playable independently; split-Aces auto-stand; max 4 hands.
- **Blackjack vs split-21:** natural blackjack pays 3:2; split hand totaling 21 pays 1:1.
- **RTP:** simulate basic-strategy plays at scale, verify RTP within tolerance of 99.55%.

100% coverage on `cards.ts`, `dealer.ts`, `engine.ts`.

---

## 9. Document changelog

| Version | Date       | Author          | Change        |
| ------- | ---------- | --------------- | ------------- |
| 1.0     | 2026-05-03 | Oakley + Claude | Initial draft |

**End of document.**
