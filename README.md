# Solstice

Licensed crypto casino. Originals (Crash, Mines, Plinko, Dice) and table games (Blackjack, Roulette, Baccarat).

> **Internal repository.** Not for public distribution. See `docs/ARCHITECTURE.md` before changing anything.

## Status

🚧 **Pre-launch.** This codebase is under active construction toward soft launch. Not yet operational.

## Quick start

```bash
# Prerequisites: Node 22 (use nvm/fnm), pnpm 9
nvm use            # picks up .nvmrc
corepack enable    # picks up packageManager from package.json
pnpm install

# Run everything in dev mode (parallel)
pnpm dev

# Or run a specific package
pnpm --filter @solsticebet/rng test:watch
```

## Repository layout

| Path | Purpose |
|---|---|
| `apps/web` | Player-facing Next.js app (solsticebet.com) |
| `apps/admin` | Internal admin panel |
| `apps/game-server` | Fastify + WebSocket game server |
| `packages/rng` | ⚠️ **Restricted.** Provably-fair RNG. |
| `packages/ledger` | ⚠️ **Restricted.** Double-entry ledger. |
| `packages/wallet` | ⚠️ **Restricted.** Crypto deposit/withdraw. |
| `packages/compliance` | ⚠️ **Restricted.** Geo, KYC, limits, self-exclusion. |
| `packages/games/*` | Game engines |
| `packages/auth` | Sessions, 2FA |
| `packages/db` | Prisma schema, migrations |
| `packages/ui` | Shared React components |
| `packages/design` | Design tokens, Tailwind preset |
| `packages/shared-types` | Cross-package TypeScript types |
| `packages/observability` | Logging, metrics, tracing |
| `packages/config` | Shared eslint/tsconfig presets |
| `infra/` | Terraform + Ansible |
| `docs/` | Architecture, schema, RNG spec, runbooks |

## Restricted packages

The packages marked ⚠️ are subject to **CODEOWNERS-enforced review by Oakley**. Contractors can read these packages and propose changes via PR but cannot merge them. This is a defence-in-depth control on the parts of the system that touch money or fairness.

## Documentation

Read these in order:

1. `docs/ARCHITECTURE.md` — system architecture (canonical)
2. `docs/SCHEMA.md` — database schema (coming soon)
3. `docs/RNG.md` — provably-fair specification (coming soon)
4. `docs/LEDGER.md` — ledger semantics (coming soon)

## Contributing

See `CONTRIBUTING.md`.

## Licence

Proprietary. All rights reserved.
