# Controller UI parity

Status: **planned, not started.** Recorded as DEV-013. The outputs already target
FreeShow's look; the controller does not.

## The difference, plainly

FreeShow's controller is a **top bar with three resizable columns**:

| Region | FreeShow (`src/frontend/MainLayout.svelte`) | Ours today |
| --- | --- | --- |
| Top | `Top` — project, profiles, add, settings | title + a Focus button |
| Left | Projects, navigation, stage layouts, draw tabs or settings — switches with the page | Project outline |
| Centre | the show: slide grid, editor, or focus mode | nothing — panels stacked below |
| Right | **Preview** plus page-specific tools | Stage, Media, Outputs panels |
| Bottom | drawer / timeline when enabled | — |

Ours is one scrolling column: readout, project, media, stage, recent projects,
outputs, footer. Every function is reachable, none of FreeShow's layout is
reproduced, and muscle memory from FreeShow does not transfer.

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
│ CJCRSG Presenter · project name   [Prev][Next][First][Clear]  │
│                                    [sections][groups][Focus]  │
├───────────────┬───────────────────────────────┬───────────────┤
│ Project       │ Live preview                  │ Stage         │
│  Section      │  (SlideView, scaled)          │  message      │
│  ▸ Show       │                               │  countdown    │
│  ▸ Show       │ Media                         │  layout       │
│ Recent        │                               │ Outputs       │
└───────────────┴───────────────────────────────┴───────────────┘
```

- **Top bar** carries the commands currently in the readout panel.
- **Left** is the project outline, with recent projects beneath it.
- **Centre** is a live preview of the published `RenderState.slide`, the media
  list, and (in focus mode) the focus list. The preview renders the same
  `SlideView` the outputs use — it is a consumer of state, never a decider.
- **Right** is stage control, output registry and revisions.

Columns should be resizable, with widths remembered in the session store
(`core::session`), not in project data.

## Milestones

1. **Frame.** Top bar and three columns; move the existing panels into their
   target columns; screenshot at the controller's size. No styling pass yet.
2. **Live preview.** Render `state.slide` in the centre, scaled, updated by the
   same 250 ms tick; Focus replaces the centre rather than the whole window.
3. **Styling.** Extract FreeShow's palette, spacing and type scale from its
   Svelte components and match them. This is GPL-3.0 code and so are we; record
   the attribution in `docs/provenance.md`.
4. **Resizable columns.** Drag handles, minimum widths, persisted in the
   session.
5. **Comparison evidence.** Side-by-side controller screenshots, ours and
   FreeShow's, in `EVIDENCE.md`.

## What stays out

- **No slide editor.** FreeShow's centre shows an editable slide grid; ours
  previews the live slide. Editing is a different phase.
- **No drawer or timeline** until a feature needs them.
- **No output-window changes.** The audience/stage/preview/confidence surfaces
  and their parity evidence are untouched.
- **No engine changes.** The controller keeps reading `RenderState` through
  `SharedEngine`; signals stay local UI state.

## Open questions

- Does the preview show the **live** slide (operator confidence) or the
  **selected** slide (a future editor)? Today: live.
- Does focus mode keep the top bar? FreeShow hides it; ours likely keeps a single
  Exit control.
- Do we port FreeShow's icon set, or keep text labels until an icon pass?
