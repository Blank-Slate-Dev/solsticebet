# Ledger — Specification

**Status:** Accepted v1.0
**Last updated:** 2026-05-03
**Owner:** Oakley
**Audience:** Engineering, certification labs, financial auditors, security auditors

---

## 0. Purpose

Define the data model and operational semantics for Solstice's accounting ledger. Every credit and debit on the platform — every deposit, withdrawal, bet stake, bet payout, bonus, fee, and adjustment — flows through this module.

The ledger is the **single source of truth for player balances**. Balances are not stored as mutable values anywhere in the system. They are derived from the ledger by summing entries.

Auditors, the licensor, and the certification lab all read this document line by line. **Get it right.**

---

## 1. Properties we are guaranteeing

A correct double-entry ledger gives the operator and players these guarantees:

1. **No money created or destroyed.** Every transaction conserves money: the sum of all entries belonging to a transaction is always zero. Money moves between accounts; it never disappears or appears.
2. **Append-only history.** Ledger entries are never updated, never deleted. Mistakes are corrected by writing reversing entries. The history is the truth.
3. **Idempotent writes.** Every external-facing transaction is keyed by an idempotency key. Replaying the same transaction (e.g., a webhook retry, a network blip) is safe — duplicates are rejected, not double-counted.
4. **Auditable balances.** Any account's balance at any point in time can be reconstructed by summing entries up to that timestamp. There is never a "balance" that disagrees with the entries.
5. **Atomic transactions.** Either all entries belonging to a transaction are written, or none are. There is no in-between state visible to anyone.
6. **Strong typing.** Currency, account type, and transaction type are not free-form strings. Mismatches are rejected at the type system level.

These properties only hold if the implementation matches this spec exactly.

---

## 2. The data model

### 2.1 Accounts

An **account** is the addressable unit of value. Every account has:

| Field       | Type          | Notes                                                                                   |
| ----------- | ------------- | --------------------------------------------------------------------------------------- |
| `id`        | UUID          | Stable identifier                                                                       |
| `type`      | `AccountType` | One of: `user`, `house`, `bonus`, `escrow`, `fees`, `provider`                          |
| `ownerId`   | UUID \| null  | For `user`/`bonus` accounts: the user_id. For `house`/`fees`/`escrow`/`provider`: null. |
| `currency`  | `Currency`    | One of: `BTC`, `ETH`, `USDT`, `SOL`, `LTC`, `INTERNAL_USDT`                             |
| `createdAt` | timestamp     | Immutable                                                                               |

**Account types:**

- **`user`** — The player's own wallet. One per user per currency.
- **`bonus`** — Bonus credits awarded to a user. Separate from user wallet so we can track wagering requirements. One per user per currency.
- **`house`** — The casino's accounts. Counterparty to user wins/losses.
- **`escrow`** — Temporary holding during in-flight bets and pending withdrawals.
- **`fees`** — Where withdrawal fees, conversion fees, and similar accrue.
- **`provider`** — Counterparty to crypto deposit/withdrawal flows; represents the external custodial provider (NOWPayments / CoinsPaid).

**Currencies:**

- **Crypto rails:** `BTC`, `ETH`, `USDT`, `SOL`, `LTC` — used only for deposits and withdrawals.
- **`INTERNAL_USDT`** — the internal accounting unit. **All gameplay happens in `INTERNAL_USDT`.** Crypto deposits convert to `INTERNAL_USDT` at deposit time at the provider's quoted rate; the converted amount is what players see and bet with. Crypto withdrawals convert from `INTERNAL_USDT` back to the destination crypto at withdraw time.

This conversion-at-the-edge pattern decouples bet math from crypto volatility within a session, simplifies game logic dramatically, and matches what Stake/Roobet/BC.Game all do internally.

### 2.2 Ledger entries

A **ledger entry** is a single signed credit or debit against one account.

