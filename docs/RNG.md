# Provably-fair RNG — Specification

**Status:** Accepted v1.0
**Last updated:** 2026-05-03
**Owner:** Oakley
**Audience:** Engineering, certification labs, security auditors

---

## 0. Purpose

Define the algorithm and operational lifecycle for Solstice's provably-fair random number generator. Every original game outcome (Dice, Mines, Crash, Plinko) is derived from this RNG. Every bet receipt links to a verification page where the player can independently re-derive the outcome.

Table games (Blackjack, Roulette, Baccarat) also use this RNG for shuffles, wheel spins, and card draws, but their outcomes are typically not surfaced to the player as "verifiable" in the same way — the integrity guarantee is the same; the UI affordance differs.

The licensor and the certification lab both inspect this module line by line. **Get it right.**

---

## 1. Properties we are guaranteeing

A correct provably-fair implementation gives players these guarantees:

1. **Pre-commitment.** Before any bet is placed, the casino has committed (via a published hash) to a server seed value. The casino cannot change the server seed mid-stream without the player noticing.
2. **Verifiability.** After a server seed is rotated, the casino reveals the seed. Any player can take their `(serverSeed, clientSeed, nonce)` triple, re-run the algorithm, and verify the outcome matches what the casino reported.
3. **Independence.** The casino cannot manipulate outcomes for a specific player after-the-fact, because the seed was committed before any bet.
4. **Player influence.** The player can change their `clientSeed` at any time, forcing fresh outcomes they have direct input into. This protects against the casino choosing seed pairs adversarially.
5. **Determinism.** Given the same `(serverSeed, clientSeed, nonce)`, the algorithm always produces the same output. No hidden state, no environmental input.

These properties only hold if the implementation matches this spec exactly.

---

## 2. The algorithm

### 2.1 Inputs

| Name         | Type    | Format                  | Source                                                                     |
| ------------ | ------- | ----------------------- | -------------------------------------------------------------------------- |
| `serverSeed` | string  | 64 hex chars (32 bytes) | Casino-generated, kept secret until rotation                               |
| `clientSeed` | string  | 1–64 chars, ASCII       | Player-set, can be changed anytime                                         |
| `nonce`      | integer | unsigned, ≥ 0           | Increments by 1 per bet for a given (user, server seed) pair               |
| `cursor`     | integer | unsigned, ≥ 0           | Used when a single bet needs more than 32 bytes of randomness; starts at 0 |

### 2.2 Derivation

Compute the HMAC-SHA256 of a deterministic message under the server seed:

```
message = clientSeed + ":" + nonce + ":" + cursor
hmac    = HMAC-SHA256(key = serverSeed_bytes, message = message_bytes)
```

Where:

- `serverSeed_bytes` = the 32 raw bytes obtained by hex-decoding `serverSeed`
- `message_bytes` = UTF-8 encoding of the message string
- `clientSeed` is used as-is, as the player provided it (no normalisation, no case folding, no trimming)
- `nonce` and `cursor` are decimal-formatted integers, no leading zeros

The HMAC output is 32 bytes. We use it as a stream of randomness.

### 2.3 Converting bytes to floats in [0, 1)

Most game math wants uniform `[0, 1)` floats, not raw bytes. We slice the 32-byte HMAC into 8 chunks of 4 bytes each. Each 4-byte chunk produces one float:

```
chunk_index ∈ {0, 1, 2, 3, 4, 5, 6, 7}
byte_offset = chunk_index * 4
b0 = hmac[byte_offset + 0]
b1 = hmac[byte_offset + 1]
b2 = hmac[byte_offset + 2]
b3 = hmac[byte_offset + 3]

float = b0 / 256
      + b1 / 256^2
      + b2 / 256^3
      + b3 / 256^4
```

This produces 8 floats per HMAC call, each uniformly distributed in `[0, 1)`.

This particular construction (sum of bytes weighted by descending powers of 256) is the **Stake-style construction**. It is the published, audited, certified construction used by Stake.com, Roobet, BC.Game, and most Stake-derivative casinos. We adopt it because:

- It has a public, auditable history (Stake Engineering blog, multiple cert lab reports, years of player-side verification implementations)
- Cert labs already understand it
- Players can verify against any major casino's published implementation
- The math gives a clean uniform distribution over `[0, 1)` with 4 bytes of entropy per float — sufficient for any game outcome we'll derive

### 2.4 When you need more than 8 floats per bet

If a single bet needs more than 8 floats (e.g., a Mines round on a 5×5 grid needs to permute 25 tiles → uses ~25 floats), the implementation increments the `cursor` and computes a new HMAC. Floats from the new HMAC continue the stream:

