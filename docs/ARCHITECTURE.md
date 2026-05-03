# Solstice — System Architecture

**Status:** Draft v1.0
**Last updated:** 2026-05-03
**Owners:** Oakley (founder), TBD contractors
**Audience:** Engineering team, licensor's technical reviewer, certification labs

---

## 0. How to read this document

This is the canonical architecture document for Solstice, a licensed real-money crypto casino. Every engineer working on the codebase reads this document on day one. It describes **what we are building, why we made each decision, and what we explicitly chose not to build**.

If you find a contradiction between this document and the code, the document is wrong — file a PR to fix it. If you find a contradiction between this document and your intuition, the document is right — talk to Oakley before deviating.

The architecture is opinionated. Some choices will look heavier than necessary for v1. They are intentional: we are building to a licensed standard from day one, not retrofitting compliance later. Retrofitting integrity into a casino codebase is how casinos lose their licence.

---

## 1. Product summary

**Solstice is a licensed crypto-only online casino** offering originals (Crash, Mines, Plinko, Dice) and table games (Blackjack, Roulette, Baccarat) to non-restricted markets globally, with sportsbook explicitly out of scope for v1.

| Attribute | Value |
|---|---|
| Brand | Solstice |
| Primary domain | solsticebet.com |
| Licence | Anjouan (target) |
| Markets | Non-restricted globally; Australia geo-blocked; full restricted-jurisdiction list maintained in `/packages/compliance/restricted-jurisdictions.json` |
| Currencies | BTC, ETH, USDT (ERC-20 + TRC-20), SOL, LTC at launch |
| Game scope v1 | Crash, Mines, Plinko, Dice, Blackjack, European Roulette, Baccarat |
| Out of scope v1 | Sportsbook, slots aggregation, live dealer, fiat rails, mobile native apps |
| Provably fair | Yes — every original game outcome verifiable independently |
| Target launch | Soft launch ~6 months from kickoff, full launch on licensor sign-off |

---

## 2. Design principles

These are the non-negotiable principles every architectural decision is measured against.

1. **Server-authoritative everything.** The client never decides game outcomes, balances, or eligibility. The client renders what the server tells it to render. A compromised client must not be able to win money.
2. **Double-entry ledger or it didn't happen.** Every credit has a matching debit. We never store a mutable `balance` column. Balances are derived from the ledger. Always.
3. **Idempotent writes.** Every state-changing API call accepts an idempotency key and is safe to retry. Casino software dies when network blips create duplicate bets.
4. **Provably-fair from day one.** RNG is built before any game. Every original game outcome is independently verifiable by the player using published seeds.
5. **Compliance is code, not policy.** Geo-blocking, KYC gates, deposit limits, self-exclusion, restricted jurisdictions — all enforced at the service boundary, not by hoping a UI screen shows. Code-enforced restrictions are auditable; policies aren't.
6. **Separation of duties.** RNG, ledger, and withdrawal modules are owned by Oakley alone. Contractors cannot merge to those packages. This is enforced via CODEOWNERS and branch protection, not trust.
7. **Boring tech wins.** PostgreSQL over a fashionable NoSQL. Native WebSockets over a framework-of-the-month. We are not innovating on infrastructure.
8. **Observability is required, not optional.** Every bet, every balance change, every withdrawal, every login attempt is logged with structured fields. If we cannot answer "what happened to player X at 14:32" in under 60 seconds, we have failed.
9. **Cost-efficient at scale.** Hosting choices that look fine at $50k/month GGR but are ruinous at $1M/month GGR are wrong choices.

---

## 3. High-level system topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Cloudflare                                │
│      (DNS, WAF, DDoS protection, Spectrum for WebSocket TCP)        │
└────────┬─────────────────────┬────────────────────┬─────────────────┘
         │                     │                    │
         ▼                     ▼                    ▼
   ┌──────────┐          ┌───────────┐       ┌──────────────┐
   │  Vercel  │          │  Hetzner  │       │   Hetzner    │
   │ (web app │          │   (game   │       │   (admin     │
   │ Next.js) │          │  server)  │       │    panel)    │
   └─────┬────┘          └─────┬─────┘       └──────┬───────┘
         │                     │                    │
         └───────────┬─────────┴───────────┬────────┘
                     │                     │
                     ▼                     ▼
              ┌────────────┐         ┌────────────┐
              │ PostgreSQL │         │   Redis    │
              │  (primary  │         │  (game     │
              │  +replica) │         │  state,    │
              │            │         │  sessions, │
              │            │         │  rate      │
              │            │         │  limit)    │
              └────────────┘         └────────────┘
                     │
                     ▼
              ┌────────────┐
              │ S3-compat  │
              │  (logs,    │
              │  backups,  │
              │  KYC docs) │
              └────────────┘

