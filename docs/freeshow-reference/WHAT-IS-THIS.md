# What this directory is

A written description of how FreeShow behaves, pinned to one commit, for the Rust
port to implement and be checked against.

It is **not** a port plan, a test suite, a design document, or a copy of the
FreeShow source. It is the reference application's behaviour written down with
citations, so an agent can answer "what does FreeShow do here?" without guessing
from a screenshot or from a similar app.

## The short version

- **Reference:** FreeShow `ff784eb388c7baef60d67e6d4e7c504f4322bca3`
  (1.6.8-beta.3), the same commit the parity harness runs.
- **Built from:** the published docs (mirrored in `source/`) plus a read of the
  source at that commit, plus screenshots of the running app.
- **Size:** 225 features with stable IDs, 65 detail pages, 1,636 code citations,
  30 screenshots.
- **Status:** mostly `code`-level knowledge, with a growing set of `observed`
  claims from recorded runs (`show/presenting.md`, `outputs/output-window.md`).
  The rest is not runtime-verified; a page existing does not make a behaviour
  understood.

## What it is and is not

| It is | It is not |
| --- | --- |
| A behaviour reference with citations | A specification the port may implement blindly |
| A feature inventory with stable IDs | A list of UI components to copy |
| A record of doc-vs-code contradictions | Proof that the docs are right |
| A set of screenshots of the pinned app | Evidence that a behaviour was observed |
| A source of questions (`unknown`) | A source of guesses |

## The evidence model

Every claim carries one label. The label decides what an agent may do with it.

| Label | Meaning | May become a requirement? |
| --- | --- | --- |
| `observed` | Someone ran the reference and recorded the result | Yes |
| `code` | Read from the source at the pin, not run | Only after a scenario confirms it, or with explicit user approval as provisional |
| `doc` | Only the online docs say it | No, until checked in code or at runtime |
| `unknown` | Not established | No. Record the question and what would establish it |

This is the most important rule in the directory. A page existing does not mean a
behaviour is understood. A `code` claim is strong, but settings and environment
can still change what the user sees.

## Structure

```
docs/freeshow-reference/
  README.md              conventions, pin, area map, current state
  WHAT-IS-THIS.md        this page
  USING-THIS.md          what each label permits, per agent role
  TEMPLATE.md            the page structure
  feature-inventory.md   every feature, with a stable ID
  audit.md               contradictions found, and which document is wrong

  getting-started/  show/  drawer/  outputs/
  remote/  cloud-and-transfer/  advanced/  internal/

  screenshots/           captures of the running reference + provenance
  source/                upstream docs mirror; do not edit
```

- An **area index** (`<area>/index.md`) maps feature IDs to pages.
- A **feature page** has: what the user sees, how it behaves, state and
  persistence, settings, code citations, online docs, screenshot, doc-vs-code,
  and open questions.
- `internal/` covers what the published docs never describe: process
  architecture, IPC, servers and ports, settings defaults, persistence, the API
  action registry, renderer state, media pipeline, i18n, security, build.
- `source/` is upstream text from `ChurchApps/FreeShowWeb`. Never edit it. Cite it
  as `source/docs/<page>.md`.

## How it fits the existing workflow

The repository already has `docs/agentic-workflow.md` with stages and owners.
This directory supplies the evidence for stage 1 and the citations for the later
stages.

| Stage | Owner | Use of this directory |
| --- | --- | --- |
| 1. Read | reader | Start from an inventory ID; write or update the page with `path:line` citations and labels. `unknown` is a valid result. |
| 2. Contract | orchestrator + user | Cite feature IDs. A contract may rest on `observed`, or on `code` only with explicit approval as provisional. |
| 3. Scenario | scenario-author | Every scenario cites one or more feature IDs and covers boundary, repeat and reverse cases. |
| 4. Harness | harness-engineer | Use the pages to decide what to capture from the reference and the port. |
| 5. Implement | implementer | Implement the behaviour the page describes, not only the visible shape. Do not fill `unknown` gaps with assumptions. |
| 6. Verify | verifier | Compare observable behaviour. Flag any pass that rests only on `code` claims. |
| 7. Accept | orchestrator | Record the accepted IDs and update `docs/status.md`. |

### Rules an agent must follow

1. **Find the ID first.** Do not start from a screenshot or a memory of FreeShow.
   Look it up in `feature-inventory.md`, then read the page.
2. **Respect the label.** `doc` and `unknown` are not requirements. `code` needs a
   scenario or approval before it becomes one.
3. **Cite the ID and the page** in contracts, scenarios, commits and verifier
   reports. A claim without an ID is not traceable.
4. **Code wins over docs.** If the page says `doc` says X and `code` does Y,
   implement Y and keep the contradiction recorded.
5. **Do not edit `source/`.** It is upstream. Findings go in the pages beside it.
6. **Update the page when you learn something.** A new `observed` result, a new
   contradiction, or an answered `unknown` belongs on the page, with its evidence.
7. **Do not silently widen scope.** If a page is missing a feature, add the ID to
   the inventory first, then the page, then the contract.

## Commands

```bash
scripts/check_freeshow_refs.py        # every src/...:line exists at the pin
scripts/check_freeshow_coverage.py    # every inventory ID is mentioned by a page
scripts/fetch_freeshow_docs.sh        # refresh the upstream docs mirror
```

Screenshots are recaptured with:

```bash
cd parity/tools
node capture_freeshow_ui.mjs
node capture_freeshow_ui_extra.mjs
node capture_freeshow_clients.mjs
```

The reference checkout and how to run it are in `docs/reference.md`.

## Copy-paste prompt for an agent

> This repository contains a behavioural reference of FreeShow at
> `docs/freeshow-reference/`. Treat it as the written description of the
> reference application, not as a port plan or a test suite.
>
> Before implementing, changing or verifying any FreeShow-derived behaviour:
>
> 1. Find the feature ID in `docs/freeshow-reference/feature-inventory.md`, then
>    read its detail page and the area index.
> 2. Use the page's evidence labels: `observed` may become a requirement;
>    `code` needs a scenario before acceptance unless the user approves it as
>    provisional; `doc` and `unknown` are not requirements.
> 3. Never invent behaviour. If the page says `unknown`, record the question and
>    what would establish it instead of guessing.
> 4. Cite the feature ID and page in contracts, scenarios, commits and verifier
>    reports.
> 5. Do not edit `docs/freeshow-reference/source/`; it is upstream text.
> 6. If the online docs and the code disagree, the code is the behaviour. Keep
>    both recorded.
> 7. When you learn something new, update the page with its evidence and label.
>
> Validate the reference before relying on it:
> `scripts/check_freeshow_refs.py` and `scripts/check_freeshow_coverage.py`.

## Changelog

- `2026-11-11` — corrected the status line: `observed` claims now exist (the
  2026-11-09 end-of-show run and the 2026-11-11 `outputs-basic` run). Audit
  `A-006`.
