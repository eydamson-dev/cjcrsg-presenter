# Controller UI parity

Status: **shell, drawer and project browser done.** Frame, live preview,
FreeShow palette, resizable columns, focus-in-centre, the eight-tab bottom
drawer with its clock, the left Projects column, and side-by-side comparisons
against FreeShow are in. What remains for DEV-013 is a project catalogue behind
the browser (folders, create, rename, import) and the slide editor; the
text-only tabs are DEV-014.

## The difference, plainly

FreeShow's controller is a **top bar with three resizable columns**:

| Region | FreeShow (`src/frontend/MainLayout.svelte`) | Ours today |
| --- | --- | --- |
| Top | `Top` — project, profiles, add, settings | title, transport, sections, Focus |
| Left | Projects, navigation, stage layouts, draw tabs or settings — switches with the page | Projects: open project plus recent, newest first |
| Centre | the show: slide grid, editor, or focus mode | live preview of the live slide, or focus mode |
| Right | **Preview** plus page-specific tools | Stage controls and the output registry |
| Bottom | drawer / timeline when enabled | eight-tab drawer, no timeline |

The three columns, the drawer and the left column's job now match. What differs
is underneath: FreeShow's browser is a folder tree over a project catalogue, and
its centre edits a slide grid; ours lists the session's projects and previews
the live slide.

The window also said "Experiment 1 · multi-window state recovery" until
2026-11-09; it now says "Controller".

## Why it ended up this way

Phases 0–4 were engine, format, media and packaging. The controller began as a
harness to drive the experiments — four outputs, close/reopen, revision
readouts — and grew panels as features arrived. Nothing in the engine, format or
media layers depends on this layout; moving it is a UI change only.

## Target shell

```
┌───────────────────────────────────────────────────────────────┐
│ CJCRSG Presenter · project   [◀][▶][First][Clear]  [Section]  │
│                                                   [Focus]     │
├───────────────┬───────────────────────────────┬───────────────┤
│ Projects      │ Live preview                  │ Stage         │
│  ▸ Current    │  (SlideView, scaled)          │  message      │
│  ▸ Recent     │                               │  countdown    │
│  ▸ Recent     │                               │  layout       │
│               │                               │ Outputs       │
├───────────────┴───────────────────────────────┴───────────────┤
│ [Shows][Media][Audio][Overlays][Templates][Scripture]…  clock │
└───────────────────────────────────────────────────────────────┘
```

- **Top bar** carries the commands currently in the readout panel.
- **Left** is Projects: the open project first, then recent projects newest
  first, with a missing-file flag and Forget.
- **Centre** is a live preview of the published `RenderState.slide`, and (in
  focus mode) the focus list. The preview renders the same `SlideView` the
  outputs use — it is a consumer of state, never a decider.
- **Bottom** is the drawer: the project outline is the Shows tab, media and
  audio have their own tabs, and the clock sits on the right.
- **Right** is stage control, output registry and revisions.

Columns should be resizable, with widths remembered in the session store
(`core::session`), not in project data.

## Milestones

1. ~~**Frame.** Top bar and three columns; move the existing panels into their
   target columns; screenshot at the controller's size.~~ Done.
2. ~~**Live preview.** Render `state.slide` in the centre, scaled, updated by the
   same 250 ms tick.~~ Done; focus still replaces the whole window.
3. ~~**Styling.** Extract FreeShow's palette, spacing and type scale from
   `public/global.css` and match them.~~ Done: `--primary #242832`,
   `--primary-darker #191923`, `--secondary #f0008c`, `--accent #90caf9`, the
   system font stack, 6 px radii, 40 px top bar.
4. ~~**Resizable columns.** Drag handles, minimum widths, persisted in the
   session.~~ Done: two 6 px handles, widths clamped to 200–480 / 260–520 and
   saved in the session. The drag itself was not automated; clamping and
   session round-trip are tested.
5. ~~**Comparison evidence.**~~ Done: FreeShow 1.6.8 captured on X11 with
   `--ozone-platform=x11`, ours with `scripts/capture_window.sh`, both in
   `evidence/ui-shell/comparison.png`.
6. ~~**Bottom drawer.**~~ Done: eight tabs in FreeShow's order, 40/300/maximum
   geometry with the maximum measured from our top bar, drag and double-click
   collapse, remembered height, Ctrl+1..8, media split into Media and Audio,
   the five library-less tabs naming their gap, and the clock with a long-form
   date. Contract `docs/contracts/ui-drawer.md`, scenarios
   `parity/scenarios/controller-drawer.yaml`, evidence
   `parity/reports/ui-drawer-2026-11-09.md`, verifier pass on `b969f82`.
7. ~~**Left project browser.**~~ Done: the left column is Projects — the open
   project marked, recent projects newest first, missing files flagged, Forget,
   Make portable in its foot, and the outline moved into the drawer's Shows
   tab. Contract `docs/contracts/ui-project-browser.md`, scenarios
   `parity/scenarios/controller-project-browser.yaml`, evidence
   `parity/reports/ui-project-browser-2026-11-09.md`, verifier pass on
   `9be245f`.

What is still missing under DEV-013 is a **project catalogue**: FreeShow's
folder tree, New/rename/duplicate/delete/archive and import all need somewhere
to write projects, which this build does not have. The slide editor remains a
different phase.

## Evidence method

The controller is now screenshotted from the real window: run it with
`GDK_BACKEND=x11` and use `scripts/capture_window.sh`, which captures by X
window id. Wayland offers no window-targeted capture, and a component render is
not the controller.

## What stays out

- **No slide editor.** FreeShow's centre shows an editable slide grid; ours
  previews the live slide. Editing is a different phase.
- **No timeline** until a feature needs one. The drawer exists because the
  media, audio and show lists needed a home.
- **No output-window changes.** The audience/stage/preview/confidence surfaces
  and their parity evidence are untouched.
- **No engine changes.** The controller keeps reading `RenderState` through
  `SharedEngine`; signals stay local UI state.

## Open questions

- Does the preview show the **live** slide (operator confidence) or the
  **selected** slide (a future editor)? Today: live.
- Does focus mode keep the top bar? FreeShow hides it; ours likely keeps a single
  Exit control.
- Icons: answered for now — text labels only, recorded as DEV-014. Port
  FreeShow's icon set when a controller icon pass happens.
