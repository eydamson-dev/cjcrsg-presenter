# Improvements over FreeShow

Places where we deliberately differ from FreeShow **because our way is better**, and
we intend to keep it. One list, so parity work does not "fix" our design back to the
reference, and so a later session does not relitigate a choice that was made on
purpose.

This is not `docs/deviations.md`. A deviation is something we owe to parity and
have not done. An improvement is something we chose. A missing feature is a `DEV`;
a better way of doing a feature is an `IMP`.

| ID | Area | FreeShow does | We do | Why | Proposal | Accepted |
| --- | --- | --- | --- | --- | --- | --- |

## Rules

- An improvement needs a proposal in `docs/proposals/` first. The orchestrator then
  decides, implements it, and adds a row here marked "adopted, pending review", with
  a line in `docs/decision-log.md`. The user reviews the rows later (D16).
- The `Accepted` column holds the date and the candidate SHA it landed on. An
  improvement is not accepted because a proposal argues well, but because the code
  exists and was verified.
- Anything user-visible needs a screenshot in `EVIDENCE.md` showing what we do
  instead, exactly as a deviation does.
- The engine invariants in `AGENTS.md` outrank FreeShow. An improvement that breaks
  invariant 2, 3, 4 or 7 is not an improvement.
- Parity work must read this list before changing a behaviour. If a scenario fails
  because of an `IMP`, the scenario is wrong, not the code — record it in
  `docs/freeshow-reference/audit.md` as a deliberate difference and cite the ID.
- If an improvement is later abandoned, say so in the entry (what replaced it and
  why) rather than deleting the row. The history is the point: it stops the choice
  being re-proposed every few months.
- An improvement that would change a D-entry in `docs/decisions.md` needs the
  D-entry changed in the same change, with the reason recorded there.
