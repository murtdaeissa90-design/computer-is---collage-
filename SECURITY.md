# Security Policy

## Reporting a vulnerability
Please do **not** open a public issue for security problems. Report privately through **GitHub > Security > Report a vulnerability** on this repository, and include the steps to reproduce and the affected page or function.

We aim to acknowledge reports within a few days.

## Scope
The Students IS website, its Supabase policies (`supabase/*.sql`) and its Edge Functions (`supabase/functions/`).

## Design notes
- Authorization is enforced by Supabase **Row Level Security**, not by the browser.
- Student uploads go to a private bucket and are published only after an admin approves them.
- Secret keys are never exposed to the client. The full permission model is in [docs/SECURITY.md](docs/SECURITY.md) (Arabic).
