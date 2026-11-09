---
milestone: DEV-013 milestone 7 — controller project browser
candidate_commit: 9be245f4938ca58d7cc2098043c924f1d095a82c
branch: dev-013-project-browser (detached at the candidate)
worktree: /home/eydamson/.local/share/opencode/worktree/04e32b/project-browser-verify
date: 2026-11-09
contract: docs/contracts/ui-project-browser.md (approved 2026-11-09)
scenarios_source: parity/scenarios/controller-project-browser.yaml (corrected `main`); the candidate tree still has the pre-correction file (see “Scenario input difference”)
verifier_verdict: pass
check:
  command: ./scripts/check.sh
  run_bare: true
  exit_code: 0
  result: "all green"
  tests: 184
  evidence_declared: 184
  evidence_matches: true
  test_breakdown: "24 + 41 + 105 + 14"
startup_checks:
  head_matches_candidate: true
  worktree_clean_at_start: true
  contract_and_scenarios_read_from_candidate: true
clauses:
  P1: pass
  P2: pass
  P3: pass
  P4: pass
  P5: pass
  P6: pass
  P7: pass
  P8: pass
defects: []
mismatches: []
residual_notes:
  - id: R1
    severity: low
    clause: P2 (implementation side effect)
    observation: >
      The new 250 ms tick read makes the controller re-render four times a second.
      Every re-render rebuilds `document::Style { {MAIN_CSS} }`; Dioxus debug builds
      log `dioxus_document::elements: Changing the props of Style {} is not supported`
      at each tick (visible throughout `final/projects/app.log`, `final/missing/app.log`
      and the other final logs). The stylesheet remains applied and the warning is
      behind `#[cfg(debug_assertions)]` inside Dioxus, so there is no release or visual
      effect. It is log noise at 4 Hz in debug/evidence runs, not a contract failure.
    reproduction: "Run the controller with RUST_LOG=debug and watch stderr for one warning every ~250 ms."
  - id: R2
    severity: low
    clause: acceptance criterion 3/5 (evidence completeness)
    observation: >
      The committed evidence proves the failed-open *state* with
      `session-open-failed.json`, but the folder has no committed image of the inline
      error; the scratch `raw/browser-open-error.png` exists outside the commit and
      shows the error under the list. Likewise the open-from-browser published state
      is proved by `session-open-second.json` plus a scratch `raw/browser-open-second.png`
      (second-1, 1/2, Second Show live), not by a committed image.
    reproduction: "ls parity/reports/evidence/ui-project-browser (no open-error/open-second image)."
  - id: R3
    severity: info
    clause: acceptance criterion 4
    observation: >
      `browser-comparison-1280x800.png` is a 600×830 side-by-side composite of the two
      columns, not a 1280×800 frame. The two source captures are each 1280×800, but the
      FreeShow source includes its 27 px native menu and the candidate is a content-only
      crop, so the panes do not have identical content height. The column comparison and
      the named differences are still valid; the wording “at the same size” should be
      read as the same window width/panel context.
    reproduction: "node parity/tools/compare.mjs <comparison> <comparison> reports [600,830]."
  - id: R4
    severity: info
    clause: P7 coverage
    observation: >
      The committed portable evidence is the `copied 0` path only (scratch project has no
      external media). The scenario's `copied 1, missing 1` and `cannot write <path>`
      cases have no committed capture. The code path is unchanged (`AppState::bundle_media`
      -> `bundle_project_file`), so this is evidence coverage, not a code defect.
    reproduction: "parity/reports/evidence/ui-project-browser/browser-portable-1280x800.png shows copied 0."
  - id: R5
    severity: info
    clause: D13 evidence manifest
    observation: >
      The report's evidence manifest names each artefact and what it proves but does not
      name the candidate commit. D13 §6 asks the manifest to name the commit it came from;
      earlier milestone reports have the same omission.
    reproduction: "parity/reports/ui-project-browser-2026-11-09.md §Evidence manifest."
