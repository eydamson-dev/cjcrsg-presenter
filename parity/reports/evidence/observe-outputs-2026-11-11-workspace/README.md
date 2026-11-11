# Observed: output-window basics in the reference

What the pinned reference actually did when an operator opened a project show in
an output, read it, locked and unlocked it, advanced, and cleared it.

| | |
| --- | --- |
| Reference | FreeShow `1.6.8-beta.3` at `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (`commitMatchesPin: true`) |
| Driver | `parity/tools/observe_reference.mjs`, scenario `outputs-basic` |
| Run | 2026-11-11, agent workspace, X11 backend, one 1920×1080 display, controller viewport 1600×900 |
| Result | `11/11` steps, 21 screenshots, 0 capture problems (`run.json`) |
| Fixtures | `parity-three-slides.show` (+ notes, + transitions), group links repaired in the scratch copy only (`seed.json`: `groupRepairs`) |
| Show opened | `Parity Fixture` |

## What each step recorded

| Step | What the record shows |
| --- | --- |
| `ready` | controller only; lock control reads `Lock output [Ctrl+L]`; no output page |
| `present` | Present clicked; an output page with root class `fill context #output_window` exists in a window titled `Primary`, `isVisible()` **false**, `isOffscreen()` false, bounds 1919×1079; the Present control still reports `Present [Ctrl+O]` (off) |
| `open_project` | the left panel becomes the project's show list (`Parity Fixture`, `Parity With Notes`, `Transition Fixture`) |
| `open_show` | `Parity Fixture` is the active project item; the output is still empty |
| `start` | Space: output text `Verse one, line one` / `Verse one, line two`; controller position `1/5` |
| `lock` | Ctrl+L flips the single lock control to `Unlock output [Ctrl+L]`; output frame byte-identical to `start` |
| `next_while_locked` | Space: position stays `1/5`, text unchanged, frame byte-identical to `lock` — a locked output does not advance |
| `unlock` | Ctrl+L: title back to `Lock output [Ctrl+L]`; frame unchanged |
| `next` | Space: text `Verse one, line three`, position `2/5`, frame differs from `unlock` |
| `clear_entries` | the inline clear list: `Clear all [esc]` enabled; groups `Background` (no clear title, disabled), `Slide` / `Clear slide  [F2]` **enabled**, `Overlays` / `Clear overlays [F3]` disabled, `Audio` / `Clear audio [F4]` disabled, `Next slide timer` disabled |
| `clear` | Escape: output text `""`, frame byte-identical to the empty output before `start`; `Clear all [esc]` is replaced by a disabled `Restore output` |

Frames are the captured output PNGs, all 1919×1079; the hash groups are:

```
a695902316f25b356d8a3862f6f6f782  present, open_project, open_show, clear   (empty)
0acc002ff1ed99999da5a5778e848294  start, lock, next_while_locked, unlock    (first slide)
cf5178b7e8197d4a99d5e7e32bf987d9  next, clear_entries                      (second slide)
```

The same scenario ran on a Wayland/KDE desktop with an RTX 5060 Ti
(`…-host/`): 11/11 steps and the same text and lock transitions, but **no output
capture at all** — `page.screenshot` timed out and `capturePage()` returned
nothing, while the reference logged `Capture failed for output default:
[Error: UnknownVizError]`. Frames must come from the workspace.

## What this run does not show

- **A mapped window.** `isVisible()` is false and the X server never maps
  `Primary`, so this is the reference presenting to an output it keeps hidden —
  not a window on a screen. The desktop run had **two** displays and recorded the
  same thing. See `parity/README.md`.
- **Anything about a second display, multiple outputs, per-output styles, media
  or audio.** One output, one show, no media.
- **A fixed output size.** The surface was 1919×1079 here and 1920×1080 on the
  2560×1440 desktop, so size follows the environment and must be compared, not
  assumed.
- **A pixel comparison with our renderer.** The controller screenshots carry the
  reference's clock and the workspace renders through llvmpipe.

Raw artefacts: `steps.json` (all 11 records), `NN-<step>.json` (one per step),
`NN-<step>-controller.png`, `NN-<step>-output.png`, `seed.json`, `run.json`
(`controller.viewport`, `controller.displays`, `screenshots`, `failed`),
`run.log`, `electron.log`.
