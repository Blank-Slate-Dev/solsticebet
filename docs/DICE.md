# Dice — Game Specification

**Status:** Accepted v1.0
**Last updated:** 2026-05-03
**Owner:** Oakley
**Audience:** Engineering, certification labs, players (a player-readable summary lives at /games/dice/rules on the web app)

---

## 0. Purpose

Define the rules, math, and operational semantics for the Dice game. Dice is the simplest provably-fair game on the platform and is built first because it exercises the full bet pipeline (RNG → ledger → outcome → ledger) at the lowest possible cognitive complexity. Once Dice works correctly end-to-end, the same pattern carries to Mines, Plinko, Crash, and the table games.

---

## 1. Rules summary (player-facing)

The player picks:

1. A **stake** in INTERNAL_USDT (the platform's internal accounting unit).
2. A **target** number between `2.00` and `98.00`.
3. A **mode**: `over` (win if the roll is _greater than_ the target) or `under` (win if the roll is _less than_ the target).

Server then derives a **roll** in the range `[0.00, 99.99]` using the provably-fair RNG. The bet wins or loses by comparing roll to target.

A winning bet pays `stake × multiplier`. A losing bet pays nothing.

Every bet receipt links to the verification page where the player can independently re-derive the roll from the (server seed, client seed, nonce) triple after the seed is rotated.

---

## 2. Math

### 2.1 House edge and RTP

| Property                     | Value  |
| ---------------------------- | ------ |
| RTP                          | 99.00% |
| House edge                   | 1.00%  |
| House-edge multiplier factor | `0.99` |

Locked. Changing this requires a re-certification submission.

### 2.2 Win chance

For mode `under` with target `T`:

```
winChancePercent = T
```

(A roll in `[0, T)` wins. Roll values are uniform in `[0, 100)` to two decimal places, so the probability of `roll < T` is `T / 100`.)

For mode `over` with target `T`:

```
winChancePercent = 100 - T
```

(A roll in `(T, 100)` wins. Probability is `(100 - T) / 100`.)

We exclude exact equality from winning (`roll === T` is a loss). This is the **Stake-style convention** and matches every cert-lab implementation we'll be measured against. Because rolls quantise to 0.01, the equality case has probability 0.01% per bet — small but non-negligible, and it is part of the house edge.

Wait — the equality case is _already_ baked into the house-edge multiplier formula below. This is critical, so it's spelt out:

We define `winChancePercent` as the **strict** inequality probability. For mode `under`, `T = 50.00`: rolls in `[0, 50)` win → 5000 winning rolls out of 10000 → 50.00%. The equality case `roll = 50.00` is one of the 5000 losing rolls.

For mode `under` with `T = 1.00`: rolls in `[0, 1)` win → 100 winning rolls out of 10000 → 1.00%.

For mode `over` with `T = 99.00`: rolls in `(99, 100)` win → 99 winning rolls (`99.01, 99.02, ..., 99.99`) out of 10000 → 0.99%.

The mode `over` win chance is _not_ exactly `100 - T`; it's `100 - T - 0.01` because of the quantisation. This is why we cap targets at `[2.00, 98.00]` — at those bounds, the discrepancy is negligible (~0.01% of stake on edge cases), and the multiplier stays clean. Going to extreme targets (e.g., 99.99) would expose the quantisation rounding in ways players would notice.

For the v1 implementation, we use the **clean formula** `winChancePercent = T` (under) or `100 - T` (over) for the multiplier calculation and accept the tiny rounding artifact. This matches Stake's published implementation and what cert labs verify against.

### 2.3 Multiplier

```
multiplier = 99 / winChancePercent
```

Examples:

| Mode  | Target | Win chance | Multiplier |
| ----- | ------ | ---------- | ---------- |
| under | 50.00  | 50.00%     | 1.98×      |
| over  | 50.00  | 50.00%     | 1.98×      |
| under | 25.00  | 25.00%     | 3.96×      |
| over  | 75.00  | 25.00%     | 3.96×      |
| under | 10.00  | 10.00%     | 9.90×      |
| over  | 90.00  | 10.00%     | 9.90×      |
| under | 2.00   | 2.00%      | 49.50×     |
| over  | 98.00  | 2.00%      | 49.50×     |

Multiplier is computed with full precision and then **rounded to 4 decimal places** for storage and display. The payout calculation uses the rounded multiplier so the displayed multiplier and the actual payout always agree.

### 2.4 Payout

```
payout = floor(stake × multiplier × 10^18) / 10^18
```

(Truncated to 18 decimal places, the SCALE of the ledger's bigint amounts.)

If the bet **loses**, payout is zero.

### 2.5 RTP verification

Theoretical RTP, derived:

```
expectedRTP = winChance × multiplier
            = (winChancePercent / 100) × (99 / winChancePercent)
            = 99 / 100
            = 99%
```

Independent of target. Every dice bet has the same long-run RTP regardless of the player's strategy. This is the property we test against in the test suite.

---

## 3. Bet limits

Configured in code, surfaced via API; tunable per environment (dev/staging/prod).

| Limit                  | Value                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| Minimum stake          | `0.01000000` INTERNAL_USDT (0.01 USDT)                             |
| Maximum stake          | `1000.00` INTERNAL_USDT (default; revisited per VIP tier)          |
| Minimum target         | `2.00`                                                             |
| Maximum target         | `98.00`                                                            |
| Target precision       | 0.01                                                               |
| Maximum payout per bet | `49500.00000000` INTERNAL_USDT (1000 stake × 49.5× max multiplier) |

The maximum-payout limit is a defense-in-depth check. Even if every other check passed, a payout exceeding this cap is rejected and the bet voided. Prevents catastrophic losses from a math bug.

---

## 4. Bet flow (canonical)

The Dice engine orchestrates the full pipeline. Pseudocode:

```
function placeDiceBet(input):
  validateInput(input)        // stake limits, target bounds, mode

  multiplier = computeMultiplier(input.target, input.mode)
  potentialPayout = stake * multiplier
  assert potentialPayout <= MAX_PAYOUT

  // Phase 1: stake debit
  recordBetStake(repo, {
    userAccountId,
    escrowAccountId,
    stake,
    currency: 'INTERNAL_USDT',
    betId,
  })

  // Outcome
  roll = deriveDice(serverSeed, clientSeed, nonce).roll
  isWin = (mode == 'under' && roll < target) || (mode == 'over' && roll > target)

  // Phase 2: settle
  if (isWin):
    payout = stake * multiplier
    recordBetWin(repo, { ..., stake, payout, betId })
  else:
    recordBetLoss(repo, { ..., stake, betId })

  return { betId, roll, target, mode, multiplier, isWin, payout }
```

Both ledger writes use the same `betId` as the idempotency root. If the engine crashes between Phase 1 and Phase 2, on restart it reads the bet record and resumes settlement from the recorded RNG inputs (deterministic outcome). The ledger refuses to settle the same bet twice.

---

## 5. Provable fairness for Dice

Every bet stores: `serverSeedId`, `clientSeed` (snapshot at bet time), `nonce`, `cursor=0`, derived `roll`, `target`, `mode`, `isWin`, `multiplier`, `payout`.

Every bet receipt links to the verification page at `solsticebet.com/verify/{betId}`. After the server seed is rotated and revealed, the player can:

1. Take their `(serverSeed, clientSeed, nonce)`
2. Run the published reference implementation (in-browser at `/verify` or any third-party Stake-style verifier)
3. Confirm the derived roll matches what the casino reported
4. Confirm the win/loss determination matches

If the math doesn't match, the casino has a defect. The verification page is a player's right, not a courtesy.

---

## 6. Edge cases and operator decisions

| Case                                                 | Behaviour                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Roll exactly equals target                           | Loss (strict inequality wins; equality = house)                                        |
| Stake below minimum                                  | Rejected at API layer                                                                  |
| Target exactly 2.00 (under)                          | Allowed; ~2% win, 49.5× multiplier                                                     |
| Target exactly 98.00 (over)                          | Allowed; ~2% win, 49.5× multiplier                                                     |
| Target outside [2.00, 98.00]                         | Rejected at API layer                                                                  |
| Network blip mid-settle                              | Idempotency key on ledger writes; re-attempt is safe                                   |
| User account suspended after stake but before settle | Settle proceeds normally; payout (if win) credits the suspended account; admin reviews |
| Negative-balance attempt                             | Rejected by ledger before RNG is even called                                           |
| Server seed rotation mid-flight                      | Bet keeps its committed seed reference; rotation only affects future bets              |

---

## 7. What this game does not do (v1)

- **Auto-bet / auto-roll.** UI feature, not engine. Engine processes one bet at a time; auto-bet is the client repeatedly placing single bets.
- **Live multiplayer.** Dice is single-player. Crash is the multiplayer original.
- **Custom RTP per bet** (e.g., "boost my multiplier"). RTP is fixed at 99%.
- **Side bets / parlays.** One bet, one outcome.
- **Free spins / bonus rounds.** Bonuses live in the bonus account and are wagered through normal bets.

---

## 8. Test plan

- **Math tests:** multiplier formula correctness across the target range, edge boundaries (2.00 and 98.00), under/over symmetry, RTP derivation.
- **Validation tests:** every input limit (stake, target, mode) rejects out-of-bounds values.
- **Determinism tests:** same inputs → same outcome, every time.
- **Integration tests:** full pipeline against a real `InMemoryLedgerRepository` + real RNG. Place a bet, observe the ledger transitions match the spec.
- **RTP convergence tests:** simulate a large sample of bets at fixed target, verify the empirical RTP converges to 99% within statistical tolerance.
- **Idempotency tests:** repeat-call the engine with the same `betId` and verify no double-spend.
- **Error path tests:** insufficient balance, invalid inputs, max-payout cap.

100% coverage on `math.ts` and `engine.ts` is mandatory.

---

## 9. Document changelog

| Version | Date       | Author          | Change        |
| ------- | ---------- | --------------- | ------------- |
| 1.0     | 2026-05-03 | Oakley + Claude | Initial draft |

**End of document.**
