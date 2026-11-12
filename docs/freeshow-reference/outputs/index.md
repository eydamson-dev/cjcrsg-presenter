# Outputs

- **Area:** outputs
- **Online docs:** [Output](https://freeshow.app/docs/output),
  [Multiple outputs](https://freeshow.app/docs/outputs),
  [Styles](https://freeshow.app/docs/styles), [NDI](https://freeshow.app/docs/ndi),
  [Livestreaming](https://freeshow.app/docs/livestreaming)
- **Pinned code:** ff784eb388c7baef60d67e6d4e7c504f4322bca3 (1.6.8-beta.3)
- **Confidence:** `code`, except where a bullet is labelled `doc` or `unknown`.

## Summary

An output is a window, or an offscreen capture surface, that renders the current
background, slide, overlays and metadata for one destination. FreeShow can run
several at once, each with its own style, bounds and capture target; the shared
content lives in the main window's stores, not in the output windows.

## Label vocabulary

| Label | Meaning here | D13 equivalent |
| --- | --- | --- |
| `observed` | Seen in a recorded run at the pin, with the artefacts kept. | `observed` |
| `code` | Read from `src/...:line` at the pin, not run. | `inferred` |
| `doc` | Stated only by `source/docs/...md`. | weaker `inferred` |
| `unknown` | Not established; see Open questions. | `unknown` |

The present/start/lock/advance/clear path is now `observed` from the
2026-11-11 `outputs-basic` run (one display, one output, no media); see
[output-window](output-window.md#observed--the-outputs-basic-run). The
multiple-output present/fan-out/select/disable path and the stage-window path
are `observed` from the 2026-11-12 `stage-multi-output` run; see
[multiple-outputs](multiple-outputs.md#observed--the-stage-multi-output-run).
Per-output styles (attach, aspect, line window and shared paging, layers) are
`observed` from the 2026-11-12 `styles-multi-output` run; see
[styles](styles.md#observed--the-styles-multi-output-run). The rest of this area
is still `code`, so a contract may rest only on the observed entries without a
further run or explicit provisional approval (`docs/decisions.md:191-193`).

## The output model

- One `outputs` entry per output, keyed by id: `enabled`, `active`, `name`,
  `color`, `bounds`, `screen`, optional `style`, capture flags (`ndi`, `omt`,
  `blackmagic`, `webrtc`, `rtmp`), `invisible`, `transparent`, `alwaysOnTop`,
  `boundsLocked`, and a nested `out` (`src/types/Output.ts:8-39`).
- `out` is what is on screen: `background`, `slide`, `overlays`, `effects`,
  `scene`, `transition` (the slide timer), `refresh`
  (`src/types/Output.ts:74-82`). It lives in the frontend store
  (`src/frontend/stores.ts:383`), so a window consumes state; it does not own it.
- `outputDisplay` is present/stop; `outputState` is the per-window active state
  reported by the main process (`src/frontend/stores.ts:139-140`,
  `src/frontend/utils/receivers.ts:111-125`). A window can exist and render while
  never being shown; `outputDisplay` then stays `false` (`observed`,
  2026-11-11, `output-window.md#observed--the-outputs-basic-run`).
- `styles` is a separate store; an output points at one style by id, and no
  style means the built-in default (`src/frontend/stores.ts:380`,
  `src/frontend/components/helpers/output.ts:1856-1861`).
- `transitionData` holds the global text/media transitions
  (`src/frontend/stores.ts:242-245`); `outLocked` is the global lock
  (`src/frontend/stores.ts:391`).

## The layer model

The docs describe five stacked layers, three visual and two not
(`source/docs/output.md:14-27`).

| Layer | Visual | Code reality | Field | Cleared by | Style-toggle |
| --- | --- | --- | --- | --- | --- |
| Background | yes | style colour/image, background media, scene media | `out.background`, `style.background`, `style.backgroundImage` | Clear background / Clear all | `background` |
| Slide | yes | slide items via `SlideContent`, PDF/PPT, metadata overlay | `out.slide` (show/layout/index) | Clear slide / Clear all | `slide` |
| Overlays | yes | overlays (above and underlays below the slide) and effects, plus scene | `out.overlays`, `out.effects`, `out.scene` | Clear overlays / Clear all | `overlays` |
| Audio | no | app-wide `playingAudio` + routing, not per output | `playingAudio` store | Clear audio / Clear all (mics survive both) | no |
| Slide timer | no | countdown that advances that output | `out.transition` (`{duration, folderPath}`) | Clear next timer / Clear all | no |

Sources: `src/frontend/components/output/Output.svelte:408-485`;
`src/types/Settings.ts:12`; `src/frontend/components/helpers/output.ts:1854`;
`src/frontend/components/output/clear.ts:86-181`; `src/types/Show.ts:649-654`;
`src/frontend/components/helpers/tick.ts:8-51`;
`src/frontend/audio/audioFading.ts:43-47`.

- **Stack order is fixed** (style background, scene media, background, colour
  bars, effects-under, underlays, slide/PDF/PPT, metadata, effects-over,
  overlays, attribution string, draw) — `Output.svelte:408-485`.
- **PDF is drawn by the background layer, PPT by the slide layer**
  (`Output.svelte:441-450`); the clear buttons still treat PDF as a slide
  (`ClearButtons.svelte:160-162`).

## Row map for `out.*`

| ID | Page | One line |
| --- | --- | --- |
| `out.window` | [output-window](output-window.md#outwindow) | The frameless, always-on-top window or offscreen surface per output. |
| `out.layers` | [output-window](output-window.md#outlayers) | The five layers, clear buttons and restore. |
| `out.enable` | [output-window](output-window.md#outenable) | Present/stop; two-click stop, Ctrl+O. |
| `out.preview` | [output-window](output-window.md#outpreview) | Mirrors of each output plus audio meters. |
| `out.controls` | [output-window](output-window.md#outcontrols) | Previous, next, update/start, lock, transition. |
| `out.lock` | [output-window](output-window.md#outlock) | Global lock, per-output lock, bounds lock. |
| `out.status` | [output-window](output-window.md#outstatus) | The coloured dot and tooltip per output. |
| `out.settings` | [output-window](output-window.md#outsettings) | Outputs settings: add, enable, style, capture targets. |
| `out.window.position` | [output-window](output-window.md#outwindowposition) | Screen picker, manual X/Y/size, identify, bounds lock. |
| `out.recorder` | [output-window](output-window.md#outrecorder) | Screen/window recorder and per-output recordings. |
| `out.transitions` | [transitions](transitions.md#outtransitions) | Global, style, slide and textbox transitions. |
| `out.transitions.priority` | [transitions](transitions.md#outtransitionspriority) | Textbox > slide > output style > global; in/out/between. |
| `out.multiple` | [multiple-outputs](multiple-outputs.md#outmultiple) | Any number of outputs; enable each separately. |
| `out.multiple.select` | [multiple-outputs](multiple-outputs.md#outmultipleselect) | Click to toggle, Ctrl/Cmd to select one, right click. |
| `out.multiple.specific` | [multiple-outputs](multiple-outputs.md#outmultiplespecific) | Bind a slide or textbox to chosen outputs. |
| `out.stage-window` | [multiple-outputs](multiple-outputs.md#outstage-window) | A stage layout rendered as an output window. |
| `out.styles` | [styles](styles.md#outstyles) | Per-output look applied to shared content. |
| `out.styles.aspect` | [styles](styles.md#outstylesaspect) | Ratios, or the output's own resolution. |
| `out.styles.lines` | [styles](styles.md#outstyleslines) | Per-output line limit and cross-output paging. |
| `out.styles.layers` | [styles](styles.md#outstyleslayers) | Hide background/slide/overlays per output. |
| `out.styles.template` | [styles](styles.md#outstylestemplate) | Template override and its colour rule. |
| `out.styles.metadata` | [styles](styles.md#outstylesmetadata) | Metadata/message templates and display rules. |
| `out.ndi` | [ndi-and-streaming](ndi-and-streaming.md#outndi) | Send an output over NDI. |
| `out.livestream` | [ndi-and-streaming](ndi-and-streaming.md#outlivestream) | Control OBS Studio over its WebSocket. |

## State and persistence

| What | Where | Written | Survives restart |
| --- | --- | --- | --- |
| Output definitions | `outputs` store | On edit | `unknown` (not traced) |
| What is on screen | `outputs[id].out` | Every `setOutput` | No (not persisted) |
| Global transition | `transitionData` | On edit | Saved in settings (`src/frontend/utils/save.ts:192`) |
| Global lock | `outLocked` | On toggle | Saved in settings (`src/frontend/utils/save.ts:184`) |
| Locked overlays | `lockedOverlays` | On overlay change (`output.ts:331-342`) | Yes; re-applied on load (`updateSettings.ts:289-307`) |
| Bounds/screen | `outputs[id].bounds`, `.screen` | Screen pick, manual edit, drag (`receivers.ts:129-137`) | Yes |

## Screenshot


![The output window at 1920x1080.](../screenshots/output-window.png)

Captured from the running reference (1.6.8-beta.3), 2026-11-09.

`../screenshots/outputs-index.png` — not yet captured. Shot list: main window,
**Show** view, right preview panel with two enabled outputs (one local, one
NDI/invisible), one locked (struck-through name), clear-button column visible,
1600×1000 at 100%.

## Doc vs code

- `doc` calls the non-visual layers "audio and slide timer"
  (`source/docs/output.md:21`). Code has a per-output slide timer, but audio is
  app-wide, with optional per-output routing
  (`src/frontend/audio/audioFading.ts:22-48`).
- `doc` says each layer can be toggled off independently
  (`source/docs/output.md:23`). Only `background`, `slide`, `overlays` are
  style-toggleable (`src/types/Settings.ts:12`).
- `doc` says Restore Output restores "all layers in the current slide"
  (`source/docs/output.md:31-32`). Code restores the whole cached `out` of each
  active output, plus audio and metronome
  (`src/frontend/components/output/clear.ts:59-84`).

## Open questions

- Whether output definitions persist: `save.ts` was traced only for
  `outLocked`/`lockedOverlays`, not for `outputs`.
- Outputs can share one render page
  (`src/electron/output/helpers/OutputLifecycle.ts:105-130`); the visible effect
  of one member being resized is not traced.
- `OutputLifecycle.ts:279` minimizes non-offscreen outputs at creation on macOS;
  why and whether it stays minimized is `unknown`.

## Changelog

- `2026-11-11` — the outputs area is no longer all `code`: added the `observed`
  label row, pointed at the `outputs-basic` run, and recorded that an output
  window can exist and render without being shown. Audit `A-006`.
- `2026-11-12` — the multiple-output and stage-window paths are also `observed`
  now (`stage-multi-output` run); pointed the "rest is still `code`" note at the
  `multiple-outputs` observed section too.
- `2026-11-12` — per-output styles are `observed` now (`styles-multi-output`
  run); pointed the "rest is still `code`" note at the `styles` observed section.
