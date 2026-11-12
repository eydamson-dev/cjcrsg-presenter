# Plan

Organised by user-visible capability and architectural risk, not by module.
Something must be usable at every milestone.

Each feature is identified by its ID in `docs/freeshow-reference/feature-inventory.md`
(225 IDs). Each phase item names the IDs it covers, and every ID belongs to exactly
one delivery tier (below). `docs/freeshow-reference/tiers.md` is generated from the
inventory by `scripts/plan_tiers.py`, which fails if an ID is unassigned.

## Delivery tiers

Features are scheduled by what a service needs, not by how many there are.

| Tier | Meaning | Count | Gate to start |
| --- | --- | --- | --- |
| 1 | Needed to run a service: presenting, outputs, projects, remote and stage, the drawer basics, the data files, and the internal behaviour they rest on | 63 | Reader observation for each feature (see *Gates*) |
| 2 | Needed to prepare a service: editing, items, groups, templates, overlays, scripture, audio playback, actions and timers, import and export | 110 | All Tier 1 features accepted or deferred by the user |
| 3 | Deferred or outside the current phases: cloud sync, integrations, MIDI, OBS, smart features, NDI and streaming, CCLI, calendar, documentation-only entries | 52 | Written request from the user |

The full list is in `docs/freeshow-reference/tiers.md`. The tier of a feature changes
only by editing `scripts/plan_tiers.py` and regenerating, so the plan and the
mapping cannot drift apart.

### Gates

A feature moves through the agentic workflow (`docs/agentic-workflow.md`) before it
counts as delivered:

1. **Observed.** The reader runs the reference and records at least one `observed`
   claim on the feature's page. A feature with only `code` claims cannot be
   accepted; the verifier records "not yet exercised".
2. **Contract.** Approved by the user, citing the feature ID.
3. **Scenario.** Derived from the observed claims only.
4. **Implement and verify.** Verifier pass on the exact SHA, with an independent
   execution run, as in DEV-015.
5. **Accept.** The orchestrator records the IDs in `docs/status.md`.

Today three slices of Tier 1 have real `observed` claims: the end-of-show move
(`show/presenting.md`, 2026-11-09), output-window basics — present, start,
lock, Space while locked, unlock, next, clear
(`outputs/output-window.md`, 2026-11-11, run in
`parity/reports/evidence/observe-outputs-2026-11-11-workspace/`), and stage +
multiple outputs (`outputs/multiple-outputs.md`, `remote/stage.md`, 2026-11-12,
run in
`parity/reports/evidence/observe-stage-multi-output-2026-11-12-workspace/`). The
rest of the 63 still need the observation step before they can be accepted. The
driver is `parity/tools/observe_reference.mjs`; extending it is how the next
slice moves from `code` to `observed`.

## Phase 0 — Architecture validation (done)

**Goal:** prove the Dioxus multi-window foundation before writing product code.

- [x] Architecture decided and recorded (`docs/architecture.md`)
- [x] Experiment 1 — multi-window Dioxus + `RenderHub` recovery (passed, 205 ms; `parity/reports/experiment-1-2026-11-09.md`)
- [x] Experiment 2 — renderer parity, first pass (horizontal metrics exact; `parity/reports/experiment-2-2026-11-09.md`)
- [x] Experiment 3 — no dropped frames at 4 surfaces (`parity/reports/experiment-3-2026-11-09.md`); CPU attribution inconclusive

**Exit criteria:** all three experiments have numeric results in
`parity/reports/` and the pass criteria in `docs/experiments.md` are met or
knowingly waived with a documented alternative.

**Do not proceed if Experiment 1 fails.** The escape hatch is a JS renderer
island, not a different architecture.

## Phase 1 — Walking skeleton

**Goal:** one real project, one show, one slide, one audience output, one remote
NEXT, and a restart that recovers.

- `crates/core`: domain types, `.show` parsing for a fixture, show engine with
  NEXT/PREVIOUS/GOTO and tests
- `crates/compat`: read-only `.show` reader
- `apps/desktop`: controller window, one audience window, remote NEXT
- Audit log of every window lifecycle transition

Covers Tier 1: `out.window`, `out.enable`, `remote.connect`, `sys.servers`,
`sys.persistence`.

**Exit criteria:** the restart scenario in `docs/experiments.md` passes
end-to-end on a second physical display. *Not met: the second display needs
hardware (see Phase 2).*

## Phase 2 — Presentation engine

