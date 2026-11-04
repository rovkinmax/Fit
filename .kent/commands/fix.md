# Repair Verified Findings

Read `.kent/commands/feature-implement.md`. Reproduce the exact reported failure,
fix its root cause within the accepted plan and rerun affected verification.
Preserve the failing evidence and identify any remaining findings. Contract
drift returns to Plan Revalidation before production edits. Do not silently
reinterpret blocked evidence as passing.
Keep plans in the admitted R2 Task and use immutable publication/CAS; missing
storage or accepted state blocks without local-plan fallback or cache restore.