| Field             | Type              | Notes                                                         |
| ----------------- | ----------------- | ------------------------------------------------------------- |
| `id`              | bigserial         | Sequential, ordered                                           |
| `transactionId`   | UUID              | Groups paired entries belonging to one transaction            |
| `accountId`       | UUID              | The account being credited or debited                         |
| `amount`          | decimal(38,18)    | **Signed**: positive = credit, negative = debit               |
| `currency`        | `Currency`        | Must match the account's currency                             |
| `transactionType` | `TransactionType` | See § 2.3                                                     |
| `referenceId`     | string \| null    | External reference (tx hash, withdrawal ID, bet ID)           |
| `idempotencyKey`  | string \| null    | Required for external-facing writes; unique when present      |
| `metadata`        | JSON              | Free-form structured data (game ID, round ID, admin ID, etc.) |
| `createdAt`       | timestamp         | Immutable                                                     |

**Rules enforced by the writer (and re-verified by a database trigger in production):**

- The sum of `amount` across all entries with the same `transactionId` must equal exactly zero.
- All entries within a single transaction must use the same `currency`. Cross-currency transactions are split into a debit-and-credit pair on each currency, joined by a parent transaction. (See § 4.4 conversion.)
- Two entries belonging to the same transaction must touch different accounts. A "transaction" of one account crediting itself is not a transaction.
- `idempotencyKey`, when set, is unique across the entire `ledger_entries` table. Repeated writes with the same key are rejected.

### 2.3 Transaction types

A finite, closed enumeration. New types require an architectural decision record.

| Type                | Direction                        | Description                                                                                                |
| ------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `deposit`           | provider → user                  | Crypto deposit confirmed on-chain by the provider                                                          |
| `withdraw`          | user → provider                  | Crypto withdrawal sent on-chain by the provider                                                            |
| `bet_stake`         | user → escrow                    | Stake debited from user when a bet is placed                                                               |
| `bet_payout`        | escrow → user                    | Winnings credited back to user when a bet is settled (loss = no payout entry; the escrow flushes to house) |
| `bet_settle_loss`   | escrow → house                   | The lost stake flowing from escrow to house when a bet loses                                               |
| `bet_refund`        | escrow → user                    | Bet voided (technical issue, manual void) — stake returned                                                 |
| `bonus_grant`       | house → bonus                    | Bonus credit awarded                                                                                       |
| `bonus_release`     | bonus → user                     | Bonus converted to wagering-cleared user balance                                                           |
| `bonus_forfeit`     | bonus → house                    | Bonus forfeited (e.g., user withdrew before clearing)                                                      |
| `fee`               | \* → fees                        | Fee taken on a withdrawal or conversion                                                                    |
| `conversion`        | currency-A → currency-B (paired) | Currency conversion at deposit/withdraw                                                                    |
| `adjustment_credit` | house → user                     | Manual admin credit (logged, audited)                                                                      |
| `adjustment_debit`  | user → house                     | Manual admin debit (logged, audited)                                                                       |

### 2.4 Balances

A balance is **always derived**, never stored:

```
balance(accountId) = SUM(amount) WHERE accountId = ? GROUPED BY currency
```

In production this query is fast because of an index on `(account_id, currency)` plus a Redis cache (`balance:{accountId}:{currency}`) invalidated on every write. The cache is a performance optimisation; the source of truth is always the SQL aggregation.

**Negative balances are forbidden** for `user` and `bonus` accounts. The writer rejects any transaction that would leave a user or bonus account negative. House and fees accounts can be negative transiently (e.g., during a settlement window) but are reconciled to non-negative on a regular cadence.

---

## 3. Idempotency

Every external-facing transaction includes an `idempotencyKey`. The pattern:

```
idempotencyKey = `<source>:<external-id>`
```

Examples:

- `deposit:0x1f3a...abc` — derived from the on-chain tx hash
- `withdraw:wd_01HXYZ...` — derived from the withdrawal request ID
- `bet_stake:bet_01HXYZ...` — derived from the bet ID
- `bet_payout:bet_01HXYZ...` — same bet ID, different tx type → unique by composition

**Repeated writes** with the same idempotencyKey are not errors. They return the original transaction's result. This is critical: webhooks retry, networks blip, services restart. The ledger must be safe under retry.