```
needed_count = 25
floats = []
cursor = 0
while length(floats) < needed_count:
    h = HMAC-SHA256(serverSeed, clientSeed + ":" + nonce + ":" + cursor)
    floats.append(8 floats from h)
    cursor += 1
return floats[:needed_count]
```

The `cursor` is part of the verification state. Users verifying a bet supply `(serverSeed, clientSeed, nonce, cursor)` and the cursor index of the float that produced their outcome.

---

## 3. Game outcome mappings

Each game converts the float stream to its specific outcome space. These mappings are **defined here and only here** — game packages import the mapper, they don't roll their own.

### 3.1 Dice

Dice produces a roll value in `[0, 100)` to two decimal places.

```
float = first float from the stream
roll  = floor(float * 10000) / 100
```

Range: `0.00` to `99.99` inclusive.

### 3.2 Mines

Mines produces a permutation of integers `[0, 25)` representing the order in which tiles will be revealed as mines vs safe.

We use Fisher-Yates shuffle, drawing one float per swap:

```
indices = [0, 1, 2, ..., 24]
for i = 24 down to 1:
    f = next float from stream
    j = floor(f * (i + 1))
    swap indices[i] and indices[j]
return indices
```

This consumes 24 floats per round. The first `mineCount` entries of `indices` are the mine positions.

### 3.3 Crash

Crash produces a multiplier in `[1.00, ∞)` representing the round's bust point. Algorithm fully specified at implementation time, derived from the standard Stake-style published curve with 1% house edge.

### 3.4 Plinko

Plinko's path is determined by N independent left/right decisions (one per row). For an 8-row board:

```
path = []
for i = 0 to 7:
    f = next float from stream
    direction = (f < 0.5) ? 'left' : 'right'
    path.append(direction)
return path
```

The bucket index is the count of "right" decisions in the path.

---

## 4. Server seed lifecycle

### 4.1 Generation