ambiguities:
  - "P1/P5: whether the built-in demo counts as “an open project”. The candidate (and the scenario notes) treat it as not a project-browser row; the contract should say so explicitly."
  - "P2: “cannot be read” is implemented as OS readability of a regular file. A readable but non-CJCP or newer-format file is not `missing`; P3 handles it as a failed open. The contract should say which check decides `missing`."
  - "P3: “the project parses but its media cannot be served” has no explicit failure path in `open_project`; media allowlist updates are infallible here. Either narrow the sentence or define the trigger."
  - "P4: “forgetting the last entry leaves the panel in its empty state” is only reachable from the demo-fallback state (an open project's row is never forgettable). The contract should state that consequence of P4+P5."
  - "P6: it supersedes drawer contract B7's slide count, but `docs/contracts/ui-drawer.md` is not marked superseded in this commit; the scenario notes ask for that."
  - "P7: the exact OS suffix in `cannot read/cannot write <path>` text is not fixed by the contract and is not in the committed evidence."
  - "P8: “no change to render state” and opening a project conflict unless read as “no change from browsing actions”; the scenario notes resolve it that way but the contract sentence could say it."
  - "Hook: “unable to alter published render state”. `open:` and `play:` do change the live project/show, but only by dispatching the same DOM control a user would. If the requirement meant no state change at all, the extension fails it; if it meant no direct engine access, it passes. This should be stated."
not_run:
  - "All 12 milestone scenarios through `parity run` against either adapter: this repo has no `parity/adapters/` directory and no controller adapter (the scenario header says so). Every scenario is marked not_run below, not passed."
  - "The live missing-file restore while the app runs: the committed before/restored image pair, the 250 ms re-render evidence and the unit test support it, but I did not create the file during a live run myself."
  - "The permission-restore reverse path via a live app (I did test permission-denied through the headless render with `/proc/1/mem`)."
  - "The 10-row cap, width persistence and focus-mode scenarios as live UI runs; the code paths are unchanged/exercised by unit tests where possible."
  - "A release binary. The hook's release absence is from `cfg!(debug_assertions)` in `apps/desktop/src/app.rs`."
scenarios:
  - id: controller-project-browser-list
    status: not_run
    notes: "No controller adapter. P1 code (`projects::build`) and unit test `the_open_project_is_first_and_appears_exactly_once`, `recent_rows_keep_the_session_order_newest_first`; MAX_RECENT is unchanged in core (`Session::record` truncates at 10). No 10-row live capture."
  - id: controller-project-browser-row
    status: not_run
    notes: "No adapter. Row anatomy independently checked on the shipped CSS (computed 4 px border, muted path rgb(146,152,171), `current` badge, `missing`, disabled open, Forget only on non-open rows)."
  - id: controller-project-browser-missing-recover
    status: not_run
    notes: "No adapter. The committed before/restored pair differs in 0.25% of pixels at the row; the logs show the 250 ms re-render. I independently exercised absent, non-regular and permission-denied paths through the headless render."
  - id: controller-project-browser-open
    status: not_run
    notes: "No adapter. I drove the real row's open action through `CJCRSG_DRAWER=open:Browser Second` in a real X11 window: log shows `project opened ... browser-second.cjcp`, session became [Second, Main, Third]. The failed-open state is in `session-open-failed.json`; scratch `raw/browser-open-error.png` shows the inline error under the list."
  - id: controller-project-browser-forget
    status: not_run
    notes: "No adapter. I drove `CJCRSG_DRAWER=forget:Browser Second` in a real window: session became [Main, Third], `browser-second.cjcp` still exists. `forget:Browser Main` (the open row) produced no change. Re-opening the forgotten Browser Second from [Main, Third] restored [Second, Main, Third]."
  - id: controller-project-browser-forget-last
    status: not_run
    notes: "No adapter. The demo-fallback state and empty sentence are implemented; the committed empty capture shows it. The two-Forget live sequence was not run."
  - id: controller-project-browser-empty
    status: not_run
    notes: "No adapter. The empty capture shows the exact sentence, no rows, no-file foot, and the demo project loaded but not listed; the independent headless render carries the same sentence in DOM text."
  - id: controller-project-browser-outline
    status: not_run
    notes: "No adapter. `browser-projects` shows OPENING/Welcome(LIVE)/Worship/SERMON/Communion in entry order; `browser-shows` shows the live marker moved to Worship after Play. Code uses `outline::build`, not `project.shows` order."
  - id: controller-project-browser-focus
    status: not_run
    notes: "No adapter. `FocusView` is untouched and still mounted in the centre (`app.rs` line ~492); no live focus capture for this milestone."
  - id: controller-project-browser-portable
    status: not_run
    notes: "No adapter. `browser-portable` shows the foot path, Make portable and `copied 0`; the error/missing cases are not in the committed evidence (R4)."
  - id: controller-project-browser-width
    status: not_run
    notes: "No adapter. Width code and clamping are unchanged; the left column renders at 280 px in the capture and the CSS probe."
  - id: controller-project-browser-consumer
    status: not_run
    notes: "No adapter. No crates changes; the open path is the existing `AppState::open_project`; scratch `raw/browser-open-second.png` shows second-1, 1/2, Second Show live after the row open."
