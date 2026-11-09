# Parity workflow

Status: **proposed, not yet built.** Decided in part by D13 (`docs/decisions.md`):
behavioural contracts are the specification, differential runs compare state
after every action, and verification is independent. Where this document and D13
disagree, D13 wins. Scope: check that what we build matches FreeShow's behaviour
(functionality) and look (UI), feature by feature, and say clearly which is which.

## 1. What "similar" means

Parity is three separate claims. Each gets its own check, and a feature can
pass one and fail another.

| Claim | Question | Evidence |
| --- | --- | --- |
| **Functional** | Given the same input and actions, do we reach the same state? | Normalised state after each action (slide order, active index, text, outputs) |
| **Visual** | Does the same slide look the same? | Screenshots at fixed viewports, compared by pixel and by structure |
| **Interaction** | Does the same operator action produce the same result? | Scripted UI steps, asserted on state and on the screen |

Functional parity is the priority. A pixel-perfect slide that advances to the
wrong verse is worse than an ugly one that advances correctly.

## 2. Ground rules

1. **The reference is behaviour, not code.** FreeShow is GPL and readable, so
   the workflow may read its source to write scenarios and evidence. Our
   implementation is written from the behaviour, not transliterated. Every
   feature records the upstream file it was read from, per `docs/provenance.md`.
2. **A feature is not done until its scenario passes on both sides.** The
   reference must run, not be assumed. A scenario that cannot run against
   FreeShow is a spec gap, not a pass.
3. **Known differences are allowed only when written down.** Each one has an
   ID, a screenshot, a reason and an owner. Silent tolerance is a failure.
4. **The workflow does not edit the reference.** FreeShow runs from a pinned
   commit in a separate checkout.

## 3. Components

```
parity/
├── features/            one YAML per feature: the inventory
├── scenarios/           executable steps, shared by both adapters
├── fixtures/            .show / project files used as input (copies, with licence notes)
├── adapters/
│   ├── freeshow/        drives the reference (see §4)
│   └── cjcrsg/          drives our build (see §4)
├── golden/              reference captures, versioned by FreeShow commit
├── reports/             one report per run
└── tools/               runner, diff, report generator
```

### 3.1 Feature inventory (`parity/features/*.yaml`)

```yaml
id: slide.next.keyboard
area: navigation            # navigation | outputs | rendering | media | remote | stage | editing | import
title: Advance to next slide with the keyboard
reference:
  commit: <pinned FreeShow sha>
  evidence:
    - src/frontend/...:line-range
  read_by: <agent or person>
  confidence: high          # high | medium | low (see §5)
ui: true                    # has a visual surface, so screenshots apply
scenarios: [nav-next-basic, nav-next-at-end]
status: planned             # planned | partial | parity | known-deviation
deviations: []              # IDs from parity/deviations.yaml
```

Features come from a reading pass over FreeShow, not from memory. Each feature
needs at least one piece of reference evidence before it can exist.

### 3.2 Scenarios (`parity/scenarios/*.yaml`)

One scenario, two adapters. A scenario describes the operator's intent, not
the implementation:

```yaml
id: nav-next-basic
fixture: fixtures/sunday-two-groups.show
viewports: [1920x1080, 1366x768, portrait-1080x1920]
steps:
  - open_project: fixtures/sunday-two-groups.show
  - open_show: Worship
  - expect: { slide: 1, text_contains: "Verse 1" }
  - action: next
  - expect: { slide: 2, text_contains: "Verse 1 line 2" }
  - snapshot: after-next
```

Actions are a fixed vocabulary (`open_project`, `open_show`, `next`, `previous`,
`goto`, `open_output`, `close_output`, `reopen_output`, `remote:next`,
`wait_transition`, `snapshot`). Each adapter implements the vocabulary. A step
an adapter cannot perform fails loudly rather than being skipped.

### 3.3 Adapters

Both expose the same driver interface:

```
load(project) · show(name) · action(name, args) · state() -> NormalisedState
screenshot(viewport) -> png · structure() -> [TextBox]
```

- **`adapters/freeshow`** runs the reference. Two routes, to be decided
  (§7): the Electron app driven through Playwright's Electron support, or the
  reference's own remote and stage web clients, which are plain pages served by
  its Express server and can be driven like any site. The second route tests
  less of the app but is far more stable.
- **`adapters/cjcrsg`** runs our build. The desktop shell is a WebView and
  cannot be attached to by Playwright, so the slide renderer is also built as a
  web target and driven in headless Chromium. Desktop-level behaviour (windows,
  focus, monitors) is checked by a separate, smaller set of native tests.

`NormalisedState` is the only thing functional checks compare:

```json
{ "show": "Worship", "index": 1, "total": 12, "slide_id": "lyric-2",
  "elements": [{ "class": "lyrics", "text": "...", "box": [x,y,w,h] }],
  "outputs": { "audience": { "open": true, "revision": 4 } } }
```

IDs are not compared across sides. Positions and text are.

### 3.4 Comparison

**Functional.** Field-by-field equality on `NormalisedState`, with explicit
allowances (e.g., ignore `revision` numbering, compare relative ordering).

**Visual.** Each snapshot is compared three ways, and all three must pass:

1. Pixel: ΔE on text regions, SSIM above a threshold on the whole frame. The
   threshold is set from a calibration run, not guessed (see §6).
2. Structural: text boxes from both sides match within 2 px, font sizes within
   1 px, same line breaks.
3. Visible-text equality, which catches a missing or extra line even when the
   pixel score looks fine.

**Interaction.** Covered by the functional check: the same actions must yield
the same states.

## 4. The rendering-engine problem

This is the single biggest risk, and the plan has to say so.

