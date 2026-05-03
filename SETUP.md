# Local Setup

> Goal: get the repo installing, linting, typechecking, and (eventually) testing on your laptop.

## Prerequisites

You need:

1. **Node 22** — install via [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm)
2. **pnpm 9** — install via Corepack (see below)
3. **Git** — already have it
4. **Docker Desktop** — for running Postgres + Redis locally (you'll need this once we add the database)

Windows users: this all works in PowerShell. WSL2 is recommended but not required.

## First-time setup

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/solsticebet.git
cd solsticebet

# 2. Pick the right Node version
# If you use fnm:
fnm use
# If you use nvm:
nvm use

# 3. Enable Corepack so pnpm version is pinned
corepack enable

# 4. Verify pnpm is the right version (should match package.json's packageManager field)
pnpm --version
# Expected: 9.15.0 or compatible

# 5. Copy the env example
cp .env.example .env.local
# Edit .env.local — but only what you need for the package you're working on

# 6. Install dependencies
pnpm install
```

## Verify the toolchain

After install, these should all succeed (even with empty packages):

```bash
pnpm format:check    # Prettier formatting check
pnpm lint            # ESLint
pnpm typecheck       # TypeScript (will pass — packages are empty)
pnpm test            # Vitest (no tests yet — that's fine)
pnpm build           # Turborepo orchestrates all package builds
```

If any of those fail at this stage, **stop and ask** before adding code. The toolchain needs to be green before any business logic lands.

## What's next

The next deliverable is the `@solsticebet/rng` package — the provably-fair random number generator. Once that lands, you'll be able to run `pnpm --filter @solsticebet/rng test` and see real tests pass.

After that: `@solsticebet/ledger`, then the first game (`@solsticebet/game-dice`).

## Troubleshooting

**"Cannot find module '@solsticebet/rng'" in another package:**
You need to run `pnpm install` from the repo root, not from inside a package.

**"Command not found: turbo":**
`pnpm install` should have provisioned it. If not, `pnpm install -w turbo`.

**ESLint errors about parserOptions.project:**
Make sure your `tsconfig.json` is valid in the package you're touching. ESLint reads the TS project structure.

**Anything else:**
Open an issue or ask in the team chat.