External integrations:
  - NOWPayments / CoinsPaid  → crypto deposits + withdrawals
  - Sumsub                   → KYC / AML
  - Cloudflare Turnstile     → bot protection on auth
  - Sentry                   → error tracking
  - Grafana Cloud            → metrics + logs
  - Crisp / Intercom         → player support chat (decision deferred)
```

---

## 4. Stack decisions

### 4.1 Languages and frameworks

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind | Maintained, SSR for SEO on marketing pages, RSC for fast lobby loads |
| Game rendering | Pixi.js v8 for originals (Crash/Plinko/Mines), React + Framer Motion for table games | Pixi for 60fps Canvas animation, React for state-heavy turn-based games |
| Game server | Fastify v5 + TypeScript on Node.js 22 LTS | Lower overhead than Express, native async support, mature WS ecosystem |
| WebSocket | `ws` library (native), not Socket.io | Lower per-connection memory, no fallback negotiation overhead, control over framing |
| Admin panel | Next.js 14 + TypeScript + Tailwind + shadcn/ui | Same stack as web app reduces context switch |
| Database | PostgreSQL 17 | Boring, transactional, audited, supports the ledger pattern natively |
| Cache | Redis 7 | Industry standard, supports the patterns we need (pub/sub, sorted sets for leaderboards, atomic counters) |
| Build/lint | Turborepo monorepo, ESLint + Prettier, strict TypeScript everywhere | One source of truth, atomic cross-package commits |
| Testing | Vitest (unit), Playwright (E2E), k6 (load) | Vitest for speed, Playwright is the standard, k6 for game-server load |
| Infrastructure as code | Terraform + Ansible | Terraform for Hetzner Cloud + Cloudflare, Ansible for dedicated server config |
| CI/CD | GitHub Actions | Free for our scale, integrates with branch protection |

### 4.2 Hosting

**Decision: Hetzner dedicated + Hetzner Cloud + Cloudflare.**

Trade-off considered: AWS/GCP managed services are easier but 5–10x the cost at scale ($1M/month GGR puts AWS at $8–15k/month, Hetzner at $1.5–3k/month). For a casino where compute density is high and per-connection costs matter, bare metal wins.

**Caveat documented for future:** if we hire a DevOps contractor whose fluency is exclusively AWS, the cost difference is worth less than their productivity. Revisit at hiring time.

| Component | Spec | Approx cost |
|---|---|---|
| Game server (3x for HA) | Hetzner AX52 dedicated, Ryzen 7 7700, 64GB RAM, NVMe | €207/mo |
| Postgres (primary + replica) | Hetzner managed Postgres, prod tier | ~€50/mo |
| Redis | Hetzner Cloud CCX13, self-hosted | ~€30/mo |
| Web app | Vercel Pro | $20/mo |
| Admin panel | Hetzner Cloud CX22, self-hosted Next.js | €5/mo |
| Cloudflare | Business plan + Spectrum | ~$300/mo |
| S3-compatible (Hetzner Storage Box or Wasabi) | 1TB | ~$6/mo |
| Backups (offsite) | Backblaze B2 | ~$10/mo |
| **Total month 1** | | **~$650/mo** |

Locations: Helsinki + Falkenstein + Nuremberg (Hetzner's three EU DCs) for game server HA. Database primary in Falkenstein with read replica in Helsinki.

### 4.3 Repository structure

Monorepo via Turborepo. One Git repository named `solstice`. CODEOWNERS-enforced review per package.

```
solstice/
├── apps/
│   ├── web/                  # Player-facing Next.js app (solsticebet.com)
│   ├── admin/                # Admin panel (admin.solsticebet.internal)
│   └── game-server/          # Fastify + WS game server
├── packages/
│   ├── rng/                  # ⚠️ RESTRICTED — Provably-fair RNG (Oakley only)
│   ├── ledger/               # ⚠️ RESTRICTED — Double-entry ledger (Oakley only)
│   ├── wallet/               # ⚠️ RESTRICTED — Deposit/withdraw orchestration (Oakley only)
│   ├── compliance/           # ⚠️ RESTRICTED — Geo, KYC gates, restricted jurisdictions (Oakley only)
│   ├── games/                # Game engines (open to contractors)
│   │   ├── crash/
│   │   ├── mines/
│   │   ├── plinko/
│   │   ├── dice/
│   │   ├── blackjack/
│   │   ├── roulette/
│   │   └── baccarat/
│   ├── auth/                 # Session, JWT, 2FA
│   ├── db/                   # Prisma schema, migrations, repositories
│   ├── ui/                   # Shared React components (shadcn-derived)
│   ├── design/               # Design tokens, Tailwind preset (Solstice palette)
│   ├── shared-types/         # TypeScript types shared across apps
│   ├── observability/        # Logging, metrics, tracing wrappers
│   └── config/               # Shared eslint/tsconfig/prettier configs
├── infra/
│   ├── terraform/            # Hetzner Cloud + Cloudflare
│   └── ansible/              # Dedicated server provisioning
├── docs/
│   ├── ARCHITECTURE.md       # This file
│   ├── SCHEMA.md             # Database schema
│   ├── RNG.md                # Provably-fair spec
│   ├── LEDGER.md             # Ledger semantics
│   ├── RUNBOOKS/             # Operational procedures
│   └── DECISIONS/            # Architectural decision records (ADRs)
├── .github/
│   ├── CODEOWNERS            # Enforces restricted-package review
│   └── workflows/
└── turbo.json
```

**RESTRICTED packages** (`rng`, `ledger`, `wallet`, `compliance`) require Oakley's review on every PR via CODEOWNERS. Branch protection rules disallow merging without approval from a code owner. Contractors can read these packages but cannot modify them.

---

## 5. Service architecture

### 5.1 Web app (`apps/web`)

**Hosted on Vercel.** Deployed from `main` branch on every merge.

- **Public pages** (RSC): marketing, T&Cs, responsible gambling, fairness verification page, leaderboards, blog. Cached at edge.
- **Authenticated pages** (CSR): lobby, game pages, wallet, profile, KYC flow. Hit game-server API.
- **Authentication:** session cookie (HttpOnly, Secure, SameSite=Strict) issued by game-server, verified on every request.
- **API client:** typed wrapper around game-server REST + WS endpoints, generated from OpenAPI spec.

**The web app contains zero game logic.** It opens a WebSocket to the game server, sends user inputs, renders animations. The server decides outcomes.

### 5.2 Game server (`apps/game-server`)

**Hosted on Hetzner dedicated.** The most important service. Three instances behind Cloudflare load balancer (sticky-session for WS connections).

Responsibilities:
- Authenticate WS connections via session token
- Handle bet placement: validate → ledger debit → RNG outcome → ledger credit (if win) → response
- Run multiplayer Crash rounds (single round-robin per shard, synchronised via Redis pub/sub)
- Stream real-time events: bets, wins, chat, leaderboard updates
- Enforce per-user, per-IP rate limits via Redis token buckets
- Enforce compliance gates: geo-block check, KYC tier check, self-exclusion check before any bet

Things the game server does not do:
- Process deposits / withdrawals (handled by wallet service)
- Render anything (web app's job)
- Store player PII beyond what's needed for the live session

### 5.3 Admin panel (`apps/admin`)

**Hosted on Hetzner Cloud, IP-allowlisted.** Internal use only.

- Player search, full bet history, ledger entries
- Manual balance adjustments (logged immutably with admin ID + reason)
- KYC review queue (Sumsub webhook results land here)
- Withdrawal approval queue
- RTP / GGR / DAU dashboards
- Restricted jurisdiction management
- Self-exclusion administration
- Audit log viewer (every admin action recorded)

Admin auth uses hardware key (YubiKey) for 2FA, no exceptions, including in dev. Day-zero rule.

### 5.4 Wallet service

**Logical service inside the game server in v1.** May be extracted to its own process post-launch when crypto integration matures.

Responsibilities:
- Generate deposit addresses (delegated to NOWPayments / CoinsPaid)
- Listen to deposit webhooks, credit ledger atomically with idempotency
- Process withdrawal requests: validate → KYC tier check → manual approval queue (over threshold) → broadcast to provider → ledger update
- Currency conversion (we hold USDT internally; BTC/ETH/SOL/LTC deposits convert at deposit time at provider's quoted rate, recorded in ledger)
- Reconciliation job: hourly cross-check provider balance vs internal ledger sum, alert on drift

### 5.5 Compliance service

**Logical service inside the game server.** Synchronous gate on every bet.

Checks executed in order on every bet:
1. Session valid?
2. Account not self-excluded?
3. IP geo-location allowed for this jurisdiction? (MaxMind DB updated weekly)
4. KYC tier sufficient for stake size?
5. Daily/weekly deposit limit not exceeded?
6. Reality-check timer not requiring a pause?

Any failure short-circuits the bet, returns a structured error, logged.

---

## 6. Data architecture

### 6.1 Database overview

**PostgreSQL 17, primary in Falkenstein, async streaming replica in Helsinki.** Daily logical backups to Backblaze B2, retained 90 days. Point-in-time recovery via WAL archiving, retained 14 days.

We use Prisma as the schema migration tool and lightweight query builder. We do not use Prisma's ORM features for hot paths (bet placement, ledger writes) — those use raw SQL via `pg` driver for performance and transactional control. All raw SQL is reviewed against SQL injection patterns in CI via `eslint-plugin-sql-injection`.

### 6.2 Schema overview (full schema in `docs/SCHEMA.md`)

The schema is dominated by three concepts: **identities, the ledger, and bet history**.

#### Identities

- `users` — id, email, password hash (Argon2id), 2FA secret, created_at, status
- `user_profile` — display name, avatar, country (declared), country (geo-detected at signup, immutable)
- `user_kyc` — tier (0/1/2), Sumsub applicant ID, verified_at, document references (encrypted at rest)
- `user_limits` — daily/weekly/monthly deposit limits, session reality check interval, self-exclusion expiry
- `user_sessions` — session ID, IP, user agent, created_at, last_seen_at, revoked_at

#### Ledger (the most important table)

```sql
CREATE TABLE ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL,           -- user wallet, house, bonus, escrow, fees
  account_type TEXT NOT NULL,         -- 'user' | 'house' | 'bonus' | 'escrow' | 'fees'
  currency TEXT NOT NULL,             -- 'BTC' | 'ETH' | 'USDT' | 'SOL' | 'LTC' | 'INTERNAL_USDT'
  amount NUMERIC(38, 18) NOT NULL,    -- Signed: positive = credit, negative = debit
  transaction_id UUID NOT NULL,       -- Groups paired entries (one debit + one credit)
  transaction_type TEXT NOT NULL,     -- 'deposit' | 'withdraw' | 'bet' | 'win' | 'refund' | 'bonus' | 'adjustment'
  reference_id TEXT,                  -- External ID: tx hash, withdrawal ID, bet ID
  idempotency_key TEXT UNIQUE,        -- Prevents duplicate writes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB                      -- Game ID, round ID, admin ID, etc.
);

