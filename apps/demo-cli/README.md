# @solsticebet/demo-cli

Interactive terminal demo for Solstice. Spins up an in-memory ledger, funds a user with 1000 USDT, and lets you place real Dice/Mines/Plinko bets against the real RNG and ledger.

**Not for production.** Demo / learning only. Real product is the game-server + web app.

## Run it

```bash
pnpm demo
```

(Or from this directory: `pnpm start`.)

## What it shows

- Real provably-fair Dice, Mines, and Plinko bets
- Ledger entries for every transaction (stake debit, win/loss/refund settlement)
- Balance updating in real time
- Server seed hash committed at session start; revealed seed visible in the menu
