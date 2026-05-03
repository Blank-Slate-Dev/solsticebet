# Mines — Game Specification

**Status:** Accepted v1.0
**Last updated:** 2026-05-03
**Owner:** Oakley
**Audience:** Engineering, certification labs, players (player-readable summary at /games/mines/rules)

---

## 0. Purpose

Define the rules, math, and operational semantics for the Mines game. Mines is the second game on the platform and the first with **persistent in-flight round state**. Where Dice settles in a single request, Mines spans multiple actions over the player's session: place stake → reveal tiles one at a time → cash out (or bust). This makes Mines the test bed for the round-state pattern that Crash will also need.

---

## 1. Rules summary (player-facing)

The player picks:

1. A **stake** in INTERNAL_USDT.
2. A **mine count** between 1 and 24 (out of 25 tiles total).

The server then:

1. Debits the stake from the player's wallet into escrow.
2. Pre-computes a deterministic mine layout via the RNG (Fisher-Yates shuffle of tile indices).
3. The player reveals tiles one at a time:
   - **Safe tile** → the multiplier increases; player can keep picking or cash out.
   - **Mine** → the round busts; stake is lost.
   - **Cash out** at any point with at least one safe tile revealed → player receives `stake × multiplier`.

The full mine layout is committed before the first pick (via the server seed hash). After the round ends, the player can verify the layout was not changed mid-play by deriving it from the published seeds.

---

## 2. Math

### 2.1 House edge and RTP

| Property                     | Value  |
| ---------------------------- | ------ |
| RTP                          | 97.00% |
| House edge                   | 3.00%  |
| House-edge multiplier factor | `0.97` |

Locked. Changing this requires re-certification.

### 2.2 Multiplier formula

Total tiles `T = 25`. Mine count `M ∈ [1, 24]`. Number of safe tiles revealed so far `N ∈ [1, T - M]`.

The probability of successfully revealing `N` safe tiles in a row (without hitting a mine) is:

```
P(safe N out of T-M, given M mines) = C(T-M, N) / C(T, N)
```

The fair (zero-edge) multiplier for that state is:

```
fairMultiplier = 1 / P = C(T, N) / C(T-M, N)
```

Apply the 3% house edge:

```
multiplier = 0.97 × fairMultiplier
```

### 2.3 Worked examples

For verification:

| Mines | Safe revealed (N) | P(safe)                                  | Fair mult | With edge |
| ----- | ----------------- | ---------------------------------------- | --------- | --------- |
| 1     | 1                 | 24/25 = 0.96                             | 1.0417×   | 1.0104×   |
| 1     | 24                | 1/25 = 0.04                              | 25×       | 24.25×    |
| 3     | 1                 | 22/25 = 0.88                             | 1.1364×   | 1.1023×   |
| 3     | 5                 | 22·21·20·19·18 / 25·24·23·22·21 ≈ 0.4956 | 2.0173×   | 1.9568×   |
| 12    | 1                 | 13/25 = 0.52                             | 1.9231×   | 1.8654×   |
| 24    | 1                 | 1/25 = 0.04                              | 25×       | 24.25×    |

The multiplier is **independent of which specific tiles the player picks** — only the count of mines and the count of safe reveals so far matter. This is a property of the symmetric grid and is critical for the math: the player's "skill" is binary (cash out before a mine; the choice of _which_ tile to pick is mathematically irrelevant).

### 2.4 RTP verification

For any mine count `M`, the expected return is `RTP = 97%` regardless of when the player cashes out (provided their cash-out strategy is independent of un-revealed information — which it always is, since revealed safe tiles convey no information about the unrevealed positions).

The math:

```
E[return] = Σ over k=0..(T-M) of P(reveal exactly k safes then bust) × payout(k)
          + Σ over k=1..(T-M) of P(player cashes at k) × stake × mult(k)
```

For any cash-out policy, total `E[return] / stake = 0.97`.

### 2.5 Multiplier rounding

Same convention as Dice: round to 4 decimal places for storage and display. Payout uses the rounded multiplier.

---

## 3. Bet limits