CREATE INDEX idx_ledger_account ON ledger_entries(account_id, currency, created_at DESC);
CREATE INDEX idx_ledger_transaction ON ledger_entries(transaction_id);
CREATE UNIQUE INDEX idx_ledger_idempotency ON ledger_entries(idempotency_key) WHERE idempotency_key IS NOT NULL;
```

**Rules:**
- Every transaction is at least two entries: a debit on one account and a credit on another. The sum of all entries for one `transaction_id` must equal zero. Enforced by trigger.
- The ledger is **append-only**. There is no UPDATE or DELETE on `ledger_entries`. Corrections are made by writing reversing entries.
- Account balance is **always derived**: `SELECT SUM(amount) FROM ledger_entries WHERE account_id = $1 AND currency = $2`. Cached in Redis with cache-invalidate-on-write.
- Idempotency keys are mandatory on every external-facing write (deposit, withdraw, bet, win).

This pattern is non-negotiable. The licensor will inspect it. The certification lab will inspect it. Auditors will inspect it. Get it right.

#### Bets and rounds

- `bet_rounds` — game type, round ID, server seed hash (pre-revealed), client seed, nonce, RNG result, created_at, settled_at
- `bets` — round_id, user_id, stake, currency, payout, ledger transaction IDs (debit + credit), provably-fair verification URL
- `crash_rounds` — separate table for multiplayer Crash, holds the round-wide multiplier curve and seed
- `game_outcomes` — denormalised outcome data per game type (used by the verification page)

#### Operational

- `audit_log` — every admin action: who, what, when, why, before-state, after-state. Append-only.
- `restricted_jurisdictions` — country/region codes with reason and last reviewed date
- `withdrawal_queue` — pending withdrawals awaiting approval over threshold

### 6.3 Redis usage

| Key pattern | Purpose | TTL |
|---|---|---|
| `session:{token}` | Session lookup | 7d |
| `balance:{user_id}:{currency}` | Cached balance | 60s, invalidated on ledger write |
| `crash:current` | Current Crash round state | live |
| `crash:history:24h` | Last 24h of Crash multipliers | 24h |
| `ratelimit:{ip}:{endpoint}` | Token bucket | 1m |
| `ratelimit:{user_id}:bet` | Per-user bet rate limit | 10s |
| `leaderboard:weekly` | Sorted set, GGR per user | 7d |
| `live:bets` | Pub/sub channel for live bet feed | n/a |

Redis is treated as ephemeral. We can lose Redis without losing data; we'd lose convenience and have to recompute caches.

### 6.4 Object storage

S3-compatible bucket (Hetzner Storage Box or Wasabi) holds:
- Application logs (rotated daily, retained 7 years per licensing requirement)
- Database backups
- KYC documents (encrypted client-side with per-user keys before upload)
- Static assets

---

## 7. The provably-fair RNG (the most important module)

Full spec lives in `docs/RNG.md`. Summary here.

**Algorithm:** HMAC-SHA256.

**Inputs:**
- `serverSeed` — 64 hex chars, generated by us, kept secret until rotated
- `clientSeed` — 64 hex chars, set by the user, can be changed anytime (forces a server seed rotation if we'd be revealing the same one)
- `nonce` — incrementing counter per (user, server seed) pair, starting at 0

**Output derivation:**
```
hmac = HMAC_SHA256(key=serverSeed, message=`${clientSeed}:${nonce}`)
```

The 64-hex-char HMAC output is then sliced into chunks (typically 4-byte) and converted to floats in `[0, 1)`, which each game maps to its own outcome space (e.g. Crash: multiplier curve; Mines: tile permutation; Dice: roll value).

**Lifecycle:**
1. Server generates new `serverSeed`, computes `serverSeedHash = SHA256(serverSeed)`, **publishes the hash before any bet using this seed**.
2. User plays bets; nonce increments. The hash is visible to the user, the seed is not.
3. When the user requests rotation (or the hash is exhausted, or after a fixed nonce limit), the server **publishes the now-revealed serverSeed**, and starts a new one.
4. Any historical bet can be re-derived: user has `serverSeed` (post-rotation), `clientSeed`, `nonce`. They run the algorithm and verify the outcome matches.

**Verification UI:** every bet receipt links to a verification page at `solsticebet.com/verify/{betId}` that displays the seeds and lets the user re-run the calculation, including in JavaScript on their own machine via a published reference implementation.

**Implementation rules:**
- The RNG package has 100% line coverage on its core derivation function. No exceptions.
- The package exposes a single function per game type, no escape hatches.
- The seeds table is in a separate Postgres schema with restricted access.
- Server seed rotation is logged immutably.
- The reference implementation is published as a standalone HTML page so users can verify offline.

---

## 8. Game engines

Each game lives in `packages/games/{game}` with the following structure:

```
crash/
├── server/
│   ├── round.ts          # Round lifecycle (multiplayer)
│   ├── outcome.ts        # RNG → multiplier curve mapping
│   ├── settle.ts         # Bet settlement against round outcome
│   └── index.ts
├── client/
│   ├── pixi/             # Pixi.js render layer
│   └── react/            # React UI layer (controls, bet panel)
├── shared/
│   ├── types.ts          # Wire types (server ↔ client)
│   └── verification.ts   # Reference verification implementation
└── tests/
```

**Build order, with rationale:**

1. **Dice** — simplest. Validates the entire RNG → ledger → bet → outcome → ledger → animation pipeline end-to-end. If Dice doesn't work cleanly, nothing else will. ~1 week.
2. **Mines** — adds persistent in-flight state (a round can pause; user picks tiles over time). Validates round-state-in-Redis pattern. ~1 week.
3. **Crash** — the hardest game. Multiplayer synchronised round, sub-100ms tick, hundreds of concurrent bets per round. This is where most engineering risk lives. ~3 weeks.
4. **Plinko** — physics-light, server decides bucket via RNG, client animates a deterministic ball path matching the bucket. Lots of UX polish. ~2 weeks.
5. **Blackjack** — classic state machine, single-player vs dealer, basic strategy assumptions for RTP. ~2 weeks.
6. **European Roulette** — simpler state than BJ, but multi-bet UI is non-trivial. ~1.5 weeks.
7. **Baccarat** — last because it's almost trivially simple game logic; UX is the work. ~1 week.

**Locked RTPs** (subject to certification):
| Game | RTP |
|---|---|
| Dice | 99.0% |
| Mines | 97.0% (varies by tile count, this is the configured average) |
| Crash | 99.0% |
| Plinko | 99.0% |
| Blackjack | ~99.5% (assumes basic strategy; configurable house rules) |
| European Roulette | 97.3% (single zero, mathematical) |
| Baccarat | 98.94% (banker bet) |

These are configured as constants in each game's package and enforced by the outcome derivation. Changing an RTP requires Oakley approval and a re-certification submission.

### 8.1 Bet flow (canonical sequence)

Every bet across every game follows this exact flow. Deviations are bugs.

```
1. Client sends BetRequest over WS:
   { gameType, stake, currency, gameParams, idempotencyKey }

