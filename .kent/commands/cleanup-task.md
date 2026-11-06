# Cleanup and Accepted-Plan Retention

This is the project-procedure route without `prepare_cleanup`.
Qualify its failure paths during bootstrap before ordinary feature-task use.
Do not copy Kit's project-specific preparation helper.
It retains the selected 23-node/70-edge graph's existing Plan Contract,
terminal-evidence and Script Janitor obligations. R2-only document storage
does not replace them with an Agent-owned cleanup route.

## Read-only admission

Require proven delivery disposition and exact task/worktree ownership. Freeze
original root, branch, task identity, PR/base/head observations and outgoing
carrier before leave. Never infer publication authority from PR permission.
Settle task-owned children; preserve unknown ownership and dirty product state.
Use the installed Kit worktree and evidence contracts for terminal checks.
Before a final append or seal, verify the native primary source workspace's
existing safe `.kent` directory and ignored private retained-evidence location.
This destination is not the retiring worktree. A failed destination preflight
blocks before terminal preparation; do not seal first and discover it later.

From the original root run the configured evidence helper's `validate` and
`read` operations with `--task <actual-task> --workspace <original-root>`.
Inspect the complete actual history and current native identity. An existing
final Cleanup event without its valid seal is partial history: block.
An existing seal can only reuse its original retained request/report after
the native prompt's read-only terminal validation; never append or reseal.

## Resolve and retain external accepted state

Only for a new terminal preparation:

1. Resolve the R2 Task and external accepted head/snapshot through the qualified
   installed `kent-project-memory workflow` interface and configured Plan
   Contract/durable-context readers. Verify actual project/Task identity,
   accepted snapshot path/digest, Task binding digest, accepted plan revision
   and original authority locators. Compare against the accepted contract and
   current native carrier. A missing or conflicting external accepted state
   blocks, regardless of whether a local cache exists.
   Inspect `.kent/runtime/<task>/plan-contract.json` without creating it.
   If present, require `r2-plan-contract-cache-v1`, the exact field set and
   equality to the adapter's validated external `cache_ref`; use the configured
   Plan Contract module's `validate_memory_cache`. Require a private, owned,
   regular, single-link, non-symlink file and safe owned parent directories.
   Check it is ignored and untracked. A legacy full-plan snapshot or differing
   locator is a conflict, not material to import. Unknown runtime entries or
   unsettled checkpoints block. Confirm no live writer/acceptance can change
   accepted state or cache during terminal preparation.
2. Publish an actual agent-authored Task comment using
   `kent task comment add <task> --body-file <prepared-comment>`. Explicitly use
   `--author agent`; never impersonate the user. Include exact external
   accepted snapshot locator/digest, accepted revision/digests, project/Task
   binding identity, task/root/branch identity and original decision locators.
   Record the actual cache observation: present or absent. Only when present,
   include exact cache bytes encoded as base64 and their SHA-256. The external
   plan stays in R2; do not copy document history into comments or local plans.
   Inspect for secrets first; inability to retain safely blocks. This retained
   source record is bookkeeping, not consent and not a parallel plan authority.
   Read the actual record back with `kent task comment list <task>` (paginate
   as needed); bind its real comment ID and task, verify all external locators
   and digests, and, if present, decode and compare exact cache bytes/digest.
   Preserve that real comment locator in the outgoing report.

## Retire only a present disposable cache

3. If the cache was absent, validate the external accepted state directly and
   continue without relocation. Do not call acceptance, republish a plan,
   restore a report-only sentinel, synthesize a cache or invent an archive.
   Recheck cache absence before terminal append; an unexpectedly appearing
   cache blocks for fresh admission. Absence is not proof that any past move
   succeeded; inspect retained Task records for interrupted prior preparation.
   If a cache was present, choose
   `build/kent-workflow/<task>/plan-contract-<sha256>.json` inside the
   original root. Require ignored/untracked storage, safe owned directories,
   same filesystem, and an absent destination. Recheck source identity and
   exact bytes against Task readback and revalidate the unchanged external
   accepted identity immediately before relocation. Use a
   no-overwrite move of only this cache; do not remove the runtime directory.
   Verify source absence and destination byte/digest equality. Never overwrite
   a destination or treat a skipped move as success. Keep the archive private.
4. On interruption, inspect reality before action. If source and destination
   both exist, differ, or lack the verified Task record, preserve both and
   block. Source absent plus matching private destination and exact retained
   Task record may resume only before any final ordinary event/seal, with
   unchanged externally validated accepted identity. Source
   present plus absent destination may restart read-only admission. Missing
   both after a recorded present-cache relocation intent blocks; do not
   reconstruct evidence or pretend relocation succeeded. A verified original
   absent-cache record permits the cache-absent route only with unchanged
   external accepted state and no partial final event/seal.

The Task record and external R2 store survive worktree retirement. Name the
actual `task_comment(...)` locator in final-event `artifacts`; include the
local archive only when relocation actually occurred, keeping it in the
terminal retention closure. Do not name the retiring runtime cache or
external R2 files as local retention artifacts. Inspect prior references:
an artifact pointing to the retired cache, or an external file being treated
as an in-worktree artifact, blocks; never rewrite immutable history to fix it.
Never delete, move, import or garbage-collect external R2 revisions, accepted
heads, Task bindings or knowledge as part of worktree cleanup.

## Ordinary evidence, seal, retention and leave

Complete actual operation and redaction reports under ignored
`build/kent-workflow/<task>/`; preserve original request/report bytes in a
read-back Task comment before leaving. Reports must be truthful about work
still owned by Janitor. Use the configured runtime validators and native
Cleanup prompt's exact payload contract, not an invented terminal format.

Before append, call the existing evidence module's
`preflight_terminal_closure` with the exact proposed final event, seal request,
actual ledger baseline and `retention=True`. Require successful inventory,
capacity and retained-artifact closure checks. There is no new helper or
private identity protocol. Use genuine unchanged current `KENT_SESSION_ID`
and `KENT_STEP_ID`; unavailable native binding blocks.

Append exactly one final ordinary Cleanup event through the configured
`evidence append --task <task> --workspace <original-root>` interface. Include
the archive only if present, retained Task locator, actual checks, operation
and redaction report artifacts. Then use its `seal` interface with the validated actual
terminal request. Preserve the exact returned marker as the final line of
the truthful Cleanup report. No direct ledger writes or blocker append/seal.

Use `retain-evidence` preview, inspect its actual result, then invoke that
operation with its exact returned confirmation digest. Read back and validate
the retained bundle outside the retiring root through existing retention
interfaces; require report digests and any actual relocated archive digest
in the closure. Retain the
frozen request, report and receipt locators in actual read-back Task records.
Unknown effects, partial append/seal or conflicting retention block without
another append, reseal or destructive retry.
For the cache-absent route, require the actual reports and external accepted
identity record, not a fabricated archive digest. Terminal preparation closes
acceptance: later retries are read-only validations and must not recreate a
cache, reaccept a plan or resurrect a report-only sentinel.

Only after all checks, use supported `kent worktree leave` and submit the
frozen native carrier unchanged, including original root/branch, disposition,
exact PR base and complete Cleanup report. Do not call relative adapters from
the new cwd. Script Janitor owns deletion, fresh merged-target checks and
post-deletion verification. Done requires actual path/Git registration
absence and verified owned-branch disposition; report retained native metadata
honestly. No manual task move or direct worktree deletion.
