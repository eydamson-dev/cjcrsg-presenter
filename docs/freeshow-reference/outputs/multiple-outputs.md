# Multiple outputs

- **IDs:** `out.multiple`, `out.multiple.select`, `out.multiple.specific`,
  `out.stage-window`
- **Area:** outputs
- **Online docs:** [Multiple outputs](https://freeshow.app/docs/outputs),
  [Stage](https://freeshow.app/docs/stage)
- **Pinned code:** ff784eb388c7baef60d67e6d4e7c504f4322bca3
- **Confidence:** `code` (one `doc` claim, see Doc vs code); `observed` for the
  multi-output present/fan-out/select/disable path and the stage-window path
  measured 2026-11-12 (see Observed), and for the slide/textbox binding path from
  the 2026-11-12 `nav-output-bindings` run (see Observed). Unobserved parts — the
  binding menus, stage bindings, the stage layout editor, the stage web client —
  stay `code`/`doc`.

## Screenshot

![Settings > Outputs for the primary output.](../screenshots/settings-outputs.png)

Captured from the running reference (1.6.8-beta.3), 2026-11-09.


## Summary

FreeShow runs any number of outputs, each independently enabled and each with
its own style, window and capture target. Commands that change the programme
(slides, background, overlays, clears, advance) apply only to the outputs the
operator has *selected* (active), unless a slide or textbox is bound to specific
outputs.

## Observed — the `stage-multi-output` run

Source: `parity/reports/evidence/observe-stage-multi-output-2026-11-12-workspace/`.
Scenario `stage-multi-output`, 2026-11-12, FreeShow `1.6.8-beta.3` at
`ff784eb388c7baef60d67e6d4e7c504f4322bca3` (`commitMatchesPin: true`). Hidden X11
agent workspace, one 1920×1080 display, controller viewport 1600×900. Two
enabled normal outputs (`Primary`, `Secondary`) and one stage output
(`Parity Stage`, `stageOutput: parity-stage`), plus one stage layout
`Parity Stage` with two `slide_text` items (`slideOffset` 0 and 1). Show
`Parity Fixture` (3 slides). 14/14 steps, `failed: []` (`run.json`,
`steps.json`). Each output's content is its DOM text (`NN-<step>.json` →
`outputs[]`); the output *windows* were created hidden and their page screenshots
timed out on llvmpipe, so an output is evidenced by its page text plus the
controller screenshot, not by an output PNG (see the run's README, "does not
show").

1. **Several outputs at once, each with its own window.** One Present click
   opened three output pages and three distinct OS windows — `Primary`,
   `Secondary`, `Parity Stage` (`browserWindows[]` ids 3, 4, 5) — none offscreen
   and none minimized (`present_outputs`, index 4).
2. **A command fans out to the active normal outputs.** Space (start) put the
   first slide on both normal outputs, and advance moved both to the next slide
   (`start`, `advance`). After `Secondary` was deactivated, advance moved only
   `Primary`; `Secondary` kept its previous slide byte-for-byte
   (`advance_inactive`). Inactive normal outputs and the stage output are not
   fan-out targets.
3. **Enabling/disabling is independent, and disabling destroys the window.**
   Disabling `Secondary` from Settings > Outputs removed its page and its OS
   window while `Primary` kept its slide and `Parity Stage` kept its layout
   (`disable_output`); re-enabling recreated the page and a new OS window and
   left the other two outputs' content unchanged (`enable_output`).
4. **Each tile has a title bar, and a plain title-bar click toggles `active`.**
   With three enabled outputs every preview tile had a title bar; a plain click
   on `Secondary`'s title-bar button deactivated it (name struck,
   `active:false`), and a second click reactivated it (`present_outputs`,
   `deselect_secondary`, `reselect_secondary`).
5. **The last active normal output cannot be deactivated.** Clicking the last
   active normal output snapped it back to `active:true` and a toast appeared:
   "You have to have at least one active output!" (`last_active_guard`).
6. **A stage output renders the stage layout and is always active.** Its page
   reports `stageArea:true` and renders the layout, not a slide; its title-bar
   button offers no output lock (`buttonTitle:""`), and clicking it leaves it
   active (`present_outputs`, `stage_tile_click`).

**Boundary this run does not cover.** `out.multiple.specific` (slide/textbox
bindings), the stage web client and `stage.url`, the stage layout editor, and any
mapped output frame.

## Observed — the `nav-output-bindings` run

Source: `parity/reports/evidence/observe-nav-output-bindings-2026-11-12-xvfb/`.
Scenario `nav-output-bindings`, 2026-11-12, FreeShow `1.6.8-beta.3` at
`ff784eb388c7baef60d67e6d4e7c504f4322bca3` (`commitMatchesPin: true`). Hidden X11
agent workspace, one 1920×1080 display, controller viewport 1600×900. Two enabled
normal outputs: `Primary` (id `primary`) and `Secondary` (id `secondary`). Show
`Parity Bindings` (5 flat slides): entry 0 has two items, the second bound to
`primary` alone; entry 1 is bound to `["primary"]`; entry 3 to
`["primary","Secondary"]` (an id and a **name**); entry 4 to `["ghost-output"]`, an
id that does not exist (`seed.json`). 11/11 steps, `failed: []` (`run.json`); five
page-screenshot timeouts on the second window are recorded and are not step
failures, so an output is evidenced by its page text (`outputs[]`) plus the
controller screenshot, not by an output PNG (see the run's README).

1. **An unbound slide reaches both active outputs; a bound item is filtered per
   output.** One Space put `Bind one` on both pages, and only `primary` rendered
   the second item `Bind one, primary only` (`05-start.json`; the per-output item
   filter at `output.ts:1958-1964`).
2. **A slide bound to one output goes only there.** Clicking entry 1
   (`bindings: ["primary"]`) put `Bind two` on `primary` and left `secondary` on
   `Bind one`, stable across two reads ≥400 ms apart
   (`06-click-bound-slide.json`; `output.ts:151-155`).
3. **Advance skips a slide bound elsewhere.** From that state one Space moved
   `primary` from entry 1 to entry 2 and `secondary` from entry 0 to entry 2 in a
   single press; `secondary` never showed `Bind two`
   (`07-advance-skips-bound.json`; `OutputHelper.ts:414-425`).
4. **Two findings against the page** (both filed as audit `A-012`):
   - **A bound slide reaches an inactive output.** With `secondary` deactivated
     (name struck), clicking entry 3 put `Bind four` on **both** pages, so the
     bound branch does not consult `active` (`09-bound-slide-to-inactive-output.json`;
     `output.ts:151-155` against the active filter at `:699-714`). This answers the
     page's open question; its parenthetical had assumed the inactive output would
     be skipped.
   - **A stale binding falls back to the active outputs.** Clicking entry 4
     (bound to the nonexistent `ghost-output`) put `Bind five` on **both** pages:
     `resolveOutputIds` returns an empty list and `setOutput` falls back to
     `getActiveOutputs(...)` (`11-stale-binding.json`; `output.ts:152-153`). The
     page said it "sends nothing".

   Step 4 also shows a stored **name** as binding identity: the list mixed the id
   `primary` with the name `Secondary`, and both outputs received the slide.

**Boundary this run does not cover.** The binding menus (`bind_to` / `bind_item`;
the fields were seeded), textbox bindings through the UI, bindings on a stage
output, a third output, and the project-moved migration beyond the stale-id case.

## <a id="outmultiple"></a>`out.multiple` — several outputs at once

- Every output is a normal `outputs` entry; there is no fixed count. Adding is
  done from the Outputs settings tab, which creates the entry disabled, applies
  the chosen type, then enables it (`OutputsTabs.svelte:89-152`).
- Outputs are sorted by name, with stage outputs after normal ones
  (`OutputsTabs.svelte:41`; `output.ts:123-124`). The list order also decides
  window stacking: offscreen outputs are created first, then displayed ones
  (`OutputVisibility.ts:14-22`).
- Each output can have a colour, used for the preview border and title
  underline (`MultiOutputs.svelte:258`; `OutputPreviewLabel.svelte:50`).
  Default colour is the theme secondary or `#F0008C`
  (`output.ts:1138-1145,1155`).
- Enabling/disabling one output does not affect the others; disabling destroys
  its window (`Outputs.svelte:54-73`). `observed` (2026-11-12): disabling
  `Secondary` removed its page and OS window and left `Primary` and the stage
  output untouched; re-enabling recreated them (see Observed).
- **A command affects:** the slide's bound outputs if it has bindings, otherwise
  all *active normal* outputs (`output.ts:151-155`; `getActiveOutputs(..., true,
  false, true)` at `:699-714`). Advance and clear use
  `getAllActiveOutputIds()` (`helpers/OutputHelper.ts:20-25`; `clear.ts:87,145`).
  Stage outputs are excluded from all of these (`output.ts:648-653,699-703`).
  `observed` (2026-11-12): start and advance fan out to all *active normal*
  outputs and skip both inactive normal outputs and the stage output (see
  Observed). The bound-output branch (`out.multiple.specific`) is `observed` from
  the `nav-output-bindings` run (a bound slide reaches only its bound outputs,
  and the bound set overrides `active`); the binding *menus* stay `code`.
- `doc` says "as many outputs as you would like" (`source/docs/outputs.md:12`).
  No cap was found in the frontend, but absence of a cap is not proof of none;
  it is recorded as `doc`.

## <a id="outmultipleselect"></a>`out.multiple.select` — choosing the target

- With more than one enabled output, each tile has a title bar. A plain click
  toggles that output's `active` state; Ctrl/Cmd-click makes it the only active
  output (`OutputPreviewLabel.svelte:13-38`). `observed` (2026-11-12): the title
  bar and the plain-click toggle; Ctrl/Cmd-click was not exercised (see
  Observed).
- The last active normal output cannot be deactivated; it snaps back and toasts
  (`OutputPreviewLabel.svelte:29-33`; `apiHelper.ts:353-357`). `observed`
  (2026-11-12): the tile snapped back to `active` and the toast read "You have
  to have at least one active output!" (see Observed).
- Right-clicking the **title bar** gives Toggle output, Move to front, Hide from
  preview (`contextMenus.ts:260`; `menuClick.ts:877-898`). Hide from preview only
  hides the tile in the main window, not the window itself
  (`MultiOutputs.svelte:22-23`).
- Right-clicking the **preview picture** gives style editing, recording, live
  prepare and test pattern (`contextMenus.ts:259`).
- Everything that is "selected" is the set of outputs with `active:true`;
  `getActiveOutputs` filters on it (`output.ts:699-714`).

## <a id="outmultiplespecific"></a>`out.multiple.specific` — bindings

Two separate binding mechanisms, both labelled **Specific outputs** in the UI
(`public/lang/en.json:769`):

**Slide bindings.** `bindSlidesToOutput` adds or removes the output id in the
slide's `data.bindings` (`helpers/show.ts:435-453`; the menu itself was not
driven). When playing a bound slide, `setOutput` targets exactly the bound
outputs instead of the active set (`output.ts:151-155`). `observed` (2026-11-12):
with two active normal outputs, a slide bound `["primary"]` reached `primary` and
not `secondary`, and `secondary` stayed on its previous slide across two reads
(`06-click-bound-slide.json`). The bound set also overrides the per-output lock —
see Open questions. Advancing skips a slide that is bound to other outputs:
`slideCannotBeOutputted` returns true when `bindings` is non-empty and the
current output is not in it (`helpers/OutputHelper.ts:414-425`). `observed`
(2026-11-12): one Space carried the unbound output from entry 0 to entry 2 and it
never showed the slide bound to its sibling (`07-advance-skips-bound.json`).

**Textbox bindings.** `bind_item` toggles the output id in the item's `bindings`
(`menuClick.ts:1916-1968`; the menu itself was not driven). When an output style
is applied, items are filtered per output with `isOutputBound`
(`output.ts:1928-1964`, the filter at `:1958-1964`); a template's own
`bindings` also override the slide item's (`:1485-1489`). `observed` (2026-11-12)
for the filter: an item seeded with `bindings: ["primary"]` rendered only on
`primary`, while the unbound item on the same slide reached both pages
(`05-start.json`).

**Resolution rules.** `isOutputBound` treats an empty/absent list as "all
outputs", compares ids directly, and also accepts a *stored output name* by
resolving it to an id (`output.ts:74-95`; the id/name `resolveOutputIds` path at
`:85-88`). `observed` (2026-11-12) for the bound-target path: a binding list
seeded as `["primary","Secondary"]` — one id and one name — reached both outputs,
so the name resolved to the `secondary` id
(`09-bound-slide-to-inactive-output.json`). This matters after a project move:
bindings store a name as a fallback identity. The `isOutputBound` name branch,
which the advance skip uses, was not isolated by a step and stays `code`.

**Edge case (corrected 2026-11-12).** A binding list that names only outputs
which no longer exist does **not** make the slide send nothing: `resolveOutputIds`
returns an empty list, and `setOutput` then falls back to
`getActiveOutputs(...)` (`output.ts:152-153`). `observed`: a slide bound to
`["ghost-output"]` reached **both** active outputs (`11-stale-binding.json`). The
page previously said it "sends nothing"; audit `A-012`.

## <a id="outstage-window"></a>`out.stage-window` — stage as an output

- A stage output is an output whose entry has `stageOutput: <layout id>` instead
  of a `style` (`output.ts:1202-1229`; `src/types/Output.ts:10`).
- Its window is an ordinary output window, but the output page renders the stage
  layout rather than the slide (`MainOutput.svelte:143-144`). `observed`
  (2026-11-12): the stage output's page reported `stageArea:true` and rendered
  the layout, not a slide (see Observed).
- Its resolution is its window bounds, not a style aspect ratio
  (`helpers/output.ts:836`).
- Created from the Outputs tab: New output → Stage, then pick a layout
  (`OutputsTabs.svelte:100-121`; `Outputs.svelte:364-370`). Default colour is
  `#555555` (`output.ts:1212`).
- Stage outputs are always active and are excluded from the normal command fan-out
  (`OutputPreviewLabel.svelte:19-27`; `output.ts:699-703`). `observed`
  (2026-11-12): "always active" — its title-bar button offered no output lock
  (`buttonTitle:""`) and clicking it left it active (see Observed). The fan-out
  exclusion is still `code`: the run observed the stage mirroring its source
  output, not the exclusion mechanism itself.
- A stage layout's "Current output" item names which output it mirrors, defaulting
  to the first enabled output (`output.ts:1001-1016`; `doc` at
  `source/docs/stage.md:37`).

## Settings

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Enabled | `outputs[id].enabled` | first output `true` | Window exists |
| Active (selected) | `outputs[id].active` | `true` | Receives programme changes |
| Colour | `outputs[id].color` | theme secondary / `#F0008C` | Preview identity |
| Hide from preview | `outputs[id].hideFromPreview` | absent | Tile hidden in main window only |
| Stage layout | `outputs[id].stageOutput` | `""` | Render a stage layout instead of a style |
| Slide binding | `slide.data.bindings` | `[]` | Slide only on these outputs |
| Textbox binding | `item.bindings` | `[]` | Item only on these outputs |

## Code

- `src/frontend/components/helpers/output.ts:74-134,145-329,625-714,976-1016,1138-1229`
- `src/frontend/components/helpers/OutputHelper.ts:20-25,414-425`
- `src/frontend/components/helpers/show.ts:435-453`
- `src/frontend/components/context/menuClick.ts:877-898,1910-1968`
- `src/frontend/components/output/preview/OutputPreviewLabel.svelte:13-46`
- `src/frontend/components/settings/tabs/OutputsTabs.svelte:89-174`
- `src/frontend/MainOutput.svelte:135-147`

## Doc vs code

- `doc` says right-click an output preview "to show or hide individual windows"
  (`source/docs/outputs.md:20`). The preview's own context menu has no toggle;
  toggling the window is on the title bar, and "Hide from preview" affects only
  the tile (`contextMenus.ts:259-260`; `menuClick.ts:884-898`).
- `doc` says "when starting a show, or clearing layers, it will only change the
  selected output windows" (`source/docs/outputs.md:22`). Code matches for
  clears and advance, but a **bound slide** overrides the selection
  (`output.ts:151-155`), which the docs do not say.
- `doc` says specific outputs are set by right-clicking a slide or textbox
  (`source/docs/outputs.md:26`). Code's visible label is "Specific outputs"
  (`actions.bind_to`), the same string used for effects/scenes
  (`public/lang/en.json:690,769`), so all three menus read the same.

## Open questions

- Whether there is any practical output cap (GPU, capture pool, NDI) was not
  traced; only the absence of a frontend check is known.
- ~~How two outputs that are both bound to the same slide behave when one is
  locked is `unknown`~~ **Answered 2026-11-12.** The old parenthetical ("the
  locked one is not active, so `setOutput` skips it") was wrong: the bound branch
  never consults `active`, so a bound slide is written to an inactive (per-output
  locked) output like any other. `observed` in
  `09-bound-slide-to-inactive-output.json`; `output.ts:151-155` against the active
  filter at `:699-714`; audit `A-012`. The inactive output's page was read and did
  paint the bound slide, so the follow-on "may still hold the old slide" is also
  answered for this path.

## Changelog

- `2026-11-12` — relabelled the multi-output present/fan-out/select/disable path
  and the stage-window path `observed` from the `stage-multi-output` run; added
  the Observed section and the per-bullet `observed` annotations. No claim was
  corrected (the `code` claims were confirmed, not contradicted), so no audit
  entry. Bindings (`out.multiple.specific`), the layout editor and the stage web
  client remain `code`/`doc`.
- `2026-11-12` — relabelled the binding path `observed` from the
  `nav-output-bindings` run (bound target, advance skip, item filter, name
  identity), added its Observed section, and **corrected two claims**: a stale
  binding falls back to the active outputs rather than "sending nothing", and a
  bound slide reaches an inactive output because the bound branch ignores
  `active`. Audit `A-012`; the open question is answered. The binding menus,
  stage bindings and the project-moved migration stay `code`.