extra_scenarios:
  - id: verifier-project-browser-unreadable
    status: pass
    contract: [P2]
    description: >
      An independently authored session (not the implementer's) seeded through
      `CJCRSG_DATA_DIR`: a readable project, `/proc/1/mem` (present regular file,
      permission-denied), a directory used as a project path, and a nonexistent path.
    expected: "Readable row normal; the other three rows each carry `missing`, a disabled open action and a Forget control; session order preserved."
    observed: >
      `render --layout recent` output has 5 rows in the seeded order; the three
      unreadable entries render `class="project-row missing"`, `disabled=true`,
      `missing` label and Forget; neither readable row is flagged. This exercises
      the permission-denied branch the scenario notes say is otherwise untested.
    artefacts:
      - parity/reports/verifier/render-check/session.json
      - /tmp/opencode/verifier-recent-4.html
  - id: verifier-project-browser-getsession
    status: pass
    contract: [P3, P4, P8]
    description: >
      Real X11 controller runs with `CJCRSG_DRAWER` dispatching the same DOM
      controls: `open:Browser Second`, `forget:Browser Second`, `forget:Browser Main`,
      `open:Browser Third` (a missing row), plus a re-open of the forgotten project
      through the existing open path.
    expected: "Open reorders to [Second, Main, Third]; forget removes exactly Second; forgetting the open row is a no-op; opening the missing row is a no-op; re-opening the forgotten project restores it."
    observed: >
      Open: log `project opened ... browser-second.cjcp`; session [Second, Main, Third].
      Forget: session [Main, Third]; file still on disk.
      Forget open row: session unchanged [Main, Second, Third].
      Missing row: no `project opened` log and session unchanged.
      Re-open of forgotten Browser Second from [Main, Third]: session [Second, Main, Third].
    artefacts:
      - parity/reports/verifier/gui-open/session.json
      - parity/reports/verifier/gui-forget/session.json
      - parity/reports/verifier/gui-forget-open/session.json
      - parity/reports/verifier/gui-missing-click/session.json
      - parity/reports/verifier/gui-reopen/session.json
  - id: verifier-project-browser-css
    status: pass
    contract: [P2, P5, P7]
    description: "Shipped `main.css` applied to the exact panel/row markup in headless Chromium."
    expected: "Panel headed Projects; 4 px current border; muted path; current badge; missing label; disabled missing open; Forget only on non-open rows; no-file foot."
    observed: >
      JSON title from the probe: heading Projects, 3 rows, border-left 4px,
      current padding 8px vs other 12px, badge `current`, path rgb(146,152,171),
      missing text `missing`, disabled true, 2 Forget controls, no Forget on the
      current row, foot text full path, `Make portable`, panel 280 px.
    artefacts:
      - parity/reports/verifier/projects-probe.html
      - /tmp/opencode/projects-probe/remote-1280x800.png
  - id: verifier-experiment-1-smoke
    status: pass
    contract: [P8]
    description: "`CJCRSG_SMOKE=1` on the intended 12-slide demo, candidate build."
    expected: "Experiment 1's recovery checks pass."
    observed: "7/7 checks pass; revision 11; recovery 191 ms. P8's measured recovery behaviour is intact."
    caveat: "The same smoke with the 7-slide Browser Main project fails its `engine keeps running` check because the project has already reached its last slide; that is a fixture mismatch in my run, not a candidate defect."
  - id: verifier-image-measurement
    status: pass
    contract: [acceptance criterion 3/4]
    description: "PNG dimensions and pair difference measured with the repo's `compare.mjs`."
    expected: "Candidate captures 1280×800; before/restored differ at the row."
    observed: "All six candidate window images are 1280×800; FreeShow reference 1280×800; comparison composite 600×830; before/restored differ in 0.25% of pixels (max channel delta 212)."
state_comparisons:
  - action: "open Browser Second from its row"
    expected: "project Browser Second; session [Second, Main, Third]"
    actual: "log project opened Browser Second; session [Second, Main, Third]"
    result: match
  - action: "Forget Browser Second"
    expected: "session [Main, Third]; file untouched"
    actual: "session [Main, Third]; browser-second.cjcp still readable"
    result: match
  - action: "re-open the forgotten Browser Second through the open path"
    expected: "session [Second, Main, Third]"
    actual: "session [Second, Main, Third]; Second recorded at the front"
    result: match
  - action: "Forget the open project's row"
    expected: "no change"
    actual: "session still [Main, Second, Third]"
    result: match
  - action: "open the missing row"
    expected: "no change"
    actual: "no open log; session still [Main, Second, Third]"
    result: match
  - action: "failed open Browser Broken"
    expected: "project stays Browser Main; list intact; error below list"
    actual: "session [Main, Broken]; scratch image shows the refusal under the list; project/preview unchanged"
    result: match
  - action: "Make portable"
    expected: "open project recorded once; status text"
    actual: "session [Main, Second, Third], Main refreshed; image shows copied 0"
    result: match
visual_evidence:
  browser-projects-1280x800.png:
    dimensions: "1280×800"
    seen: >
      Left PROJECTS panel 280 px wide. Row order Browser Main (current: 4 px pink
      left border, `current` badge, full wrapped path), Browser Second (path,
      Forget), Browser Third (red name, `missing`, Forget, no usable open control).
      Foot shows the open path truncated with an ellipsis and Make portable. The
      Shows tab is active: OPENING, Welcome LIVE + Play, Worship Play, SERMON,
      Communion Play. Preview welcome-1, 1/7.
  browser-shows-1280x800.png:
    dimensions: "1280×800"
    seen: "Preview worship-1, 3/7. Shows tab: Worship highlighted with LIVE; Welcome/Communion without; sections and order unchanged."
  browser-empty-1280x800.png:
    dimensions: "1280×800"
    seen: >
      No rows; the panel says exactly `No recent projects. Open a .cjcp from the
      command line and it appears here.` Foot says `Not saved to a file yet.` with
      no button. Top bar Experiment 1; preview lyric-1 1/12; Sunday Service live;
      the demo is not a row.
  browser-portable-1280x800.png:
    dimensions: "1280×800"
    seen: "Foot path + Make portable + `copied 0`; three rows as above."
  browser-missing-before-1280x800.png:
    dimensions: "1280×800"
    seen: "Browser Third red with `missing` and Forget."
  browser-missing-restored-1280x800.png:
    dimensions: "1280×800"
    seen: "Browser Third normal, no `missing`, full path, Forget; the row is openable again without a click."
  freeshow-projects-1280x800.png:
    dimensions: "1280×800 (includes its native menu)"
    seen: "Pinned FreeShow 1.6.8-beta.3: left column with back/more header, `Parity Project`, one `Parity Fixture` row with project icon, round + button bottom right; Shows drawer is a Name/Modified table."
  browser-comparison-1280x800.png:
    dimensions: "600×830 composite"
    seen: "Side-by-side columns: FreeShow's folder header, one icon row and +; candidate's PROJECTS heading, path rows, `current`, `missing`, Forget and Make portable. Differences named in the report match what is visible."
hook_assessment:
  debug_gate: "Present: `if !cfg!(debug_assertions) { return; }` before reading `CJCRSG_DRAWER` (`apps/desktop/src/app.rs:147-151`)."
  release_behaviour: "Not run as a release binary; `cfg!` is compile-time and folds to an early return in release, so the actions are not executed."
  state_access: >
    No direct engine call: every action builds a JS snippet that clicks a rendered
    control (`.project-open`, `.project-forget`, `.drawer-content .outline-show`,
    `.projects-foot .btn`) or scrolls. `open:` and `play:` therefore change the
    live project/show exactly as an operator click would; `forget:` changes the
    session only; `portable` runs the normal bundle path; `top` only scrolls.
    Empirically the open action succeeded through the hook. If “unable to alter
    published render state” means no change at all, this is a conflict; if it means
    no bypass of the UI, it is satisfied.
invariants:
  dioxus_outside_apps: "No: `crates/core`, `crates/compat`, `crates/remote` have no dioxus/tao/wry dependency and no diff in this commit."
  engine_output_change: "None: `git diff be8d9ed..HEAD -- crates` is empty; the app-only diff matches the report."
  unwrap_expect: "No new `unwrap()`/`expect()` outside tests. The only new `expect`s are in `projects.rs` `#[cfg(test)]`; pre-existing mutex `expect`s in runtime.rs are untouched."
  css_embedded: "Yes: `apps/desktop/src/assets.rs` still uses `include_str!(\"../assets/main.css\")`; the renderer and controller both use it."
  session_backward_compatible: "Yes: no `crates/core/src/session.rs` change; `layout.drawer_height` and `opened_at` retain their `serde(default)`."
  removals: >
    `recent.rs`, `ShowRow`/`build_shows` and `AppState.shows` are gone. The old
    five-row RecentProjects panel is replaced by the contract's Projects panel
    (all session entries, row open, Forget), and the drawer's ShowRow slide-count
    list is replaced by the outline model P6 requires. No reference to the removed
    symbols remains; the drawer still has order, live marker and Play. Slide counts
    are the one dropped presentation field, and the scenario notes explicitly make
    P6 supersede drawer B7.
  tick: >
    `let _tick = tick();` (`app.rs:43`) subscribes the controller's own
    `use_signal(0u64)` to its 250 ms `use_future`. It is local Dioxus state: it is
    neither written to an output nor sent anywhere; outputs still receive engine
    snapshots through `SharedEngine`. The logs show the re-render cadence. No 60 Hz
    traffic was added.
evidence_manifest_note: >
  Committed artefacts inspected: all eight images, `run-log-projects.txt`, the five
  session JSON files and `ssr-empty-state.html`. Scratch artefacts in
  `/tmp/opencode/project-browser-evidence/` were used only to corroborate the
  committed state (raw open-second and open-error images, run logs); they are not
  part of the candidate commit.
artefacts:
  - docs/contracts/ui-project-browser.md
  - parity/scenarios/controller-project-browser.yaml (corrected main copy)
  - parity/features/controller-layout.yaml (ui.projects.tree/row/actions/recent)
  - parity/reports/reader/controller-layout-2026-11-09.md §2
  - parity/reports/ui-project-browser-2026-11-09.md
  - parity/reports/evidence/ui-project-browser/ (8 images, run log, 5 session JSON, ssr-empty-state.html)
  - parity/reports/verifier/render-check/session.json
  - /tmp/opencode/verifier-recent-4.html
  - parity/reports/verifier/projects-probe.html
  - /tmp/opencode/projects-probe/remote-1280x800.png
  - parity/reports/verifier/gui-open/session.json
  - parity/reports/verifier/gui-forget/session.json
  - parity/reports/verifier/gui-forget-open/session.json
  - parity/reports/verifier/gui-missing-click/session.json
  - parity/reports/verifier/gui-reopen/session.json
  - parity/reports/verifier/smoke-check/session.json
  - /tmp/opencode/verifier-smoke-demo.json
scenario_input_difference: >
  The candidate tree's `parity/scenarios/controller-project-browser.yaml` predates
  the correction on main: it lacks `action: launch_app` in
  `controller-project-browser-empty` and `controller-project-browser-portable`, and
  its `start_session` comment still says “means launch”. The corrected main copy
  (`ec21d30`) inserts the launch step and rewrites the comment. I read the corrected
  main copy for execution intent; this is not a candidate defect. `main` also has
  the matching wording change in `controller-drawer.yaml`.
housekeeping: >
  One untracked scratch session file was created in the main checkout by mistake
  (`/home/eydamson/projects/cjcrsg-presenter/parity/reports/verifier/render-check/session.json`)
  when the session's working directory was still the main checkout; it is not part
  of the candidate and can be deleted. The verifier worktree contains only the
  untracked `parity/reports/verifier/` files described above; no tracked file was
  modified.
verdict_note: >
  Pass. All eight clauses are met by the code, unit tests, committed images and
  independent checks; the residual notes are non-blocking. The 12 scenarios still
  cannot be executed because no controller adapter exists. Acceptance remains with
  the orchestrator; I have not edited code, contracts, scenarios, baselines or
  fixtures.
---

# Verifier report — controller project browser (DEV-013 milestone 7)

Candidate: `9be245f4938ca58d7cc2098043c924f1d095a82c`, detached at
`dev-013-project-browser`, worktree clean at the start.

## Startup checks

1. `git rev-parse HEAD` = `9be245f4938ca58d7cc2098043c924f1d095a82c` — matches.
2. `git status` at the start: `nothing to commit, working tree clean`.
3. Contract and scenarios read from the candidate tree; the corrected scenario
   file from `main` was used for intent, with the difference noted above.

## Workspace gate

`./scripts/check.sh` run bare, twice (background and foreground):

- exit code **0**;
- `fmt`, `clippy`, tests and the evidence count all green;
- **184 tests** (`24 + 41 + 105 + 14`), matching `EVIDENCE.md`'s
  `<!-- tests: 184 -->`.

## Clause verdicts

| Clause | Verdict | Basis |
| --- | --- | --- |
| **P1** — one Projects panel, open first, recents newest first, open once, all session entries, demo not a row, width unchanged | **pass** | `projects::build`/`same_project`; unit tests `the_open_project_is_first_and_appears_exactly_once`, `recent_rows_keep_the_session_order_newest_first`, `repeated_recent_paths_are_deduplicated`; MAX_RECENT untouched in core; empty capture; width code untouched and 280 px in capture/probe. |
| **P2** — name, muted path, `current` badge, 4 px accent border, missing flag + disabled open, render-time check, no other metadata | **pass** | Component and CSS; computed probe: border 4 px, path `rgb(146,152,171)`, badge `current`, missing text, disabled true; before/restored images; `is_missing` unit test; independent permission-denied/directory/absent render. |
| **P3** — non-current row opens the existing path; current row no-op; failed open inline under list, list intact | **pass** | `open_row` calls `AppState::open_project` unchanged; real `CJCRSG_DRAWER=open:Browser Second` run reordered the session; failed-open session + scratch image show the error under the list with the project unchanged; missing-row open is a no-op. |
| **P4** — Forget on every non-open row, removes one session entry, file untouched, no dialog, open never forgotten | **pass** | Component hides Forget on current; `forget_recent` guard + session test; real `forget:Browser Second` removed exactly one and left the file; `forget:Browser Main` no-op; no dialog in any capture. |
| **P5** — exact empty sentence; open-with-no-others shows just the open project | **pass** | `NO_RECENTS` exact; unit test; `ssr-empty-state.html`; empty capture; `build(Some(open), [open])` returns one row and unit test. |
| **P6** — outline in the drawer's Shows tab (sections, rows, live marker, Play, entry order), no outline in the left column, focus unchanged | **pass** | `DrawerContent.outline` from `outline::build`; `OutlineList` renders h3 sections and rows with live/Play; `browser-projects`/`browser-shows`; `OutlineEntry` order unit test; `FocusView` untouched and still centre-mounted. |
| **P7** — Make portable in the foot, open project, same text/errors, no-file message | **pass** | `ProjectsPanel` foot calls `bundle_media` (unchanged); `browser-portable` shows path, button, `copied 0`; empty capture shows `Not saved to a file yet.` with no button. Error path is code-unchanged but not captured (R4). |
| **P8** — no engine/output change, open publishes through `SharedEngine`, no render-state/media/remote change, measured behaviours intact | **pass** | `git diff be8d9ed..HEAD -- crates` empty; no media-server/remote change; `open_project` still `replace_project_at`; Experiment 1 smoke 7/7 on the demo; open-from-browser scratch image shows the new project/show/slide. |

## Visual evidence, described from the images

- **`browser-projects-1280x800.png`** — 1280×800 content crop. PROJECTS panel
  at the left, 280 px. Browser Main first with a 4 px pink left border, a
  `current` badge and the full wrapped path; Browser Second with path and
  Forget; Browser Third red with `missing` and Forget. Foot pinned to the
  bottom with an ellipsised path and Make portable. Shows tab: OPENING,
  Welcome LIVE + Play, Worship Play, SERMON, Communion Play; preview
  welcome-1, 1/7.
- **`browser-shows-1280x800.png`** — preview worship-1, 3/7; Worship is
  highlighted and marked LIVE; Welcome and Communion are not; sections and
  order unchanged.
- **`browser-empty-1280x800.png`** — no rows; exact sentence
  `No recent projects. Open a .cjcp from the command line and it appears here.`;
  foot `Not saved to a file yet.` with no button; demo Experiment 1 loaded
  (lyric-1, 1/12; Sunday Service live) but not a row.
- **`browser-portable-1280x800.png`** — foot path + Make portable + `copied 0`.
- **`browser-missing-before-1280x800.png` → `browser-missing-restored-1280x800.png`**
  — Browser Third goes from red/`missing` to normal with no label; the pair
  differs in 0.25% of pixels, localised at that row.
- **`freeshow-projects-1280x800.png`** — raw pinned FreeShow 1.6.8-beta.3,
  1280×800 including its native menu; left column with back/more header,
  `Parity Project`, one icon row `Parity Fixture`, + button; Shows table.
- **`browser-comparison-1280x800.png`** — 600×830 composite of the two
  columns; the differences named in the report are visible.

## Measurements

- Candidate window images: all **1280×800** (`compare.mjs` self-comparison).
- FreeShow reference: **1280×800**; comparison composite: **600×830**.
- Row count in the main capture: **3**; empty capture: **0**.
- Row paths wrap in full (no ellipsis); the foot path is truncated with
  `...`. The DOM carries the full path for a `path_suffix` check.
- Missing/restored pair: 0.25% differing pixels, max channel delta 212.
- `run-log-projects.txt` ends at `height=800 top_bar=56`, confirming the
  content-box crop.

## Session files

| File | Observed | Matches |
| --- | --- | --- |
| `session-open-second.json` | `[Browser Second, Browser Main, Browser Third]`, Second refreshed | scenario `-open` after the click |
| `session-forget-second.json` | `[Browser Main, Browser Third]` | scenario `-forget`; file still on disk |
| `session-missing-click-unchanged.json` | `[Main, Second, Third]` | disabled missing row is a no-op |
| `session-open-failed.json` | `[Main, Broken]` | failed open keeps the project and list |
| `session-portable.json` | `[Main, Second, Third]`, Main refreshed | portable re-open records once |
| my `gui-open` | `[Second, Main, Third]` | independent real-window open |
| my `gui-forget` | `[Main, Third]` | independent real-window Forget; file untouched |
| my `gui-reopen` | `[Second, Main, Third]` | a forgotten entry returns when the project is opened again |
| my `gui-forget-open` | `[Main, Second, Third]` | current row is never forgotten |
| my `gui-missing-click` | `[Main, Second, Third]` | missing row open is a no-op |

## Hook

`CJCRSG_DRAWER` is still `cfg!(debug_assertions)`-gated and the env var is
never read in a release build. The extended actions are DOM clicks on the
rendered controls, not engine calls. `open:`/`play:` can therefore change the
live project/show through the same handler an operator uses (the `open:` run
proves it); `forget:` only changes the session; `portable` runs the normal
bundle path; `top` only scrolls. See the ambiguity note if “unable to alter
published render state” was meant absolutely.

## What I did not run

- The 12 scenarios through `parity run` on either adapter — there is no
  controller adapter and no `parity/adapters/` directory in the repo.
- A live missing-file restore and the permission-restore reverse path.
- Live 10-row, width-persistence and focus runs.
- A release binary.

## Verdict

**Pass.** No contract defect was found. The residual notes are low-severity
debug log noise, evidence-completeness gaps and composite-size wording, not
behavioural failures. The 12 milestone scenarios remain unrun because the
controller adapter does not exist; that gap is unchanged and is why each is
marked `not_run`, not passed. I have not edited code, contracts, scenarios,
features, baselines or fixtures, and I do not mark the milestone accepted.