FreeShow renders in **Chromium** (Electron 45). We render in **WebKitGTK** on
Linux, WebView2 on Windows and WKWebView on macOS. The same CSS does not
produce byte-identical pixels across these engines: font hinting, subpixel
text and line-breaking can all differ.

Consequences for the plan:

- Pixel parity cannot be required *across engines* at a zero tolerance. The
  visual threshold is calibrated by comparing FreeShow against itself across
  two runs, and measuring what a given engine difference costs.
- For strict visual parity, the renderer is tested in **Chromium** (the
  web-target route in §3.3), since that is the engine the reference uses. The
  WebKit build is then checked against those Chromium goldens with a looser
  threshold, and every difference is listed.
- Text layout (line breaks, autofit size) is compared **structurally**, which
  survives engine differences where pixels do not.

Experiment 2 in `docs/experiments.md` is the first real measurement of this.
The workflow's calibration step should reuse its data.

## 5. Agents

Five roles, each with a narrow job and a written output. None of them marks a
feature as done. Only the orchestrator does, after the verifier's report (§6).

| Role | Input | Output |
| --- | --- | --- |
| **Orchestrator** | milestone plan | assignments, gates, acceptance record. Owns the decision to accept |
| **Reader** | a FreeShow area (e.g., `src/frontend/show`) | feature entries and behaviour labelled `observed` / `inferred` / `unknown`, with reference evidence |
| **Scenario author** | approved contract | semantic scenarios, including boundary, repeat and reverse cases; a note on anything the reference cannot express |
| **Implementer** | approved contract + scenarios | code in `crates/` or `apps/`, unit tests, implementation evidence. May declare a candidate ready, never accepted |
| **Verifier** | contract, scenarios, reference evidence, candidate commit SHA | run report and defect list; never edits code, contracts, scenarios or baselines |

Rules (D13):

- The **implementer and verifier are separate sessions in separate worktrees.**
  The verifier checks out the exact candidate commit, not a branch that may move.
- The verifier does not take the implementer's account of a fix as evidence. It
  decides from the commit, contract, scenarios and artefacts.
- The verifier runs `scripts/check.sh` itself, and at least one scenario the
  implementer did not supply.
- The reader's confidence is a real field. `inferred` or `unknown` behaviour
  needs more reference evidence, or an explicit provisional contract, before
  implementation starts.

## 6. The gate

A feature moves to `parity` only when all of these hold:

- its scenarios run to completion on **both** adapters, with no skipped steps;
- functional comparison passes;
- visual comparison passes at every listed viewport, or each failing region is
  a recorded deviation;
- the reference evidence is recorded, with a confidence of medium or higher.

The gate runs in CI and locally with one command, `parity run <feature-id>`
or `parity run --all`, which writes `parity/reports/<date>.md` and a machine
readable JSON next to it.

**Threshold calibration.** Before the gate is trusted, run FreeShow against
its own golden twice on the same machine. The observed noise sets the floor,
and the threshold sits a set margin above it. Record the calibration in
`parity/reports/calibration-<date>.md`.

**Determinism.** Fixed fonts on both sides (the same installed font files),
animations disabled or waited to completion, a fixed clock where time is shown,
and masked regions for anything that legitimately changes (timers, clocks,
media frames).

## 7. Decisions

Decided by the user, 2026-11-09:

1. **Reference route: web remote and stage clients.** FreeShow's remote
   (port 5510) and stage (port 5511) are plain web pages served by its Express
   server. They are driven like any site. Electron-level driving is deferred
   until the outputs area, which needs it.
2. **Visual target: both.** Strict pixel checks run against a Chromium build of
   our renderer, which is the engine FreeShow uses. The WebKit build (the one we
   ship) is checked against those Chromium goldens with looser, listed thresholds.
   Results are reported separately.
3. **First slice: navigation.** Open project, open show, next, previous, goto,
   first and last, at 1920×1080, 1366×768 and portrait 1080×1920.
4. **Fixtures: our own, synthetic, in the native format.** See
   `docs/file-format.md`. Real FreeShow `.show` files are used only as
   import tests, and only files the user confirms are theirs to use. Fixtures
   are authored in our format and converted from FreeShow's JSON by the
   importer, so the importer is tested every run.

## 8. Things to verify before the first build step

These are assumptions from reading the source. Each needs a real check.

- The remote (5510) client exposes next and previous controls and reflects the
  current slide. If it doesn't, the first slice falls back to the stage client,
  or to the Electron route for that feature.
- FreeShow's own Playwright setup (its source notes a "throwaway test path") can
  start the app headless. If it can, the reference can be run in CI too.
### 8.1 Preflight result (2026-11-09)

Done. See `parity/reports/preflight-2026-11-09.md`. Headline correction:

- **Navigation is on the controller (5512), not the remote (5510).** The remote
  is a management UI; the stage (5511) needs a configured layout.
- The Electron harness FreeShow ships works, and is the better adapter route
  than the web clients, because it can read the live output directly.

The adapter route is therefore: **Playwright `_electron`, main-window DOM as the
oracle**, with the controller click only if a UI-level interaction is the thing
under test.

- Both sides can use the same installed font files — still to be measured in
  calibration.

## 9. Build order

1. Verify the three assumptions above, and record the answers in
   `parity/reports/preflight-<date>.md`.
2. Calibration: FreeShow against itself, twice. Sets the noise floor.
3. Feature inventory for navigation, with evidence.
4. Scenario `nav-next-basic`, runnable against FreeShow alone.
5. The `freeshow` adapter, verified against that scenario.
6. The `cjcrsg` adapter and the first implementation to pass it.
7. Report generator and the gate command.
8. Expand area by area.

Steps 1–5 do not touch product code.