Tier 1 features: `show.present`, `show.present.active`, `show.slides`,
`show.slides.disabled`, `show.backgrounds`, `show.backgrounds.missing`,
`show.views.grid`, `show.groups`, `show.layers`, `nav.bounds.next-at-end`,
`out.transitions`, `out.transitions.priority`, `out.stage-window`,
`out.multiple`, `out.multiple.select`, `out.styles`, `out.styles.aspect`,
`out.styles.lines`, `out.styles.layers`, `out.lock`, `out.status`,
`out.preview`, `out.controls`, `out.layers`, `out.settings`,
`out.window.position`, `stage.layouts`, `stage.items`, `stage.url`,
`remote.password`, `remote.mobile`, `remote.show`, `remote.output`,
`controller.client`, `media.play`, `media.background`, `media.controls`,
`media.next-finished`.

- [x] Blank/clear (keeps position) — `out.layers`, `out.controls`
- [x] Previous/next edge cases — `show.present`
- [x] Next at a show's end, two-step and setting-controlled — `nav.bounds.next-at-end`
  (DEV-015, accepted at `a2704e5`; the verifier report is
  `parity/reports/verifier/dev-015-a2704e5-r2.yaml`)
- [x] Group navigation: next/previous section, skipping empty groups — `show.groups`
- [x] Stage timers and operator message (stage-only) — `stage.items`
- [x] Output manager: audience, stage, preview, confidence, independent lifecycles — `out.multiple`, `out.preview`
- [ ] Transition compatibility with FreeShow — `out.transitions`, `out.transitions.priority`; the transition priority chain is `code` only
- [x] Stage display: current + next slide — `stage.items`
- [x] Stage display: clock slot and operator notes — `stage.items`
- [ ] Remote command parity with the existing socket.io surface (ours is JSON/HTTP) — `remote.show`, `remote.output`; the FreeShow surface is `sys.servers`
- [ ] Output layers observed in the reference (background, slide, overlays, audio, timer) — `out.layers`; the five layers are observed as clear targets (2026-11-11), their compositing is still `code`
- [ ] Output lock and its three distinct scopes observed — `out.lock`; the single controller control (Ctrl+L) is observed blocking Space (2026-11-11), the three scopes are still `code`
- [ ] Multi-output selection observed (2026-11-12: title-bar toggle, last-active
  guard); specific-output bindings still `code` — `out.multiple.select`, `out.multiple.specific`
- [ ] Slide and background ghosting observed — `show.backgrounds`
- [ ] Disabled slides skipped by navigation, playable by click — `show.slides.disabled`

**Exit criteria:** a service can be run from the app: load, navigate, stage
display on a second screen, remote control from a phone.

## Phase 3 — Data and content

Tier 1 features: `proj.model`, `proj.list`, `proj.create`, `proj.items`,
`proj.reorder`, `proj.navigate`, `proj.sections`, `data.paths`, `data.folders`,
`data.config-in-data`, `fmt.show`, `fmt.project`, `sys.settings`, `sys.stores`,
`sys.security`, `sys.arch`, `sys.ipc`.

Tier 2 features in this phase: `proj.folders`, `proj.template`, `proj.private`,
`proj.search-add`, `proj.export`, `proj.import`, `show.create`, `show.categories`,
`show.search`, `show.quicklyrics`, `import.formats`, `import.pdf`, `import.pptx`,
`export.formats`, `fmt.bible`, `data.backup`, `data.profiles`.

Native project format: see `docs/file-format.md` (`.cjcp` project, `.cjcs`
single show, JSON first, versioned envelope, unknown fields preserved).

- [x] FreeShow `.show` import (read-only) — `fmt.show` — `crates/compat/src/freeshow.rs`
- [x] Native `.cjcp` read/write with unknown-field preservation — `fmt.project` — `crates/compat/src/cjcp.rs`
- [x] Media references: bundled/external origin, validation, import — `media.play`
- [x] Media: copy External -> Bundled (`cjcrsg-presenter bundle`) — `data.folders`
- [ ] FreeShow database import (DEV-005); our own session state is JSON (D11) — `data.paths`
- [ ] Project folders and templates observed in the reference — `proj.folders`, `proj.template`
- [ ] Private shows and their sharing rule observed — `proj.private`
- [ ] Sections observed with their notes and trigger actions — `proj.sections`
- [ ] Media library, templates, groups — Tier 2: `media.folders`, `template.create`, `show.groups.global`
- [x] Importers: PDF, DOCX/office via LibreOffice (PPTX/ODP path untested) — `import.pdf`, `import.pptx`
- [ ] Round-trip tests against files from multiple FreeShow releases — `fmt.show`, `fmt.project`

**Exit criteria:** an existing CJCRSG project opens, edits, and saves back
without loss; importers match the converters on a golden corpus.

## Phase 4 — Media engine

Tier 1 features: `media.play`, `media.background`, `media.controls`,
`media.next-finished`.

Tier 2 features in this phase: `media.folders`, `media.filters`, `audio.play`,
`audio.effects`, `audio.routing`, `sys.media`.