2. Game server:
   a. Validate session
   b. Validate not self-excluded
   c. Validate geo / KYC tier / limits (compliance package)
   d. Validate stake within game's min/max
   e. Begin DB transaction:
      - Lock user balance row (row-level lock)
      - Verify balance sufficient
      - Write debit entry (user wallet → escrow, idempotency_key set)
   f. Commit transaction
   g. Compute outcome: RNG.derive(serverSeed, clientSeed, nonce++)
   h. Apply game-specific math
   i. Begin DB transaction:
      - Write debit entry (escrow → house if loss, OR escrow → house for stake + house → user for stake+winnings if win)
      - Write bet row with outcome and ledger transaction IDs
   j. Commit transaction
   k. Send BetResult over WS to user
   l. Publish to live-bets channel for other users to see (anonymised at high stakes)

3. Client renders animation matching the deterministic outcome.
```

**Note:** the client animation is purely cosmetic. The bet result is decided in step (g) before any animation begins. If the client disconnects mid-animation, the bet is settled in the database.

---

## 9. Crypto wallet flow

### 9.1 Deposits

1. User clicks "Deposit BTC" in wallet UI
2. Web app calls `POST /api/wallet/deposit-address` with `{currency: 'BTC'}`
3. Game server calls NOWPayments / CoinsPaid API to generate a unique address bound to user_id + currency. Cached for 24h.
4. User sends crypto from their external wallet to that address
5. Provider webhook fires on confirmation: `{address, amount, txHash, currency}`
6. Game server verifies webhook signature, writes ledger entry: `house_provider_account → user_wallet`, idempotency_key = `deposit:{txHash}`
7. User balance updates in real-time via Redis pub/sub → WS broadcast

**Currency conversion at deposit time:** we hold an internal stable accounting unit `INTERNAL_USDT`. Every deposit in BTC/ETH/SOL/LTC creates two ledger entries: the raw crypto credit (recorded for audit) and a converted INTERNAL_USDT credit at the provider's spot rate. All gameplay happens against INTERNAL_USDT balances. This decouples bet math from crypto volatility within a session.

USDT deposits skip the conversion (1:1).

### 9.2 Withdrawals

1. User requests withdrawal: `{currency, amount, address}`
2. Game server validates:
   - KYC tier 2 verified (mandatory for withdrawals over a low threshold)
   - Address valid for the chosen currency
   - Balance sufficient
   - 24h cumulative withdrawal not over auto-approve threshold
3. Below auto-approve threshold: ledger entries written, broadcast to provider via API, txHash recorded
4. Above threshold: row added to `withdrawal_queue`, manual approval required in admin panel
5. Reconciliation job (hourly): cross-check provider's recorded outbound vs our ledger's withdrawn entries. Drift > 0.5% triggers alert and freezes withdrawals pending investigation.

### 9.3 Provider choice

**v1 will use one of NOWPayments or CoinsPaid.** Final selection deferred to integration phase based on:
- Which one will accept us pre-licence (likely neither fully — we'll have a sandbox account until licensed)
- Settlement speed
- Fee structure
- Withdrawal API quality
- Geographic restrictions

We do not integrate directly on-chain in v1. Direct on-chain is a v2 problem requiring node operations, hot wallet security, and far more engineering than the project supports right now.

---

## 10. Compliance architecture

### 10.1 KYC tiers

| Tier | Triggered by | Required docs | Limits |
|---|---|---|---|
| 0 | Account creation | Email verification | Cannot withdraw |
| 1 | First deposit | Email + declared name + DOB + country | Withdraw up to a low daily threshold |
| 2 | Withdrawal over threshold OR cumulative deposits over threshold | ID document + selfie + proof of address (Sumsub) | Standard limits |
| 3 (VIP / large transactions) | Withdrawals or deposits over a high threshold | Source of funds documentation | Higher limits, manual review |

Specific thresholds are configured in `packages/compliance/thresholds.ts` and approved by Oakley. They will be tuned to licensor requirements at certification.

### 10.2 Geo-blocking

- IP geo-location via MaxMind GeoIP2 database, updated weekly
- VPN/proxy detection via IPQualityScore (or similar) on signup and at-deposit
- Country codes in `restricted_jurisdictions` table block account creation entirely
- Mid-session geo change (player travels to restricted country) flags account; bets from that session blocked but not retroactively voided
- **Australia is permanently in the restricted list** for the lifetime of this codebase

### 10.3 Responsible gambling

Mandatory features built into player UI from day one:
- **Deposit limits:** daily, weekly, monthly, user-configurable, 24h cool-off to increase, instant to decrease
- **Session limits:** time-based reality checks (5/15/30/60 min)
- **Loss limits:** daily/weekly maximum loss caps
- **Cool-off:** 24h, 7d, 30d temporary self-exclusion
- **Self-exclusion:** 6mo, 1yr, 5yr, permanent. Permanent is permanent — no admin override path. Documented in T&Cs.
- **Reality check on session start:** "you've played X this week; net P/L Y"

### 10.4 Audit logging

Every action that changes state in the system writes to `audit_log`:
- Admin actions (mandatory, includes balance adjustments, KYC approvals, withdrawal approvals, account suspensions)
- User account changes (password changes, 2FA toggle, limit changes, self-exclusion changes)
- System actions (automated suspensions, fraud flags)

`audit_log` is append-only with a cryptographic chain (each entry includes the SHA256 of the previous entry's row), making tampering detectable.

---

## 11. Security

### 11.1 Authentication

- Email + password (Argon2id, parameters tuned for ~250ms verification on prod hardware)
- Mandatory 2FA via TOTP for any account that has made a deposit
- Optional WebAuthn/passkey support (deferred to post-launch)
- Session tokens are random 256-bit values, stored in HttpOnly Secure SameSite=Strict cookies
- All authentication endpoints have Cloudflare Turnstile bot protection
- Login attempts rate-limited per IP and per email
- Login alerts emailed on new device/IP

### 11.2 Authorisation

- User can only access their own data. Enforced in every query via `WHERE user_id = current_user_id` patterns. Code-reviewed.
- Admin actions are role-gated. Roles: `support`, `kyc-reviewer`, `withdrawal-approver`, `admin`, `super-admin`. Least-privilege defaults.
- All admin sessions require hardware 2FA.

### 11.3 Secrets management

- All secrets in environment variables, never in code, never in repo
- Production secrets in Hashicorp Vault (self-hosted on Hetzner Cloud)
- Local dev secrets in `.env.local`, gitignored, shared via 1Password vault for team
- Secret rotation playbook documented in `docs/RUNBOOKS/secret-rotation.md`

### 11.4 Data at rest

- Postgres encrypted at rest (Hetzner-managed)
- KYC documents client-side encrypted before upload to S3 with per-user keys derived from a master KMS key
- Backups encrypted with age before transfer to Backblaze B2

### 11.5 Data in transit

- TLS 1.3 only, HSTS enabled, no downgrade
- Cloudflare-managed certificates with automatic rotation
- WebSocket connections over WSS exclusively
- Internal service-to-service calls over private Hetzner network, mTLS for game-server ↔ database

### 11.6 DDoS

- Cloudflare Business plan + Spectrum for WS protection
- Game server origin IPs not exposed
- Cloudflare Argo for tunnel-only origin access
- Rate limits at Cloudflare layer (per-IP request budget) before traffic hits origin

### 11.7 Code security

- All dependencies scanned via Dependabot
- Semgrep CI checks on every PR for common vulnerability patterns
- No `eval`, no `new Function`, no dynamic imports outside well-defined plugin boundaries
- Strict CSP headers, no inline scripts, no `unsafe-eval`
- Penetration test by a gambling-experienced firm before soft launch (planned: Pentest People or similar specialist)

---

## 12. Observability

### 12.1 Logging

Structured JSON logs via Pino. Every log line includes `request_id`, `user_id` (when authenticated), `service`, `severity`. Logs ship to Grafana Cloud Loki.

**What we log:**
- Every HTTP request (path, status, latency, user_id)
- Every WS message (type, user_id, latency)
- Every bet (full lifecycle)
- Every ledger entry (in addition to the row in DB)
- Every admin action
- Every external API call (provider, KYC, etc.)
- Every error with full stack trace via Sentry

**What we don't log:**
- Passwords (ever)
- 2FA secrets
- Session tokens (only the hash for correlation)
- KYC document contents (only metadata)
- Card data (we don't take cards)

### 12.2 Metrics

Prometheus-compatible metrics from every service, scraped by Grafana Cloud:
- HTTP request rate, latency percentiles (p50/p95/p99), error rate per endpoint
- WS connection count, message rate, dropped frames
- Bet rate per game, average stake, payout-to-stake ratio (rolling 1h)
- RTP per game per day (alert if drifting from configured by > 1pp over 24h with statistical significance)
- Wallet balance vs ledger sum reconciliation drift
- Database query latency, connection pool saturation
- Redis ops/sec, memory usage

### 12.3 Alerts

PagerDuty or Grafana OnCall, on-call rotation TBD when team grows beyond 1.

Critical alerts (page immediately):
- Production game-server down for any instance > 2min
- Database primary down or replication lag > 30s
- Wallet reconciliation drift > 0.5%
- RTP drift on any game > 2pp over 1h
- Any successful login from a known-bad IP range
- Any 5xx rate spike > 1% of requests

Warning alerts (Slack, no page):
- Elevated 4xx rates
- Approaching rate limits on external providers
- Cert expiry within 30 days
- Disk usage > 80%

---

## 13. Build and deploy

### 13.1 Branching

- `main` — production. Every merge auto-deploys to prod.
- `staging` — staging environment. Every merge auto-deploys.
- Feature branches: `feat/{ticket}-{slug}`. PR'd to `staging`, then `staging` cut to `main`.
- Hotfix: branch from `main`, PR straight to `main` after expedited review.

### 13.2 CI

Every PR runs:
1. Type check (`tsc --noEmit` across all packages via Turbo)
2. Lint
3. Unit tests (Vitest)
4. Build (must produce all artifacts)
5. Integration tests (game-server tests against ephemeral Postgres + Redis)
6. Schema migration dry-run against staging Postgres

PRs merge only on green and required approvals (CODEOWNERS-enforced).

### 13.3 CD

- Vercel deploys `apps/web` automatically on `main` merge
- Game-server deploy is a Terraform + Ansible pipeline triggered by GitHub Actions: blue/green across the three Hetzner instances, drains WS connections gracefully (60s warning sent to clients before drop), health-checked before traffic shift
- Migrations run in a separate job before app deploy. Migrations are forward-only; no rollbacks. Mistakes are corrected by forward migration.

### 13.4 Environments

| Env | URL | Purpose |
|---|---|---|
| Local | `localhost` | Dev |
| Staging | `staging.solsticebet.internal` | Pre-prod testing, never real money |
| Prod | `solsticebet.com` | Real money |

Prod is the only environment with real crypto rails. Staging uses sandbox/testnet keys.

---

## 14. What we are explicitly not building in v1

Decisions that look like gaps but are intentional:

- **Sportsbook** — out of scope. Architected so a sportsbook service could be added later as a sibling to game-server, sharing the wallet/ledger/auth packages. Not built.
- **Slots aggregation** — requires provider deals (Pragmatic, Hacksaw, BGaming, etc.) that need a licence in hand. Will integrate one provider as v1.5 once licensed.
- **Live dealer** — Evolution Gaming integration is months of work plus contractual minimums. v2.
- **Native mobile apps** — web-first. The Next.js web app is mobile-responsive. Native apps post-traction.
- **Fiat rails** — too painful pre-licensing. Crypto-only at launch.
- **Affiliate program** — architected (referral codes in user table, attribution on first deposit) but the affiliate dashboard / payout logic is v1.5.
- **VIP / loyalty system** — architected (player-tier field exists) but cashback / rakeback automation is v1.5.
- **Tournaments / leaderboards beyond simple weekly** — out of scope.
- **Multilingual** — English at launch. i18n infrastructure (next-intl) baked into web app from day one so adding languages is a translation problem, not a dev problem.
- **On-chain integration / smart contracts** — provably-fair via HMAC, not on-chain. Reasonable people disagree; we are not solving on-chain in v1.

---

## 15. Build plan and milestones

Workstreams run in parallel where possible. Dates are deliberately not committed here — they belong on a project tracker, not in an architecture document.

| # | Workstream | Depends on | Owner |
|---|---|---|---|
| 1 | Legal: AU opinion, Anjouan filing, offshore entity | Nothing | Oakley + lawyer |
| 2 | Repo setup, monorepo, CI/CD, infrastructure-as-code | 1 (entity for hosting) | Oakley |
| 3 | RNG package + 100% test coverage | 2 | Oakley |
| 4 | Database schema + migrations + ledger package | 2 | Oakley |
| 5 | Auth + sessions + 2FA + Turnstile | 4 | Contractor 1 |
| 6 | Wallet + crypto provider integration (sandbox) | 4 | Oakley |
| 7 | Compliance package (geo, KYC, limits, self-excl) | 4 | Oakley + Contractor 1 |
| 8 | Game: Dice (validates pipeline) | 3, 4 | Contractor 1 |
| 9 | Game: Mines | 8 | Contractor 1 |
| 10 | Game: Crash | 8, 9 | Contractor 1 + 2 |
| 11 | Game: Plinko | 8 | Contractor 2 |
| 12 | Game: Blackjack | 8 | Contractor 2 |
| 13 | Game: European Roulette | 8 | Contractor 2 |
| 14 | Game: Baccarat | 8 | Contractor 2 |
| 15 | Web app shell (lobby, wallet UI, profile, KYC) | 5, 7 | Contractor 1 |
| 16 | Admin panel | 4, 7 | Oakley |
| 17 | Sumsub KYC integration | 7 | Oakley |
| 18 | Verification page (provably-fair UI) | 3 | Contractor 1 |
| 19 | Pen test, RNG cert submission, game audits | 8–14 | External labs |
| 20 | Soft launch (capped deposits, one or two markets) | 15, 19 | Oakley |
| 21 | Licensor sign-off, public launch | 1, 19, 20 | Oakley |

Workstream 3 (RNG) is the **next deliverable after this document**. It's the foundation; nothing real gets built before it.

---

## 16. Open questions

These are decisions deferred but tracked, to be resolved before they block progress:

1. **Crypto provider**: NOWPayments vs CoinsPaid vs new entrant. Decision in workstream 6.
2. **Support tooling**: Crisp vs Intercom vs Zendesk. Decision before workstream 15.
3. **AU legal opinion outcome**: assumed positive based on current understanding. If opinion is restrictive, full project re-scope.
4. **Anjouan licensor sub-agent**: which broker we file through. Decision in workstream 1.
5. **Pen test firm**: candidates include Pentest People, Cure53, or a gambling specialist. Decision before workstream 19.
6. **RNG cert lab**: iTech Labs vs GLI vs BMM. Decision in workstream 3.
7. **i18n languages at v1.5**: probably PT-BR, ES, RU based on crypto casino market data. Confirm at launch.

---

## 17. Glossary

| Term | Meaning |
|---|---|
| GGR | Gross Gaming Revenue — total stakes minus total payouts |
| RTP | Return to Player — long-run percentage of stakes paid back as winnings |
| KYC | Know Your Customer — identity verification |
| AML | Anti-Money-Laundering |
| RNG | Random Number Generator |
| WS | WebSocket |
| HMAC | Hash-based Message Authentication Code |
| Provably fair | Class of casino games where a player can independently verify each outcome was not manipulated |
| Server seed | Casino-generated secret used in provably-fair RNG |
| Client seed | Player-controlled value mixed into provably-fair RNG |
| Ledger | Append-only record of every credit and debit |
| House | The casino's own accounts in the ledger |
| Escrow | Temporary account holding stakes mid-bet |

---

## 18. Document changelog

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-05-03 | Oakley + Claude | Initial draft |

---

**End of document.**

Next deliverable: `docs/SCHEMA.md` — full Postgres schema with every table, column, constraint, and index.
