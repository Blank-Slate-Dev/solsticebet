# Database Schema

🚧 **Pending.** This document is the next deliverable after the repo scaffold.

It will contain:

- Full Postgres schema for every table (identities, KYC, ledger, bets, rounds, audit log, restricted jurisdictions, withdrawal queue)
- Every column with type, nullability, default, and rationale
- Every index with rationale
- Every constraint, including the trigger that enforces ledger entries summing to zero per transaction
- Migration policy
- Backup and recovery procedure

See `ARCHITECTURE.md` § 6 for the architectural overview that this schema implements.
