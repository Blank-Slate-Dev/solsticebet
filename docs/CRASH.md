# Crash — Game Specification (single-player v1)

**Status:** Accepted v1.0
**Last updated:** 2026-05-03
**Owner:** Oakley
**Audience:** Engineering, certification labs, players

---

## 0. Purpose

Define rules and math for the single-player version of Crash. Multiplayer Crash (where many players watch a shared multiplier curve climb in real time) is the eventual production target; this v1 implements the same provably-fair bust math and per-bet ledger flow, but each round is one player against the house.

When the multiplayer game-server is built later, it will wrap this engine with a real-time round coordinator. The bust math, RNG derivation, ledger recipe, validation, and idempotency are all reusable as-is. Only the round-coordinator lifecycle and WebSocket broadcasting are added on top.

---

## 1. Rules summary

The player picks:

1. A **stake** in INTERNAL_USDT.
2. An **auto-cash-out multiplier** (e.g., 2.00× — meaning "I'll cash out if the multiplier reaches 2.00").

The server derives a **bust multiplier** via the RNG. If `bustAt >= autoCashOut`, the player wins at their auto-cash-out multiplier. Otherwise the player loses.

Visually (in the UI), the multiplier "climbs" from 1.00× toward the bust point — but the outcome is already determined when the bet is placed. The animation is cosmetic. The cert lab knows this; it's standard for non-live Crash implementations.

---

## 2. Math

### 2.1 RTP and house edge

| Property   | Value |
| ---------- | ----- |
| RTP        | ~97%  |
| House edge | ~3%   |

The 3% edge comes from the 1/33 probability that any round busts at exactly 1.00× — the floor outcome where every active bet loses regardless of cash-out target.

### 2.2 Bust distribution

The RNG produces `bustAt` via `deriveCrash` (see `docs/RNG.md` § 3.3 / `packages/rng/src/games.ts`). The distribution is:

- ~3% of rounds: `bustAt = 1.00` (instant bust; everyone loses)
- Remaining 97%: `bustAt = floor((100 * 2^32 - h) / (2^32 - h)) / 100` where `h` is the first 4 HMAC bytes as uint32. This yields a long-tail distribution with most values clustered near 1.00× and rare values reaching 100× or higher.

### 2.3 Win condition and payout

```
if bustAt >= autoCashOut:
  player wins
  payout = stake * autoCashOut    // gross payout including stake return
else:
  player loses
  payout = 0
```

Multipliers are stored to 2 decimal places. The payout formula uses the multiplier directly:

```
payout = floor(stake * autoCashOut * 100) / 100
```

In bigint terms with our 18-decimal scale: `payout = stake * (autoCashOut * 100 as bigint) / 100n`, with appropriate scaling. The Crash engine uses the same `computePayout(stake, multiplier)` helper as Dice/Mines/Plinko/Roulette/Baccarat for consistency.

---

## 3. Bet limits

| Limit                  | Value                            |
| ---------------------- | -------------------------------- |
| Minimum stake          | 0.01 INTERNAL_USDT               |
| Maximum stake          | 1000 INTERNAL_USDT               |
| Minimum auto-cash-out  | 1.01×                            |
| Maximum auto-cash-out  | 1,000,000× (matches RNG ceiling) |
| Maximum payout per bet | 100,000 INTERNAL_USDT            |

The maximum-payout cap is defence in depth. With max stake 1000 × max multiplier 1,000,000 = 1,000,000,000 USDT theoretical max; the cap at 100,000 means realistic play with high multipliers is allowed but absurd combinations (huge stake × huge multiplier) are rejected.

---

## 4. Bet flow

Single-action, like Dice. Same shape as Roulette/Baccarat without the multi-bet aggregation:

```
function placeCrashBet(input):
  validate(input)         // stake limits, auto-cash-out bounds, max-payout cap

  // Phase 1: stake debit
  recordBetStake(repo, { stake, betId })

  // Outcome
  bustAt = deriveCrash(serverSeed, clientSeed, nonce)
  isWin = bustAt >= autoCashOut

  // Phase 2: settle
  if isWin:
    payout = stake * autoCashOut
    recordBetWin(repo, { stake, payout, betId })
  else:
    recordBetLoss(repo, { stake, betId })

  return { betId, bustAt, autoCashOut, isWin, payout }
```

---

## 5. Provable fairness

Every bet records the seeds, nonce, derived `bustAt`, the player's `autoCashOut`, and the resolution. The verification page lets the player re-derive `bustAt` after the seed is rotated and confirm the outcome.

---

## 6. Edge cases

| Case                                        | Behaviour                     |
| ------------------------------------------- | ----------------------------- |
| `autoCashOut === bustAt` exactly            | Player wins (≥ comparison)    |
| Auto-cash-out below MIN_AUTO_CASHOUT (1.01) | Rejected at API               |
| Auto-cash-out above MAX_AUTO_CASHOUT        | Rejected at API               |
| Stake × auto-cash-out > MAX_PAYOUT          | Rejected at API               |
| Idempotent replay on same betId             | Same outcome, no double-spend |

---

## 7. What this game does NOT do (v1)

- **Real-time multiplayer** — many players, shared round, watch curve together. Deferred to game-server build.
- **Manual cash-out during the climb** — single-player Crash uses auto-cash-out only; the outcome is decided at bet time. In multiplayer, players will be able to click cash out mid-climb.
- **Bet-during-betting-window** — there's no "betting window" in single-player.
- **Round history shared across players** — single-player histories belong only to the player.

These aren't workarounds; they're scope choices. When we build the multiplayer layer, the engine continues to do what it does (resolve a single bet against a derived bust point), and the round coordinator coordinates _which_ nonce all clients see for any given round.

---

## 8. Test plan

- **Math tests:** payout calculation, RTP property, win/loss boundary at exact equality.
- **Validation tests:** all input limits.
- **Engine integration:** known-seed bets produce predictable outcomes; balance change matches math.
- **Idempotency tests.**
- **RTP convergence tests:** large sample at fixed auto-cash-out, RTP within tolerance of theoretical.

100% coverage on `math.ts`, `engine.ts`.

---

## 9. Document changelog

| Version | Date       | Author          | Change        |
| ------- | ---------- | --------------- | ------------- |
| 1.0     | 2026-05-03 | Oakley + Claude | Initial draft |

**End of document.**
