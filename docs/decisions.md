# Decisions

Short records of choices that are expensive to reverse. Newest last.

## D1 — Dioxus, on a WebView

**Context.** The app is a presentation tool whose look comes from HTML/CSS.
Dioxus's own renderer (Blitz) is experimental.

**Decision.** Dioxus 0.7.10 desktop, webview renderer, pinned exactly.

**Consequences.** The slide renderer stays HTML/CSS, so FreeShow's visual
contract can be carried across. We take on a 0.x framework; the version is
pinned and desktop API use is kept at the edges.

## D2 — Slides lay out at 1920×1080 and scale

**Context.** The first renderer reflowed: font sizes in `vw`, layout recomputed
per window size. FreeShow's `Zoomed` component lays out at a base resolution and
scales with `min(w/1920, h/1080)`.

**Decision.** Lay out at a fixed 1920×1080 and scale with a `--slide-scale`
variable computed from the viewport. `calc()` cannot divide a length by a number
inside `scale()`, so the variable is set by script.

**Consequences.** Proportions are identical at every output size, and text
metrics match FreeShow. Measured: every text box within 0.15 px, 0.35% differing
pixels at 1080p (`parity/reports/experiment-2-2026-11-09.md`).

## D3 — One `VirtualDom` per output; the engine owns the show

**Decision.** Each output window is an independent `VirtualDom`. The engine is
behind an `Arc<SharedEngine>`, never owned by a window.

**Consequences.** A closed window loses nothing; reopening reconstructs from a
snapshot. Verified: 205 ms recovery (`parity/reports/experiment-1-2026-11-09.md`).

## D4 — Snapshots, not events

**Decision.** Outputs subscribe to a `tokio::sync::watch` of `RenderState`, and
state carries a monotonic revision. No per-output channel, no event replay.

**Consequences.** A late or restarted window needs only the newest value. The
renderer animates only when it already knew a previous revision, so reopening
never replays a transition the congregation saw.

## D5 — Native format: JSON first, zip later

**Decision.** `.cjcp` (project) and `.cjcs` (show) are versioned JSON envelopes.
A newer `format_version` is refused, unknown fields are preserved. A zip
container with bundled media is a later, additive change.

**Consequences.** Files are diffable and testable in git. Media stays referenced,
not embedded, until packaging.

## D6 — Media paths are relative and typed

**Decision.** A media asset carries `origin` (`bundled` | `external`). Bundled
paths are relative and may not escape the project root; external paths may be
absolute and are documented as non-portable. FreeShow imports therefore arrive
as `external`.

**Consequences.** Projects survive being moved. The UI must offer "copy into
project" to make media portable, which is not implemented yet.

## D7 — GPL-3.0, and stay there

**Decision.** The project is GPL-3.0-only, inherited from FreeShow. No clean-room
claim is made and relicensing is out of scope.

**Consequences.** Source must remain available to anyone receiving binaries.
See `docs/provenance.md`.

## D8 — Our own remote protocol, for now

**Decision.** The remote is JSON over HTTP on port 5520, with a small HTML page.
FreeShow's clients speak Socket.IO on 5510–5513.

**Consequences.** The command path is proved and testable without a browser, but
existing FreeShow remote clients will not talk to us. Socket.IO parity is a
separate milestone.

## D9 — Visual evidence comes from headless renders, not windows

**Context.** Capturing native windows on this Wayland session failed repeatedly:
focus cannot be taken by the app, nothing can capture by window id, and KWin
scripting raised the wrong window twice and captured unrelated work.

**Decision.** Render the real components to HTML with `dioxus-ssr` and screenshot
them in headless Chromium. Native-window behaviour is covered by measurements
(Experiment 1), not by screenshots.

**Consequences.** Visual regression testing works on a machine in use, with no
risk of touching the desktop. Native window chrome is not in the pictures.
