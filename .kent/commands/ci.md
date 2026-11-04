# Observe PR CI

The schema-3 handoff requires one `github-ci-contract-v1` object with exactly
`schema`, `repository`, `pull_number`, `head_oid`, `base_oid`, `require_ci`.
Set repository to `rovkinmax/Fit`, use the observed positive PR number and exact
40-character head/base commit OIDs, and set `require_ci=true`.
Validate with `validate_ci_contract` from the configured runtime module.

Use the native CI Watch/Monitor CI routes and configured `wait_ci` helper;
do not invent an independent polling loop or hidden private identity.
Read actual checks for that exact head. Missing checks, pending checks,
provider restrictions and unavailable credentials do not pass. Preserve
provider retry constraints, original reports and all native carrier fields.
Changed PR head requires fresh checks. Return actionable findings through the
declared transitions; no merge or production publication effects are permitted.
