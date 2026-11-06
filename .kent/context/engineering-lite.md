# Engineering Lite context

Required at every stage:
- `AGENTS.md`, `.kent/project-contract.md`, `.kent/workflow-profile.toml`.
- The exact incoming immutable plan and decision references, native Task and
  current stage identity. Obtain native state; never infer it from this file.
- The installed Kent Engineering Kit skill.

For Plan, Plan Review, Implement, Verification and Candidate Review, load the
installed skill's `references/durable-context.md` and only relevant product
sources. Fit is a static HTML/CSS/JavaScript site.

Implement and Verification own execution of `python3 tools/verify_site.py`
and task-specific checks. Plan may inspect the verifier and define checks;
Plan Review and Candidate Review inspect source and actual verification
results read-only. Reviewers never execute artifact-producing checks,
including this verifier's fixture-writing unittest suite.

The verifier provides structural checks only. Changed UI behavior
also needs real browser checks and deterministic regression tests for changed
logic; structural checks do not prove browser behavior. Record failed and
unavailable checks honestly against exact candidate commit and tree.

For Publish and Observe, load `.kent/commands/delivery-lite.md`.
For Cleanup, load `.kent/commands/cleanup-lite.md` and the installed Kit's
`contracts/worktree-contract.md` through the skill's verified source binding.

This manifest selects no legacy acceptance, ledger, checkpoint, Janitor or
mobile tooling. Existing compatibility Workflows retain their own manifests.