| Limit                    | Value                 |
| ------------------------ | --------------------- |
| Minimum stake            | `0.01` INTERNAL_USDT  |
| Maximum stake            | `1000` INTERNAL_USDT  |
| Minimum mine count       | 1                     |
| Maximum mine count       | 24                    |
| Maximum payout per round | `49500` INTERNAL_USDT |
| Tile count               | 25 (fixed)            |

The maximum-payout cap is defence-in-depth. With M=24 mines and N=1 reveal, the multiplier is 24.25×; max stake × 24.25 = 24,250 — well under the cap. The cap exists so that future tier changes (higher max stake) don't accidentally permit a runaway payout without explicit review.

---

## 4. Round lifecycle

A round transitions through these states:

```
        +---------+
  start │  active │ ← player picks tiles
        +---------+
         │       │
   bust  │       │ cash_out
         ▼       ▼
     +-------+ +------------+
     │busted │ │ cashed_out │
     +-------+ +------------+
```

| State        | Meaning                                                      |
| ------------ | ------------------------------------------------------------ |
| `active`     | Round in progress; at least one pick is possible             |
| `cashed_out` | Player took winnings; round closed; payout written to ledger |
| `busted`     | Player hit a mine; round closed; stake forfeited to house    |

Once a round is `cashed_out` or `busted`, no further actions are accepted. The state is terminal.

---

## 5. Action API (engine-level)

Three operations on a Mines round.

### 5.1 startRound(input)

**Inputs:** `roundId`, `userAccountId`, `escrowAccountId`, `houseAccountId`, `stake`, `mineCount`, `serverSeed`, `clientSeed`, `nonce`

**Effects:**

1. Validates input (stake limits, mine count bounds, seed validity).
2. Phase 1 ledger write: `recordBetStake` (user → escrow). Idempotent on `roundId`.
3. Pre-computes the mine layout via `deriveMines(serverSeed, clientSeed, nonce)`. The first `mineCount` indices in the permutation are the mine positions.
4. Stores the round state.

**Returns:** `MinesRound` with state `active`, no tiles revealed yet, multiplier `1.0` (or undefined; convention TBD — engine returns `currentMultiplier` only after the first reveal).

**Idempotency:** Calling `startRound` again with the same `roundId` returns the existing round. Stake is not re-debited.

### 5.2 revealTile(roundId, tileIndex)

**Inputs:** `roundId`, `tileIndex` (0–24)

**Effects:**

1. Loads the round; rejects if not `active`.
2. Rejects if `tileIndex` already revealed.
3. Marks the tile as revealed.
4. If the tile is a mine: state → `busted`. Phase 2 ledger write: `recordBetLoss` (escrow → house). Idempotent on `roundId`.
5. If the tile is safe: increment safe-reveals counter, recompute current multiplier.

**Returns:** updated `MinesRound` showing whether the revealed tile was a mine, the new multiplier, and the round state.

**Idempotency:** Revealing the same tile twice is a no-op (returns the round in its post-reveal state, no error). Revealing a different tile when the round is `busted` or `cashed_out` is rejected.

### 5.3 cashOut(roundId)

**Inputs:** `roundId`

**Effects:**

1. Loads the round; rejects if not `active`.
2. Rejects if no safe tiles have been revealed (would be a stake refund, which is a different operation).
3. Computes payout = `stake × currentMultiplier`.
4. Phase 2 ledger write: `recordBetWin` (escrow → user, house → user). Idempotent on `roundId`.
5. State → `cashed_out`.

**Returns:** updated `MinesRound` with payout details.

**Idempotency:** Calling `cashOut` again returns the cashed-out round unchanged. The user is not paid twice.

---

## 6. Round state storage

The engine depends on a `MinesRoundRepository` interface — same pattern as the ledger repository:

```ts
interface MinesRoundRepository {
  create(round: MinesRound): Promise<void>;
  load(roundId: string): Promise<MinesRound | null>;
  update(round: MinesRound): Promise<void>;
}
```

Two implementations:

- **`InMemoryMinesRoundRepository`** — for tests and spec validation.
- **`PostgresMinesRoundRepository`** — production. Lands when `@solsticebet/db` is built.

