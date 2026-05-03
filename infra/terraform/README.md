# Terraform — Hetzner Cloud + Cloudflare

🚧 **Pending.** Lands when we provision the first staging environment.

Will manage:

- Hetzner Cloud servers (game server replicas, Redis, admin panel host)
- Hetzner managed Postgres
- Cloudflare DNS, WAF, page rules, Spectrum config
- Backblaze B2 buckets for backups

State lives in Hetzner Storage Box with state locking via DynamoDB-equivalent (TBD).