**Internal-only transactions** (entirely within our system, no external trigger) may omit idempotencyKey, but only when the caller can prove uniqueness another way (e.g., a state machine that won't re-fire).

---

## 4. Canonical transactions (the recipes)

Each user-facing transaction translates to a specific set of ledger entries. These are defined here and only here. Game packages do not roll their own — they call `ledger.recordBet(...)` and the recipe expands inside this module.

### 4.1 Deposit

**Inputs:** user_id, crypto_currency (e.g., BTC), raw_amount, quoted_internal_usdt, tx_hash, conversion_rate

**Entries (3, joined by one transactionId):**

```
+ raw_amount (BTC)               → user wallet (BTC)         tx=deposit
- raw_amount (BTC)               → provider account (BTC)    tx=deposit

+ quoted_internal_usdt           → user wallet (INTERNAL_USDT)   tx=conversion
- quoted_internal_usdt           → provider account (INTERNAL_USDT)   tx=conversion
```

Wait — that's 4 entries, two zero-sum pairs. They all share one `transactionId`. The conversion is recorded explicitly so audit trails can answer "what rate did we use?" by looking at the metadata of the conversion entries.

`idempotencyKey` = `deposit:<tx_hash>`.

`metadata` includes: `{ blockHeight, txHash, conversionRate, provider }`.

Note: the user's spendable balance is the `INTERNAL_USDT` credit. The raw `BTC` credit is for audit; we track raw crypto holdings to reconcile against the provider's books, but players bet against `INTERNAL_USDT`.

### 4.2 Withdrawal

**Inputs:** user_id, crypto_currency, requested_internal_usdt, quoted_crypto_amount, fee_internal_usdt, destination_address, withdrawal_id

The withdrawal is two-phase:

**Phase 1 — request received, escrow:**

```
- (requested + fee) (INTERNAL_USDT)  → user wallet (INTERNAL_USDT)    tx=withdraw
+ requested  (INTERNAL_USDT)         → escrow account (INTERNAL_USDT) tx=withdraw
+ fee        (INTERNAL_USDT)         → fees account (INTERNAL_USDT)   tx=fee
```

This is recorded the moment the user clicks Withdraw, after compliance gates pass. The user's spendable balance reflects the lower amount immediately.

`idempotencyKey` = `withdraw_request:<withdrawal_id>`.

**Phase 2 — provider broadcasts on-chain (after manual approval if over threshold):**

```
- requested (INTERNAL_USDT)         → escrow account (INTERNAL_USDT)  tx=withdraw
+ requested (INTERNAL_USDT)         → provider account (INTERNAL_USDT) tx=withdraw

- quoted_crypto (BTC)              → provider account (BTC)            tx=conversion
+ quoted_crypto (BTC)              → external (recorded as adjustment to provider account, since destination is off-platform)
```

Because the destination address is off-platform, the conversion entries' counterparty is the provider account (we're debiting our balance with the provider). The actual funds leave the provider's hot wallet. We don't model the destination address as a ledger account because we don't own it.

`idempotencyKey` = `withdraw_settle:<withdrawal_id>`.

**Phase 3 — provider failure (rare):**

If the provider rejects the withdrawal, we run the reversal:

```
- requested (INTERNAL_USDT)         → escrow account                  tx=bet_refund (reused as "withdraw refund")
+ requested (INTERNAL_USDT)         → user wallet                      tx=bet_refund
- fee       (INTERNAL_USDT)         → fees account                     tx=bet_refund
+ fee       (INTERNAL_USDT)         → user wallet                      tx=bet_refund
```

Refund of the fee is operator policy — we choose to refund failed-withdrawal fees. This is configurable.

### 4.3 Bet (stake + outcome)

Bets are also two-phase: stake at placement, settle at outcome.

**Phase 1 — stake:**

```
- stake (INTERNAL_USDT)             → user wallet                      tx=bet_stake
+ stake (INTERNAL_USDT)             → escrow                           tx=bet_stake
```

`idempotencyKey` = `bet_stake:<bet_id>`.

**Phase 2 — settle:**

If the bet wins (player payout = stake × multiplier where multiplier > 1):

```
- stake (INTERNAL_USDT)             → escrow                           tx=bet_payout
- (payout - stake) (INTERNAL_USDT) → house                             tx=bet_payout
+ payout (INTERNAL_USDT)            → user wallet                      tx=bet_payout
```

If the bet loses (no payout):

```
- stake (INTERNAL_USDT)             → escrow                           tx=bet_settle_loss
+ stake (INTERNAL_USDT)             → house                            tx=bet_settle_loss
```

If the bet pushes (return of stake):

```
- stake (INTERNAL_USDT)             → escrow                           tx=bet_refund
+ stake (INTERNAL_USDT)             → user wallet                      tx=bet_refund
```