- [x] Media items render: image, video, audio; a live slide's video plays
- [ ] Playback coordinator behind a trait: pause/resume per slide, position
- [ ] Media position in `RenderState` for correct recovery mid-playback
- [x] Four outputs playing video at once, measured (30 s, 1080p, 0 dropped)
- [ ] The same over 10 minutes, with H.264 and WebView2
- GStreamer pipeline for synchronised audio/video — `audio.routing`
- Audio routing, multi-channel, low-latency output — `audio.routing`
- Capture, LTC — Tier 3 (`media.screens`, `media.cameras`, `media.recording`)

**Exit criteria:** a service with live video and audio plays with no drift and
survives an output restart mid-playback.

## Phase 5 — Professional AV

Tier 3 features: `out.ndi`, `out.livestream`, `out.recorder`, `media.recording`,
`media.screens`, `media.cameras`, `midi.actions`, `midi.defaults`,
`companion.module`, `functions.obs`, `actions.emitters`.

- NDI send/receive — `out.ndi`
- DeckLink/SDI playback and capture — not in the inventory; add an ID before scheduling
- OMT — `sys.media`
- OSC and MIDI control surface parity — `midi.actions`, `midi.defaults`, `actions.emitters`

**Exit criteria:** each integration runs a documented hardware test; absent
hardware skips cleanly rather than failing the suite.

## Phase 6 — Compatibility and release

This phase is Tier 3 for FreeShow features: `cloud.*`, `integration.*`,
`data.kiosk`, `data.updates`, `smart.*`, `ccli.*`, `calendar.*`, `sys.build`.
Release packaging itself is our own work, not a FreeShow feature.

- Remote protocol parity, including auth and reconnection — `remote.password`, `sys.security`
- Cloud sync — `cloud.sync`, `cloud.merge`, `cloud.media`, `cloud.readonly`, `cloud.conflict`
- Cross-platform packaging (Windows, macOS, Linux X11/Wayland) — not a FreeShow feature; see `docs/windows.md`
- Migration tooling and documentation — `data.import-export-settings`
- Performance and regression gates

**Exit criteria:** a full service runs on the target machine, with the old app
available as a fallback.

## Phase 7 — Controller UI parity

Planned in `docs/ui-parity.md`; DEV-013. The outputs already targeted FreeShow's
look; the controller now does too.

Tier 1 features: `drawer.shell`, `drawer.tabs`, `drawer.shortcuts`,
`out.controls`, `out.lock`, `out.enable`, `proj.list`, `proj.navigate`.

Tier 2 features: `drawer.search`, `show.views.simple`, `show.views.list`,
`show.views.lyrics`, `show.edit`, `show.edit.tabs`, `show.items`.

- [x] Top bar and three resizable columns
- [x] Live slide preview in the centre, fed by `RenderState`
- [x] FreeShow palette, spacing and type
- [x] Column widths persisted in the session
- [x] Side-by-side controller screenshots as evidence
- [x] Focus mode inside the centre column
- [x] Controller drawer: eight tabs in FreeShow's order — `drawer.tabs`
- [x] Project browser — `proj.list`, `proj.navigate`
- [x] At end: advance / stop control — `nav.bounds.next-at-end`
- [ ] Shortcuts observed and matched — `drawer.shortcuts`

**Exit criteria met for the shell.** The comparison is in
`parity/reports/ui-shell-2026-11-09.md`. What remains is information architecture —
the project catalogue (Tier 1 `proj.create`, `proj.reorder`, Tier 2
`proj.folders`) and the slide editor (Tier 2 `show.edit`) — which are features,
not the shell.

## Risk order

| # | Area | Risk | Why | Tier |
| --- | --- | --- | --- | --- |
| 1 | Renderer fidelity | Very high | Autofit and typography are the product | 1 |
| 2 | Multi-output lifecycle | Very high | Four WebViews, four failure modes | 1 |
| 3 | Show state consistency | Very high | Wrong slide at the wrong moment | 1 |
| 4 | Media sync | Very high | Video/audio drift is visible and unforgivable | 1 |
| 5 | NDI / SDI | Very high | Vendor SDKs, dedicated hardware | 3 |
| 6 | Import converters | High | Another 520k of behaviour | 2 |
| 7 | Remote/stage parity | High | Phones already deployed | 1 |
| 8 | Cloud sync | High | Account and data migration | 3 |
| 9 | MIDI / OSC / LTC | Moderate | Isolated, testable | 3 |
| 10 | SQLite / project mgmt | Moderate | Well-trodden | 1 |

## Deliberately deferred

- Dioxus Compose / native renderer (Blitz) — experimental; not a bet for a
  presentation app's fidelity.
- Mobile native apps — responsive web/PWA until a concrete need appears.
- Rewriting vendor SDKs in Rust — no value, real risk.
- A new project file format — read and write FreeShow's, always.
- Tier 3 features (`docs/freeshow-reference/tiers.md`) — scheduled only on a
  written request from the user.
