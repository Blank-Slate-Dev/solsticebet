# ADR-0001: Foundational stack and architecture

**Status:** Accepted
**Date:** 2026-05-03
**Author:** Oakley

## Context

Solstice is a licensed crypto casino targeting Anjouan licensing. We needed to choose the foundational stack before writing any code, knowing the choices have a 3-5 year lifespan and shape every subsequent decision.

## Decision

The foundational stack and major architectural choices are:

1. **Monorepo via Turborepo + pnpm workspaces.** Single Git repo. Atomic cross-package commits.
2. **TypeScript everywhere, strict mode, ESM modules, Node 22 LTS.**
3. **Frontend:** Next.js 14 App Router + Tailwind. Pixi.js v8 for canvas-rendered originals. Framer Motion + React for state-heavy table games.
4. **Backend:** Fastify + native `ws` library for game server. Separate process from the Next.js apps.
5. **Database:** PostgreSQL 17 with double-entry ledger, read replica, point-in-time recovery via WAL.
6. **Cache:** Redis 7 for sessions, balances, leaderboards, rate limits, and Crash round state.
7. **Hosting:** Hetzner dedicated for game server, Hetzner Cloud for the rest, Cloudflare for DNS/WAF/DDoS/Spectrum. Vercel for the marketing+web app.
8. **Crypto rails:** NOWPayments or CoinsPaid for v1 — no direct on-chain integration in v1.
9. **KYC:** Sumsub.
10. **Game scope v1:** Dice, Mines, Crash, Plinko (originals); Blackjack, European Roulette, Baccarat (table games). No slots, no sportsbook, no live dealer.
11. **Currencies v1:** BTC, ETH, USDT (ERC-20 + TRC-20), SOL, LTC. Crypto-only at launch. No fiat.
12. **Restricted-package model:** `rng`, `ledger`, `wallet`, `compliance` are CODEOWNERS-restricted to Oakley. Contractors cannot merge to those packages.
13. **Provably-fair via HMAC-SHA256.** Not on-chain.

## Consequences

**Positive:**

- All choices are battle-tested in this domain
- Cost-efficient at scale ($650/mo at start, ~$1.5–3k/mo at $1M GGR)
- Architecture supports the certification process from day one
- Restricted-package model gives defence-in-depth on money-touching code
- Crypto-only at launch dramatically simplifies licensing and compliance

**Negative:**

- Hetzner requires more ops skill than AWS — partially mitigated by IaC and managed Postgres
- No fiat means a smaller addressable market initially
- Pixi.js for originals adds a renderer dependency the team needs to learn
- Restricted-package model adds review latency on PRs to those packages

**Neutral:**

- We are explicitly not building sportsbook, slots, or live dealer in v1. They are deferred.
- We are explicitly not integrating directly on-chain. Custodial via provider in v1.

## Alternatives considered

- **AWS instead of Hetzner:** rejected on cost — 5–10x at scale. Will reconsider if hiring forces the issue.
- **Socket.io instead of native ws:** rejected on per-connection overhead at scale.
- **Express instead of Fastify:** rejected on performance and async ergonomics.
- **NoSQL primary instead of Postgres:** rejected — the ledger pattern requires ACID transactions.
- **Building sportsbook in v1:** rejected on scope. Sportsbook is its own product; bolting it on top of casino architecture poorly is worse than deferring it.
- **Fiat at launch:** rejected — PSP relationships pre-licence are essentially impossible for new casinos.
- **Building the games before the RNG/ledger:** rejected — the games depend on these foundations and would need to be rewritten.