`idempotencyKey` for settle = `bet_settle:<bet_id>`.

**Invariant:** at any point in time, the sum of escrow balances equals the sum of stakes for bets in `placed` state across all users. A daily reconciliation job verifies this; drift triggers an alert.

### 4.4 Conversion

When converting between currencies (e.g., a BTC deposit becoming INTERNAL_USDT), the entries above already cover it. Standalone conversions (e.g., user opts to convert their BTC balance to ETH balance) follow the same pattern: a debit on the source currency, a credit on the destination currency, both belonging to the same transactionId, with the rate captured in metadata.

### 4.5 Bonuses

Bonus accounts let us track wagering requirements separately from real money.

**Grant:**

```
- amount (INTERNAL_USDT)            → house                            tx=bonus_grant
+ amount (INTERNAL_USDT)            → bonus account (user's)           tx=bonus_grant
```

**Release** (after wagering requirement met):

```
- amount (INTERNAL_USDT)            → bonus account                    tx=bonus_release
+ amount (INTERNAL_USDT)            → user wallet                      tx=bonus_release
```

**Forfeit** (user withdrew before clearing):

```
- amount (INTERNAL_USDT)            → bonus account                    tx=bonus_forfeit
+ amount (INTERNAL_USDT)            → house                            tx=bonus_forfeit
```

Wagering requirement tracking lives in a separate `bonus_progress` table outside this module, since it's policy not accounting. The ledger only reflects movements.

### 4.6 Manual adjustment

When an admin needs to credit or debit a user account (correcting an error, refunding goodwill, clawing back fraud):

```
- amount → house                    tx=adjustment_credit
+ amount → user wallet              tx=adjustment_credit
```

…or the reverse for `adjustment_debit`. **Always logged in `audit_log`** with admin ID and reason. Never callable except via admin panel with hardware-2FA-authenticated session.

`idempotencyKey` = `adjustment:<admin_id>:<request_id>`.

---

## 5. Money representation

