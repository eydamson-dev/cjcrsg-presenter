# Observed: output lock scopes and layer compositing in the reference

What the pinned reference does with the global output lock and the layer stack:
what the lock blocks (click, per-layer F-key, not the per-output toggle), how
Clear skips an inactive output, and the document order of the output page's
layers (background → underlay → slide → overlay).

| | |
| --- | --- |
| Reference | FreeShow `1.6.8-beta.3` at `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (`commitMatchesPin: true`) |
| Driver | `parity/tools/observe_reference.mjs`, scenario `lock-and-layers` |
| Run | 2026-11-12, Xvfb display `:90`, two normal outputs (`Primary`, `Secondary`) |
| Result | `14/14` steps, `failed: []` (`run.json`); 7 output-screenshot timeouts on the second window (recorded, not step failures) |
| Fixture | seeded `Parity Locks`: slide 0 = `Layer one` text + `logo.png` background + a `placeUnderSlide` overlay `Underlay text` + a normal overlay `Overlay text`; slide 1 = `Layer two`, no background/overlays |

## What each step recorded (`observed`)

| Step | Observed |
| --- | --- |
| `layer_order` | on each page, in document order: the background `<img media logo.png>`, then `Underlay text` (the `placeUnderSlide` overlay), then `Layer one`, then `Overlay text` — the underlay slot sits **below** the slide, the normal overlay above; exactly one background media element |
| `layer_buttons` | the controller groups `Background`, `Slide`, `Overlays`, `Audio`, `Next slide timer` in that order; Background/Slide/Overlays `clearDisabled === false` (content present); Audio and Next slide timer `disabled` (empty); **all five carry titles** (`Clear background`, `Clear slide`, `Clear overlays`, `Clear audio`, `Clear next slide timer`) |
| `lock_global` | Ctrl+L flips the single lock control to `Unlock output [Ctrl+L]` |
| `lock_blocks_click` | with the output locked, clicking another slide card changes neither page (stable across reads ≥400 ms apart) — the click guard |
| `lock_blocks_f3` | with the output locked, F3 leaves both overlays on both pages — the per-layer F-key guard (F3's guard is the lock alone) |
| `lock_allows_output_lock` | with the global lock on, a click on `Primary`'s tile title bar deactivates and strikes it while the **global lock title is unchanged** — the per-output toggle is not guarded by the global lock |
| `clear_skips_inactive` | with `Primary` inactive, `Clear all` empties `Secondary` (slide, overlays, background) and leaves `Primary` untouched |
| `reselect_and_play` | reactivating `Primary` and replaying restores the slide on both pages, so the clear result is attributable to `active`, not a wedged output |

## Corrections found

- `output-window.md:181-182` says a layer button is "red while the layer has
  content and dark when clear … disabled styling". Observed: only Background and
  Overlays compute their title conditionally; **Slide, Audio and Next slide timer
  carry titles unconditionally**, and content is signalled by `disabled` alone.
  The rendered colour is not observable without pixels. Recorded as `A-011`.

Raw artefacts: `steps.json`, `NN-<step>.json`, `NN-<step>-controller.png` /
`-output.png`, `run.json`, `seed.json`, `run.log`, `electron.log`.

## What this run does not show

- **Bounds lock** — it acts only on the OS window frame (drag/resize/re-apply on
  display change); on one display the window is created hidden. Needs a second
  display, a window manager and a scripted drag.
- **Visual stacking/blending** (z-index, opacity, filters) — the claim observed
  is the **document order and presence** of the layer containers, not appearance.
- **Audio / Next-timer as output-page layers** — no output-page DOM; only the
  controller buttons speak for them.
- **Scene** layer (no scene in the fixture), and the transitions/ghosting
  appearance (Svelte JS transitions, no pixels).
