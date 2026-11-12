# Observed: stage + multiple outputs in the reference

What the pinned reference actually did with two enabled normal outputs and one
stage output: opening all three, starting and advancing a show, reading each
output's own text, toggling outputs in the preview, and disabling/re-enabling one
output from Settings > Outputs.

| | |
| --- | --- |
| Reference | FreeShow `1.6.8-beta.3` at `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (`commitMatchesPin: true`) |
| Driver | `parity/tools/observe_reference.mjs`, scenario `stage-multi-output` |
| Run | 2026-11-12, agent workspace, X11 backend, one 1920×1080 display, controller viewport 1600×900 |
| Result | `14/14` steps, 14 controller screenshots, 0 capture failures that fail a step (`run.json`) |
| Fixtures | `parity-three-slides.show` (slides: `Verse one, line one`/`line two`, `Verse one, line three`, `Verse two, line one`), group links repaired in the scratch copy only |
| Seeded | outputs `Primary`, `Secondary` (normal) and `Parity Stage` (`stageOutput: parity-stage`); one stage layout `Parity Stage` with two `slide_text` items, `slideOffset` 0 and 1 |

## What each step recorded

| Step | Observed |
| --- | --- |
| `ready` / `open_project` / `open_show` | controller up; no output window before presenting; the project and `Parity Fixture` show open |
| `present_outputs` | one Present click fans out to all three enabled outputs: three output pages, each naming its own seeded output id; the stage page renders `.stageArea` (a layout, not a slide); three distinct OS windows `Primary` / `Secondary` / `Parity Stage`, none offscreen; the preview draws three tiles, each with a title bar, all active |
| `start` | Space reaches **both** normal outputs (first slide `Verse one, line one`/`line two`); the stage page shows the current slide **and** the next slide (`Verse one, line three`) simultaneously — the layout's `slideOffset` 0 and 1 items |
| `advance` | both active normal outputs advance to the second slide; the stage's current item moves to the new current and its next item to `Verse two, line one` |
| `stage_tile_click` | clicking the stage tile's title bar leaves it active (a stage output is always active); normal tiles unchanged |
| `deselect_secondary` | a plain click deactivates exactly `Secondary`; the other normal and the stage stay active; no window closes |
| `advance_inactive` | the active normal output advances; the deactivated output keeps its previous slide byte-for-byte; the two normal outputs now differ; the stage follows the output it mirrors |
| `last_active_guard` | clicking the last active normal output snaps it back to active and a toast appears; the inactive output and the stage are unaffected |
| `reselect_secondary` | a second plain click reactivates it |
| `disable_output` | Settings > Outputs > `Secondary` > Enabled: the switch read `true` before, and after the click exactly two pages/OS windows remain; the remaining normal output keeps its text; the stage page still renders its layout |
| `enable_output` | switch read `false` before; re-enabling recreates the page and OS window; the other output's content is unchanged |
| `back_to_show` | returns to the show page: three tiles, all with title bars, all active, three windows still open |

Raw artefacts: `steps.json` (all 14 records), `NN-<step>.json` (one per step),
`NN-<step>-controller.png`, `run.json`, `seed.json`, `run.log`, `electron.log`.

## What this run does not show

- **Output-window PNGs.** The three output windows are created hidden
  (`isVisible()` false, `offscreen` false, identical 1920×1080 bounds) on this
  single-display workspace, and llvmpipe does not rasterise three full-size
  surfaces inside `page.screenshot`'s 15 s timeout — 32 capture problems are
  recorded in the step files. The evidence for each output is its **DOM text**
  (`NN-<step>.json` → `outputs[]`) and the **controller screenshot** showing the
  preview tiles. A GPU desktop with two displays would likely capture them, as
  `observe-outputs-2026-11-11-workspace` did for one output.
- **The stage web client and `stage.url`.** This scenario drives output
  *windows*; it does not point a browser at the stage server (5511,
  `?id`/`?name`/`?password`), and it does not exercise `stage.layouts`' editing
  UI (grid, New layout, disable, password, source-output dropdown).
- **`out.multiple.specific`** (slide/textbox output bindings), which is a
  separate feature.
- **What a re-enabled output shows.** The re-enabled page is recorded, not
  asserted, because whether it repaints the current slide or keeps its last
  `out.slide` was not established from source.