Storage of mine positions: store the **server seed reference** (so the layout can be re-derived) plus the list of **revealed tile indices**. Don't store the mine positions directly — they are derivable, and re-deriving on each load is the cleanest invariant.

For audit/post-game, the round record persists indefinitely (subject to data retention policy, in `LEDGER.md` § 8.1.1 — no, wrong reference; this is in `ARCHITECTURE.md` § 11).

---

## 7. Provable fairness for Mines

Every round records: `serverSeedId`, `clientSeed` snapshot, `nonce`, `cursor=0`, `mineCount`, the list of revealed tiles in order, the outcome (`busted` or `cashed_out`), and the final multiplier/payout.

After the server seed is rotated and revealed, the player verifies:

1. Run `deriveMines(revealedServerSeed, clientSeed, nonce)` on the verification page.
2. Take the first `mineCount` indices of the result — these are the mine positions.
3. Cross-check against their pick history: every safe tile they revealed must NOT be in the mine set; the busting tile (if any) must be IN the mine set.
4. Compute the multiplier at cash-out time from the count of safe reveals and the mine count.

If the math doesn't match, the casino has a defect.

---

## 8. Edge cases and operator decisions

| Case                                          | Behaviour                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Player tries to pick the same tile twice      | No-op; returns the current state                                                                                   |
| Player tries to pick on a busted/cashed round | Rejected with terminal-state error                                                                                 |
| Player tries to cash out before any reveal    | Rejected; no fair payout exists                                                                                    |
| Player reveals all 25 - mineCount safe tiles  | Round auto-cashes-out at maximum multiplier                                                                        |
| Stake below minimum / above maximum           | Rejected at startRound                                                                                             |
| Mine count out of [1, 24]                     | Rejected at startRound                                                                                             |
| Network blip mid-reveal                       | Idempotency: re-issuing the same reveal is safe                                                                    |
| Server seed rotation while round is in flight | Round retains its committed seed reference; rotation only affects future rounds                                    |
| User account suspended mid-round              | New actions rejected at compliance layer; existing round can be resolved (cash out or bust) but no further reveals |

The "auto-cash on full clear" rule deserves emphasis: if a player reveals every safe tile, the engine cashes out automatically at the maximum multiplier rather than leaving the round indefinitely active. This prevents abandoned rounds with locked escrow.

---

## 9. What this game does not do (v1)

- **Variable grid sizes.** 5×5 only. Future grids (3×3, 7×7) are deferred.
- **Pre-set pick patterns / auto-play.** UI feature; engine processes one reveal at a time.
- **Multiple concurrent rounds per user.** One active round at a time per user; new `startRound` while one is active rejects at API layer.
- **Hot reload of pick history mid-round.** Round state is opaque to the player beyond what they've already revealed; the API doesn't disclose unrevealed mine positions until the round closes.
- **Tournament / leaderboards from Mines specifically.** Generic leaderboards exist; Mines-specific ones are deferred.

---

## 10. Test plan

- **Math tests:** combinatoric multiplier formula correctness, monotonicity (multiplier strictly increases with each safe reveal), worked-example agreement.
- **Mine layout determinism:** same seeds → same mine positions, every time.
- **Validation tests:** all input limit boundaries.
- **Round lifecycle tests:** state transitions, idempotency on every action, terminal-state rejections.
- **Integration tests:** full pipeline against real RNG + real InMemoryLedgerRepository — start, reveal safe, reveal mine, bust path; start, reveal safe, cash out, win path.
- **Auto-cash test:** revealing every safe tile triggers automatic cash-out.
- **RTP convergence:** simulate large numbers of rounds with a fixed cash-out policy; verify empirical RTP converges toward 97%.
- **Concurrency test:** two simultaneous reveals on the same tile produce one reveal, not two (in-memory: locking; Postgres: row lock).

100% coverage on `math.ts`, `engine.ts`, `repository.ts` is mandatory.

---

## 11. Document changelog

| Version | Date       | Author          | Change        |
| ------- | ---------- | --------------- | ------------- |
| 1.0     | 2026-05-03 | Oakley + Claude | Initial draft |

**End of document.**
