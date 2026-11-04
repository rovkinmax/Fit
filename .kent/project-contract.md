# Fit Project Contract

Fit is a vanilla HTML/CSS/JavaScript static site at repository root.
`assets-fixed-v3/` contains the existing image collection. Preserve referenced
assets and existing user-facing behavior outside approved task scope.

Product verification is `python3 tools/verify_site.py`, usable locally and in
GitHub CI without Kent. The project compile adapter translates its exit status
to the Kit JSON protocol and sends diagnostics to stderr. A missing verifier
is blocked, never a pass. These structural checks are not proof of browser
interaction or layout behavior. UI changes also require task-specific browser
checks and deterministic regression tests for changed logic, with actual
evidence recorded before PR delivery.

## R2-only durable documents

Read the active context manifest first. Native storage must resolve to R2
through the qualified installed `kent-project-memory workflow` interface.
Missing or conflicting installation, primary identity, native Task/Session
binding or storage records block; never fall back to local `.todo`, a legacy
bootstrap or an import. Do not fabricate an empty legacy inventory.

The profile's external root, namespace and stable project UID are PROPOSED
deployment values, pending human approval. The UID matches an observed native
project ID; that observation does not approve the namespace or allocate it.
Profile/helper presence alone grants no R2 or native execution effects.
Ordinary R2 registration is a separate installer-owned effect after its repair
is published; it does not require shared-alias upgrades or claim full
mixed-runtime source admission. Explicit source-gated routes retain their own
admission requirements.

At actual first native Plan ingress, use genuine current Task/Session identity
to initialize the R2 Task through the installed adapter, then publish the
working plan as an immutable revision with compare-and-swap. The selected
graph owns independent review and Script acceptance. R2 accepted head and
immutable snapshot are authoritative; original decision locators still need
original-source verification. Knowledge is context, not approval.

## Selected lifecycle

The selected schema-3 Delivery graph retains its existing 23-node/70-edge
Plan Contract, evidence, checkpoint, CI/PR, Cleanup and Script Janitor route.
These are selected legacy-protocol execution mechanisms, not legacy document
storage. R2 adoption does not select an Agent-owned cleanup route or migrate
the graph implicitly. Canary is separate and omits PR/CI qualification.

For an R2 Task, a local `plan-contract.json`, when present, is only the
validated `r2-plan-contract-cache-v1` locator. Read external accepted state
directly when absent; do not restore the cache as a read-side repair.
Conflicting cache bytes block. The Cleanup procedure retains external accepted
identity and retires only the disposable cache when present. It never removes
external revisions, accepted heads or knowledge.

Keep `.kent/runtime/`, `.kent/retained-evidence/` and `build/kent-workflow/`
ignored before runtime use. Evidence uses configured helpers and genuine
native execution identity. No mobile tooling, packaging or release is selected.

Delivery authority and production restrictions are in `AGENTS.md`.
`pr_merge_strategy=auto` selects a supported merge method, not auto-merge
permission. CI requires actual checks for the exact PR head.

## Bootstrap readiness

This is an offline, uninstalled candidate. After installer publication, refresh
helper provenance and regenerate the complete graph/preview before final
independent reviews and explicit installation approval. Ordinary R2
registration, non-default Workflow installation and qualification Tasks are
distinct effects; this document authorizes none.

Before default promotion or feature-task execution, qualify the actual native
R2 first ingress, immutable publication/CAS, independent review and Script
acceptance, continuation/verification, managed worktrees, PR/CI, and Cleanup
including cache-present, cache-absent, conflicting and interrupted cases.
Retain qualification evidence outside retiring worktrees. Read back real
native inventory at registration; a prior empty inventory is not current
proof. Profile validation and offline graph generation are not lifecycle
readiness. Shared tooling/alias upgrades, global configuration changes and a
Kent restart are not part of this Fit candidate.
