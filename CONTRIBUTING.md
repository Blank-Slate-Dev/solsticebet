# Contributing to Solstice

> **You must read `docs/ARCHITECTURE.md` before contributing.**

## Ground rules

1. **No `Math.random()` anywhere in game logic.** Use `@solsticebet/rng`.
2. **No mutating balances.** All balance changes go through `@solsticebet/ledger`.
3. **No bypass of compliance checks.** Every bet flows through `@solsticebet/compliance`.
4. **No secrets in code.** Use environment variables. Never commit `.env` files.
5. **No `console.log` in production code.** Use the logger from `@solsticebet/observability`.

## Workflow

1. Branch from `staging` for features: `feat/<ticket>-<slug>`
2. Branch from `main` for hotfixes: `hotfix/<ticket>-<slug>`
3. Open PR with the template filled out
4. CI must be green
5. CODEOWNERS approval required
6. Squash-merge to staging or main

## Commit messages

Conventional commits:

- `feat: add Mines round resume`
- `fix(rng): correct nonce overflow`
- `chore: bump turborepo to 2.3.4`
- `docs: clarify ledger reversal pattern`

## Restricted packages

If your change touches `packages/rng`, `packages/ledger`, `packages/wallet`, `packages/compliance`, or `packages/db/migrations`, expect a slower review. These are reviewed line-by-line by Oakley alone. Plan accordingly.

## Tests

- Unit tests required for any new function in a restricted package (100% line coverage)
- Unit tests strongly encouraged elsewhere
- Integration tests required for game-server endpoints
- E2E tests for critical flows (signup, deposit, bet, withdraw)

## Questions

Ask in the team Slack before opening a PR for anything non-trivial. Cheaper than a rejected PR.
