# Agentic workflow

The single description of how a behaviour moves from FreeShow to a verified
implementation here. `AGENTS.md` points to this file. The rules behind it are in
`docs/decisions.md` D13 and `docs/parity-workflow.md` §5–§6.

## Stages and owners

| # | Stage | Owner | Output | Where |
| --- | --- | --- | --- | --- |
| 1 | Read | `reader` agent | Feature entries, each behaviour labelled `observed`, `inferred` or `unknown`, with reference evidence | `parity/features/`, `parity/reports/reader/` |
| 2 | Contract | Orchestrator, with the user approving | Behavioural contract | `docs/contracts/` |
| 3 | Scenario | `scenario-author` agent | Semantic scenarios, including boundary, repeat and reverse cases | `parity/scenarios/` |
| 4 | Build harness | `harness-engineer` agent | Adapters, normaliser, runner, with known-case proof | `parity/tools/`, `parity/adapters/`, `parity/normalizers/`, `parity/runner/` |
| 5 | Implement | `implementer` agent | Code, unit tests, implementation evidence, candidate SHA | `crates/`, `apps/`, `parity/reports/evidence/` |
| 6 | Verify | `verifier` agent, in its own session and worktree | Verdict and defect list | `parity/reports/verifier/` |
| 7 | Accept | Orchestrator | Acceptance record; `docs/status.md` and `EVIDENCE.md` updated | this repository |

The orchestrator is the main session. It owns stages 2 and 7 and assigns the
others. Stages 1, 3, 4, 5 and 6 are not run by the orchestrator, so the agent that
does the work is never the one that grades it.

## Gates

- A contract is approved by the user before stage 3 starts.
- Before stage 5 writes any code, the implementer reads the feature's reference
  pages and writes an understanding note (see *Understanding before building*).
- A candidate is ready when stage 5 reports `scripts/check.sh` exit code 0, with
  evidence. Ready is not accepted.
- A milestone is accepted only when stage 6 reports pass for the exact candidate
  SHA, and the orchestrator records it at stage 7.
- A failed verdict goes back to stage 5 with the defect list. The verifier does not
  fix anything.
- A feature gets at most three rework rounds. After the third failed verdict, the
  orchestrator stops the loop and reports to the user: the open defects, and
  whether the spec, the reference page or the code is the thing that is wrong.

## The feature reference

`docs/freeshow-reference/` is the written description of FreeShow at the pinned
commit. It is the behavioural source for stages 1, 3, 5 and 6, and it is read
through `docs/freeshow-reference/WHAT-IS-THIS.md` and `USING-THIS.md`.

Every claim on a page carries one label. The label decides what it may do:

| Label | May fail a feature? | May be a requirement? |
| --- | --- | --- |
| `observed` | Yes, through a scenario | Yes |
| `code` | No. Produces a finding: "needs a scenario" | Only after a scenario confirms it, or with user approval as provisional |
| `doc` | No | No, until checked in code or at runtime |
| `unknown` | No. Recorded as an open question | No |

### Understanding before building

The implementer does not start from the contract alone. Before writing code it:

1. Looks up each feature ID in `feature-inventory.md` and reads its detail page,
   including Doc vs code and Open questions.
2. Writes `parity/reports/evidence/<milestone>/understanding.md`, listing for each
   ID: the behaviour it will implement, the page section it came from, the label
   of each claim it relies on, and the open questions that touch it.
3. Stops and reports if a behaviour the contract needs is `unknown`, or if a
   required claim is only `doc`. It does not fill the gap from memory.

The verifier checks that this note exists and that the implementation's behaviour
matches the cited claims. A missing or inaccurate note is a defect.

### Validating a feature

Stage 6 validates a feature against its reference page, not only its scenarios.
The verifier:

1. Runs the scenarios derived from `observed` claims, against both adapters.
2. For each `code` claim the feature touches, records whether a scenario exists. If
   none does, the finding is "not yet exercised", which blocks acceptance of that
   claim but does not fail the feature.
3. Notes `doc` and `unknown` claims touched, without judging them.
4. Checks that a page and the code disagree only where the page's Doc vs code
   section already records the difference. A new disagreement is a finding for the
   reader, not a fail for the implementer.

Verdicts are `pass`, `fail` (with defects), or `blocked` (a scenario or page is
missing or wrong, so no fair verdict is possible). A `blocked` verdict goes to the
orchestrator, not back to the implementer.

### When the reference is wrong

If the implementer or verifier finds that a page is wrong, the fix is a correction
to the page with its evidence, recorded in `docs/freeshow-reference/audit.md`. It
is not a code change to match the page, and it is not a silent edit to the page.

## Rules that apply to every stage

- The FreeShow reference is behaviour, not code. Record what it does, not how it is
  written, and cite the upstream file (`docs/provenance.md`).
- `observed` behaviour can become a requirement. `inferred` and `unknown` cannot,
  until more evidence is recorded or the user approves a provisional contract.
- Nothing is changed to make a failing check pass: not a scenario, a baseline, a
  tolerance or a contract.
- Only the orchestrator records acceptance. No agent marks its own work accepted.
- Steps 1 and 4 do not touch product code. Steps 5 and 6 do.
- Every role reads the feature pages in `docs/freeshow-reference/` for the IDs it
  touches. The reader owns those pages. Other roles report a suspected error to the
  orchestrator, who routes it to the reader.
- The reference is living. Its source of truth is the pinned reference code and the
  running reference, not our port. A page is corrected when either shows it wrong,
  with an audit entry. A port difference is a deviation, not a page change.
- A claim about native behaviour — window lifecycle, focus, real input, multiple
  windows — is verified in the agent workspace (`docs/agent-workspace.md`), not
  from the DOM or a metric. The workspace is the sandbox for the real app; it is
  never evidence about Windows.

## Running a milestone

1. Start the orchestrator session in this repository.
2. Reader, then contract with the user, then scenario author, then harness. Harness
   work may run in parallel with scenario work once the contract is approved.
3. Implementer, in a worktree on a branch of its own.
4. Verifier, in a second worktree checked out at the candidate's exact SHA, in a
   separate session. It gets the commit, contract, scenarios and evidence, not the
   implementer's account of the fix.
5. Orchestrator accepts or sends back.

## Status

The agent files exist under `.opencode/agents/`, and OpenCode lists all five.
The first full run (controller drawer, 2026-11-09) used reader →
scenario-author → implementer (worktree `dev-013-drawer`) → verifier (separate
worktree at the candidate SHA), with one failed verdict sent back and a second
pass that passed. The orchestrator accepted on `b969f82`. The second run (left
project browser) passed verification first time on `9be245f`; its only upstream
correction was a scenario that asserted app state without launching.
