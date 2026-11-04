# Review Context

Required:
- `AGENTS.md`, `.kent/project-contract.md`, `.kent/workflow-profile.toml`.
- Exact review subject, external R2 plan revision/snapshot, original
  requirements and actual checks.
- Affected diff and source files; for Plan Review, proposed plan instead.

Conditional:
- Deterministic verification: `tools/verify_site.py` and its actual output.
- Plan Review or recovery: installed Kit durable-context reference; exact
  immutable revision/digest and original authority sources, not cache authority.

Read-only review; no source, checkpoint or lifecycle edits. Only the current
Workflow node's required evidence append is permitted through its qualified
adapter with genuine identity. Never append for a sibling node or seal.
