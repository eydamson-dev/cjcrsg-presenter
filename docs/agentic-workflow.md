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
- A candidate is ready when stage 5 reports `scripts/check.sh` exit code 0, with
  evidence. Ready is not accepted.
- A milestone is accepted only when stage 6 reports pass for the exact candidate
  SHA, and the orchestrator records it at stage 7.
- A failed verdict goes back to stage 5 with the defect list. The verifier does not
  fix anything.

## Rules that apply to every stage

- The FreeShow reference is behaviour, not code. Record what it does, not how it is
  written, and cite the upstream file (`docs/provenance.md`).
- `observed` behaviour can become a requirement. `inferred` and `unknown` cannot,
  until more evidence is recorded or the user approves a provisional contract.
- Nothing is changed to make a failing check pass: not a scenario, a baseline, a
  tolerance or a contract.
- Only the orchestrator records acceptance. No agent marks its own work accepted.
- Steps 1 and 4 do not touch product code. Steps 5 and 6 do.

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
pass that passed. The orchestrator accepted on `b969f82`.