A new server seed is 32 cryptographically-random bytes from a CSPRNG (Node's `crypto.randomBytes`, never `Math.random`). Hex-encoded for storage.

### 4.2 Pre-commitment (publication of hash)

Before a server seed is used for any bet:

1. Compute `serverSeedHash = SHA-256(serverSeed_bytes)`, encoded as 64 hex chars
2. Insert a row into `server_seeds` table: `(seed_hash, seed_secret_encrypted, status='pending', user_id, created_at)`
3. Surface `serverSeedHash` to the player in the verification UI

The hash is the casino's public commitment. It is shown to the user _before_ their first bet against this seed. Any tampering with the seed post-commitment is detectable.

### 4.3 Active use

While `status='active'`:

- Bets increment `nonce` for this `(user, server_seed)` pair
- Each bet stores the `(server_seed_id, nonce, cursor)` triple in the bet record
- The seed value itself is **never logged, never returned in any API response, never visible to anyone except the bet derivation function**

### 4.4 Rotation

A server seed rotates when:

- The user clicks "rotate seed" in the verification UI
- The user changes their client seed (forces a rotation to ensure the previously-committed-to seed isn't reused with the new client seed)
- The nonce reaches `MAX_NONCE` (defined as 1,000,000 — far more than any real user will hit)
- Manual rotation by an admin (logged in audit_log)

On rotation:

1. Mark the current seed `status='revealed'`, set `revealed_at = NOW()`
2. The plaintext seed is now available via the verification API for any bet that referenced this seed
3. Generate a new server seed, publish its hash, set it active
4. Increment `nonce` starts again at 0 for the new seed

### 4.5 Reveal

When a seed is `revealed`, the verification page exposes:

- The original `serverSeedHash`
- The plaintext `serverSeed`
- A re-computed `SHA-256(serverSeed)` so the player can confirm hash equality
- Every bet placed against that seed, with `(nonce, cursor)` and the derived outcome

The player can paste these into our reference implementation (or any other implementation) and verify their bet.

---

## 5. Client seed lifecycle

### 5.1 Default

On account creation, a default client seed is generated as 16 random hex chars. The user can change it at any time.

### 5.2 Change semantics

When the user changes their client seed:

1. The current server seed is rotated immediately (see § 4.4)
2. The new client seed becomes active
3. Future bets use the new client seed

### 5.3 Constraints

- 1 to 64 ASCII characters
- We do **not** normalise (no trim, no lowercase, no Unicode normalisation)
- The user sees exactly what they entered, and the algorithm uses exactly what they entered
- Empty client seed is rejected at the API layer (not in the RNG module — the RNG module accepts any non-zero-length string)

---

## 6. Storage schema (referenced from `packages/db`)

```sql
CREATE TABLE server_seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  seed_hash TEXT NOT NULL,                    -- SHA-256 hex, 64 chars
  seed_secret_encrypted BYTEA NOT NULL,       -- AES-256-GCM encrypted plaintext
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'revealed')),
  client_seed_id UUID REFERENCES client_seeds(id),
  nonce_max BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  revealed_at TIMESTAMPTZ
);

CREATE TABLE client_seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  value TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_client_seeds_active ON client_seeds(user_id) WHERE is_active = TRUE;
CREATE UNIQUE INDEX idx_server_seeds_active ON server_seeds(user_id) WHERE status = 'active';
```

The seed plaintext is stored encrypted at rest. The encryption key is held in Vault and never reaches the application logs.

---

## 7. Reference verification implementation

A standalone HTML page at `packages/rng/verify.html` lets players verify any historical bet **offline, with no network calls**. The page contains:

- Inputs: serverSeed, clientSeed, nonce, cursor, gameType
- Output: derived outcome, expected to match the casino's record
- The full algorithm in vanilla JavaScript, viewable via "View Source"

The reference implementation is the source of truth for "what the player can verify." If the reference and the server disagree, **the server is wrong**. This is enforced by tests: a property test runs both implementations on millions of inputs and asserts they agree.

---

## 8. Security requirements

These are mandatory and enforced by code review:

1. **Server seeds use `crypto.randomBytes`, never `Math.random`.** Math.random is a PRNG, not a CSPRNG, and outputs are predictable.
2. **HMAC-SHA256 uses Node's built-in `crypto.createHmac`** or the equivalent constant-time implementation. No third-party crypto libraries unless audited.
3. **Constant-time hash comparison** when verifying server seed reveals (`crypto.timingSafeEqual`).
4. **Seeds are never logged.** Logger middleware redacts any field named `serverSeed`, `seed`, or matching the 64-hex pattern.
5. **Seeds are never returned in API responses while `status` is `pending` or `active`.**
6. **The seeds table is in a separate Postgres schema** (`secrets`) with its own access role.
7. **No `eval`, no `new Function`, no dynamic require.** Enforced by the ESLint config at the repo level.
8. **`MAX_NONCE` = 1,000,000.** Forces seed rotation before any meaningful birthday-paradox concern emerges with a 32-byte HMAC. Mathematically conservative.

---

## 9. Test plan

The package has the following test categories. All must pass before merge.

### 9.1 Vector tests

A fixed table of known-good `(serverSeed, clientSeed, nonce, cursor) → expected_floats` triples. ~20+ vectors covering boundary cases and a typical sample. If any vector fails, the implementation is wrong.

### 9.2 Property tests

Generate large numbers of random `(serverSeed, clientSeed, nonce)` tuples and assert:

- All output floats lie in `[0, 1)` (never `< 0`, never `≥ 1`)
- Mean ≈ 0.5 within statistical tolerance
- Variance ≈ 1/12 within statistical tolerance
- The reference HTML implementation produces identical floats for the same inputs

### 9.3 Game mapping tests

For each game (Dice, Mines, Plinko at v1.0; Crash deferred to its own implementation phase):

- Distribution test: simulate large samples, verify the empirical RTP/distribution matches the theoretical within tolerance
- Boundary tests: edge cases (Dice roll = 0.00, Dice roll = 99.99)
- Determinism: same inputs → same outputs across N runs

### 9.4 Negative tests

- Invalid server seed (wrong length, non-hex chars) → error
- Invalid client seed (empty, > 64 chars) → error
- Negative nonce → error
- Negative cursor → error

### 9.5 Coverage

100% line coverage on the core derivation function. No exceptions. Enforced in CI.

---

## 10. Out of scope

What this document explicitly does not cover:

- **Hardware random number generators.** Cert labs accept HMAC-SHA256-based provably-fair RNG without a hardware RNG behind it, provided the seed source is a properly-seeded CSPRNG. We do not run an HRNG.
- **Quantum-resistant variants.** SHA-256 is acceptable to all current licensors. Post-quantum migration is a >5-year concern.
- **On-chain verification.** Some casinos commit seed hashes on-chain. We do not, in v1. The trust model is: published hash → revealed seed → user verifies. On-chain commitment is a v2 concern.
- **Casino-side variance.** RTP drift detection (whether actual RTP matches theoretical) lives in `packages/observability`, not here.

---

## 11. Document changelog

| Version | Date       | Author          | Change        |
| ------- | ---------- | --------------- | ------------- |
| 1.0     | 2026-05-03 | Oakley + Claude | Initial draft |

---

**End of document.**
