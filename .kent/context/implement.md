# Implementation Context

Required:
- `AGENTS.md`, `.kent/project-contract.md`, `.kent/workflow-profile.toml`.
- External R2 accepted snapshot/working revision and exact active findings/checkpoint.
- Installed Kit durable-context reference for R2 revisions and cache semantics.
- `.kent/commands/feature-implement.md`, or `.kent/commands/fix.md` for Fix.
- Source files affected by the accepted slice and `tools/verify_site.py`.

Conditional:
- Asset changes: affected files under `assets-fixed-v3/`.
- Contract drift: installed Kit Plan Contract and durable-context references.

Keep the immutable task baseline distinct from the moving merge target.
