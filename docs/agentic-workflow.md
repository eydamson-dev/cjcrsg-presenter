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

- A contract is decided before stage 3 starts: the orchestrator drafts it, and a
  decided by the AI and logged in `docs/decision-log.md` (D16).
  Acceptance of a milestone still needs a verifier pass on the exact SHA.
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
- A change to a behaviour that FreeShow already has needs either parity evidence or
  an accepted proposal. "Our way is nicer" without an `IMP` row is a deviation
  pretending to be a design, and it is rejected.

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
  until more evidence is recorded or the AI decides a provisional contract and logs it.
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
   work may run in parallel with scenario work once the contract is decided.
3. Implementer, in a worktree on a branch of its own.
4. Verifier, in a second worktree checked out at the candidate's exact SHA, in a
   separate session. It gets the commit, contract, scenarios and evidence, not the
   implementer's account of the fix.
5. Orchestrator accepts or sends back.

## Research delegate

A `researcher` agent (`.opencode/agents/researcher.md`) answers *how does FreeShow
do this, and is there a better way for us?* It is a cross-cutting helper like the
vision delegate, not one of the seven stages: any stage may ask for it, and the
orchestrator decides what gets adopted. It reads the reference pages, the web (when
a claim needs current facts) and, within the permission in `AGENTS.md`, the ChatGPT
project `cjcrsg-presenter`.

It answers two kinds of question, and the caller says which one it asked:

- **Gap research** — why a behaviour is missing or unclear. Feeds stages 1–3, and
  may end as a `DEV-nnn` in `docs/deviations.md`.
- **Alternative research** — a different or better way than FreeShow's. This is the
  point of the role: FreeShow is the baseline, not the target. It ends as a proposal
  in `docs/proposals/`.

A proposal is written to `docs/proposals/IMP-nnn-slug.md` from
`docs/proposals/TEMPLATE.md`. It states the FreeShow behaviour with reference
labels, the alternative, what it buys, what it costs, and what was measured.

**Adoption is the orchestrator's call, not the researcher's.** The orchestrator
decides whether to adopt the proposal, implements it, and records it as a row in
`docs/improvements.md` marked "adopted, pending review", with a decision-log entry.
A rejected one stays in `docs/proposals/` with the reason, so it is not re-proposed
from scratch.

`docs/improvements.md` is a different list from `docs/deviations.md` on purpose. A
deviation is something we owe to parity and have not done. An improvement is
something we chose. Parity work reads the improvements list before changing a
behaviour; a scenario that fails because of an `IMP` means the scenario is wrong,
recorded in `docs/freeshow-reference/audit.md` as a deliberate difference with the
`IMP` ID. The decisions in `docs/decisions.md` still outrank both, and an
improvement that would change a D-entry changes it in the same change.

## Vision delegate

A dedicated `vision-reader` agent (`.opencode/agents/vision-reader.md`) does one
thing: read a screenshot or frame and report what it shows. The orchestrator
spawns it whenever a step needs "look at the image" — `AGENTS.md`'s "never say a
UI is correct from the DOM alone" rule is satisfied through this delegate. It is
read-only (no edit, no shell, no subagents). It is not one of the seven stages; it
is a cross-cutting helper any stage may call.

Code edits belong to stage 5, so the orchestrator does not edit `crates/`,
`apps/` or the harness itself. It writes contracts, acceptance records,
`docs/status.md` and `EVIDENCE.md`, and hands the rest to the stage's agent.

Stages 5 and 6 keep D13's separate-session, separate-worktree rule: a subagent
shares the orchestrator's working directory, so launching the implementer as a
subagent from the main checkout would put both roles in one tree.

## Status

The agent files exist under `.opencode/agents/`. OpenCode lists the five stage
agents (`reader`, `scenario-author`, `harness-engineer`, `implementer`,
`verifier`) and the two cross-cutting helpers (`vision-reader`, `researcher`),
confirmed with `opencode debug agents` on 2026-11-12.
The first full run (controller drawer, 2026-11-09) used reader →
scenario-author → implementer (worktree `dev-013-drawer`) → verifier (separate
worktree at the candidate SHA), with one failed verdict sent back and a second
pass that passed. The orchestrator accepted on `b969f82`. The second run (left
project browser) passed verification first time on `9be245f`; its only upstream
correction was a scenario that asserted app state without launching.
