# Ledger Semantics

🚧 **Pending.** Lands with the `@solsticebet/ledger` implementation.

Will contain:

- Account model (user wallet, house, bonus, escrow, fees)
- Transaction patterns (deposit, withdraw, bet, win, refund, bonus, adjustment)
- The zero-sum invariant and trigger
- Idempotency contract
- Reversal patterns (no DELETE, no UPDATE — only forward-writing reversals)
- Currency model (raw crypto + INTERNAL_USDT accounting unit)
- Reconciliation procedures
- Audit log integration

See `ARCHITECTURE.md` § 6.2 for the architectural overview.