Money is represented as `decimal(38, 18)` in the database — 18 decimal places of precision (matches Ethereum's wei-level precision; safe for any crypto rounding).

In the application layer:

- We never use JavaScript `number` for amounts. Floating-point arithmetic on money is unsafe.
- We use `bigint` paired with a fixed scale (18 decimal places implied) for in-memory math.
- An `Amount` value type wraps `bigint` and carries the currency. Operations (`add`, `subtract`, `negate`) are typed and refuse to mix currencies.

All amount input/output to the outside world (API responses, JSON, logs) is stringified to avoid JS float corruption: `"123.456789012345678901"` not `1.234567890123457e2`.

---

## 6. The repository interface

The ledger module exposes a `LedgerRepository` interface. The interface has:

- `getAccount(id)` / `findAccount(...)`
- `createAccount(...)`
- `recordTransaction(...)` — atomic, idempotent, returns the recorded transaction
- `getBalance(accountId, currency)`
- `getEntries(accountId, options?)` — paginated query
- `findTransaction(transactionId | idempotencyKey)`

Two implementations:

- **`InMemoryLedgerRepository`** — used in tests and in spec-validation runs. Implements every invariant in code. Fast, no I/O.
- **`PostgresLedgerRepository`** — production. Wraps the in-memory invariants in a SQL transaction with row-level locking on accounts. Same external contract.

Game packages, the wallet service, and the admin panel all depend on `LedgerRepository`, not on a specific implementation. The Postgres impl lands when `@solsticebet/db` is built. Until then, all tests run against the in-memory implementation.

---

## 7. Concurrency and locking (Postgres impl)

Documented here because it shapes the in-memory contract.

The Postgres implementation:

1. Begins a SQL transaction with isolation level `REPEATABLE READ` (or `SERIALIZABLE` for high-stakes operations).
2. Acquires `SELECT ... FOR UPDATE` row-level locks on every account touched by the transaction, in a deterministic order (sorted by account_id) to prevent deadlocks.
3. Re-reads balances under lock.
4. Verifies the proposed transaction would not leave a user/bonus account negative.
5. Inserts ledger entries.
6. Commits.

The in-memory implementation simulates this by:

- Using a single mutex for the whole repository (sufficient for tests; in-memory has no concurrent processes).
- Same negative-balance check.
- Same atomic write of all entries.

If two concurrent transactions race in production, one will block the other on the row lock; the second retries with fresh balance reads. The result is serialised correctness at the cost of potential retry latency.

---

## 8. Reconciliation

Outside this module's scope, but documented for context: a reconciliation job runs hourly and:

1. Sums all `provider` account balances by currency.
2. Compares to the provider's reported balance via API.
3. Drift > 0.5% triggers an alert and freezes withdrawals pending investigation.

Similar checks for escrow:

- Sum of `escrow` per currency vs. sum of stakes for in-flight bets in that currency.
- Sum of `escrow` per currency vs. sum of pending withdrawals in that currency.

Drift in any of these is a P0 incident.

---

## 9. Security requirements

Mandatory, enforced by code review:

1. **No mutable balance columns anywhere in the codebase.** Balances are queries, not stored values.
2. **No `UPDATE` or `DELETE` on `ledger_entries`** — enforced by Postgres trigger that raises an error.
3. **No raw SQL in callers** — only this module writes to `ledger_entries`. Callers use the repository interface.
4. **Idempotency keys mandatory** for any external-facing transaction. PR review checks this.
5. **Audit log writes paired with adjustments** — admin adjustments must be in the same DB transaction as their audit_log entry.
6. **No `console.log` of amounts in user-facing log lines** without rounding to display precision. Internal logs may include full precision.
7. **`bigint` for amount math, never `number`.** Linted.
8. **Negative balances forbidden** for user and bonus accounts, enforced by the repository before the SQL commit.

---

## 10. Test plan

Categories — all must pass before merge.

### 10.1 Invariant tests

For every transaction type, verify:

- Sum of entries = 0 exactly (not "≈ 0")
- All entries share the same currency (within a transaction; conversion transactions span two currencies but each currency-side sums to zero)
- All entries share the same transactionId
- All entries touch distinct accounts
- Idempotency: writing the same key twice yields the same result, no duplicate entries

### 10.2 Balance derivation tests

- Balance = sum of entries for any sequence of transactions
- Balance never goes negative for user/bonus accounts; the writer rejects such transactions
- Concurrent simulated writes (in-memory) produce the same final balance regardless of interleaving
- Replaying a long history reproduces the same balance

### 10.3 Recipe tests

For each canonical transaction (deposit, withdraw, bet stake, bet payout, bet loss, bet refund, bonus grant/release/forfeit, conversion, adjustment):

- Correct number of entries
- Entries credit/debit the correct accounts
- Idempotency key collisions return the original transaction unchanged

### 10.4 Edge cases

- Zero-amount transactions are rejected (we don't write no-op rows)
- Negative-amount transactions are rejected at the API layer (amounts must be positive; direction is encoded by transaction type, not by sign of input)
- Mixing currencies within a single-currency transaction type rejected
- Creating a duplicate account (same owner + currency + type) rejected
- Closing/locking accounts (deferred — v2)

### 10.5 Property tests

Generate sequences of random valid transactions and verify:

- The zero-sum invariant holds for every transaction
- Balance arithmetic is consistent (sum of entries = derived balance always)
- Idempotency: any transaction can be safely re-played

### 10.6 Coverage

100% line coverage on the core repository operations. No exceptions. Enforced in CI.

---

## 11. Out of scope

What this document explicitly does not cover:

- **Multi-currency wallet UI.** The frontend's job. We expose balances per currency; the UI displays them.
- **Wagering progress tracking.** Bonus accounts exist; the percentage-cleared tracking is in `packages/bonuses` (TBD).
- **Tax reporting.** Outputs derived from ledger queries, but the tax module isn't this module.
- **VIP/loyalty cashback.** Will use the ledger via `adjustment_credit` transactions, but the cashback engine is its own module.
- **Sportsbook-style cashout, parlay reconciliation.** Not v1 scope.
- **Multi-leg/parlay bets.** Single-leg bets only in v1.
- **External chargebacks on crypto** — chargebacks aren't a thing in crypto. If a deposit is reversed (extremely rare), it's modeled as `adjustment_debit`.

---

## 12. Document changelog

| Version | Date       | Author          | Change        |
| ------- | ---------- | --------------- | ------------- |
| 1.0     | 2026-05-03 | Oakley + Claude | Initial draft |

---

**End of document.**
