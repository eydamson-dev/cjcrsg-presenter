# Plan

Organised by user-visible capability and architectural risk, not by module.
Something must be usable at every milestone.

## Phase 0 — Architecture validation (**current**)

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

**Exit criteria:** the restart scenario in `docs/experiments.md` passes
end-to-end on a second physical display.

## Phase 2 — Presentation engine

- [x] Blank/clear (keeps position)
- [x] Previous/next edge cases
- [x] Group navigation: next/previous section, skipping empty groups\n- [x] Stage timers and operator message (stage-only)
- [x] Output manager: audience, stage, preview, confidence, independent lifecycles
- Transition compatibility with FreeShow
- [x] Stage display: current + next slide
- [x] Stage display: clock slot and operator notes
- [ ] Remote command parity with the existing socket.io surface (ours is JSON/HTTP)

**Exit criteria:** a service can be run from the app: load, navigate, stage
display on a second screen, remote control from a phone.

## Phase 3 — Data and content

Native project format: see `docs/file-format.md` (`.cjcp` project, `.cjcs`
single show, JSON first, versioned envelope, unknown fields preserved).

- [x] FreeShow `.show` import (read-only) — `crates/compat/src/freeshow.rs`
- [x] Native `.cjcp` read/write with unknown-field preservation — `crates/compat/src/cjcp.rs`
- [x] Media references: bundled/external origin, validation, import
- [x] Media: copy External -> Bundled (`cjcrsg-presenter bundle`)
- [ ] FreeShow database import (DEV-005); our own session state is JSON (D11)
- Media library, templates, groups
- [x] Importers: PDF, DOCX/office via LibreOffice (PPTX/ODP path untested)
- Round-trip tests against files from multiple FreeShow releases

**Exit criteria:** an existing CJCRSG project opens, edits, and saves back
without loss; importers match the converters on a golden corpus.

## Phase 4 — Media engine

- [x] Media items render: image, video, audio; a live slide's video plays
- [ ] Playback coordinator behind a trait: pause/resume per slide, position
- [ ] Media position in `RenderState` for correct recovery mid-playback
- [x] Four outputs playing video at once, measured (30 s, 1080p, 0 dropped)
- [ ] The same over 10 minutes, with H.264 and WebView2
- GStreamer pipeline for synchronised audio/video
- Audio routing, multi-channel, low-latency output
- Capture, LTC

**Exit criteria:** a service with live video and audio plays with no drift and
survives an output restart mid-playback.

## Phase 5 — Professional AV

- NDI send/receive
- DeckLink/SDI playback and capture
- OMT
- OSC and MIDI control surface parity

**Exit criteria:** each integration runs a documented hardware test; absent
hardware skips cleanly rather than failing the suite.

## Phase 6 — Compatibility and release

- Remote protocol parity, including auth and reconnection
- Cloud sync
- Cross-platform packaging (Windows, macOS, Linux X11/Wayland)
- Migration tooling and documentation
- Performance and regression gates

**Exit criteria:** a full service runs on the target machine, with the old app
available as a fallback.

## Risk order

| # | Area | Risk | Why |
| --- | --- | --- | --- |
| 1 | Renderer fidelity | Very high | Autofit and typography are the product |
| 2 | Multi-output lifecycle | Very high | Four WebViews, four failure modes |
| 3 | Show state consistency | Very high | Wrong slide at the wrong moment |
| 4 | Media sync | Very high | Video/audio drift is visible and unforgivable |
| 5 | NDI / SDI | Very high | Vendor SDKs, dedicated hardware |
| 6 | Import converters | High | Another 520k of behaviour |
| 7 | Remote/stage parity | High | Phones already deployed |
| 8 | Cloud sync | High | Account and data migration |
| 9 | MIDI / OSC / LTC | Moderate | Isolated, testable |
| 10 | SQLite / project mgmt | Moderate | Well-trodden |

## Deliberately deferred

- Dioxus Compose / native renderer (Blitz) — experimental; not a bet for a
  presentation app's fidelity.
- Mobile native apps — responsive web/PWA until a concrete need appears.
- Rewriting vendor SDKs in Rust — no value, real risk.
- A new project file format — read and write FreeShow's, always.
