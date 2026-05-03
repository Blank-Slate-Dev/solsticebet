# @solsticebet/demo-web

A demo webpage for Solstice. **Not the production web app.**

The real web app lives at `apps/web/` (TBD — needs auth, real backend, real database, real game-server). This is a pretty browser version of the CLI demo: spin up an in-memory ledger client-side, play Dice/Mines/Plinko in the browser.

## Run it

```bash
pnpm --filter @solsticebet/demo-web dev
```

Then open http://localhost:3000 in your browser.

## Limitations (intentional)

- All state is in-memory and resets on page reload
- No auth, no signup, no login
- Bets run client-side (no game-server, no WebSockets)
- One user, fresh balance every session
- Banner makes it clear this is a demo
