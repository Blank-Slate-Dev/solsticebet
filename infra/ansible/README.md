# Ansible — Dedicated Server Provisioning

🚧 **Pending.** Lands when we provision the first dedicated game server.

Will handle:

- OS hardening (Ubuntu 24.04 LTS baseline)
- User provisioning, SSH key management
- Firewall (ufw + Cloudflare-only allowlist)
- Node 22 install via fnm
- Application deployment hooks
- Log shipping config

Inventory split into `staging` and `production` groups.
