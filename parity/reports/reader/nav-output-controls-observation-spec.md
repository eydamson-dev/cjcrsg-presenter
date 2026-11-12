# Observation specification — disabled slides, specific-output bindings, locks, layers (Tier 1, stage 1 Read)

Date: 2026-11-12
Reference: FreeShow `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (1.6.8-beta.3), checkout
`~/projects/reference/freeshow` (read-only).
Role: `reader`. This is a **pre-run specification**. No reference page is edited here
and nothing is relabelled; relabelling to `observed` happens in the session after the
run, with the evidence below cited. `parity/tools/observe_reference.mjs`,
`parity/fixtures/**`, `docs/contracts/` and product code are **not** edited by this
spec; the driver work belongs to `harness-engineer`.

Slice: the observable remainder of the navigation/output-control group.

| ID | Page | Current label of the parts in scope |
| --- | --- | --- |
| `show.slides.disabled` | `docs/freeshow-reference/show/presenting.md` | `code` (+ one `doc` contradiction already recorded) |
| `out.multiple.specific` | `docs/freeshow-reference/outputs/multiple-outputs.md` | `code` (page says "the bound-output branch … stays `code`") |
| `out.lock` | `docs/freeshow-reference/outputs/output-window.md` | `code`; only the global lock's Ctrl+L + Space + clear-button *disabling* path is `observed` (2026-11-11) |
| `out.layers` | `docs/freeshow-reference/outputs/output-window.md` | `code`; the five entries' order/disabled state is `observed` (2026-11-11), presence-with-content and compositing order are not |

The harness drives the reference through Playwright against the controller and the
hidden output page and reads **DOM/player state, not pixels** (§0). Two consequences
decide this slice:

- `out.transitions`, `out.transitions.priority` and the *appearance* half of
  `show.backgrounds` (ghost at 0.4) are **out**: FreeShow's slide/item transitions are
  Svelte JS transitions (`src/frontend/utils/transitions.ts` imports
  `fade/fly/scale/blur/spin` from `svelte/transition`; they write inline styles from
  requestAnimationFrame callbacks), so `document.getAnimations()` — the settle
  primitive at `parity/tools/observe_reference.mjs:1174-1207` — does not see them, and
  output `page.screenshot` times out on llvmpipe (previous run:
  `parity/reports/evidence/observe-outputs-2026-11-11-host/`, `Capture failed for
  output default: [UnknownVizError]`). Needed instead: a GPU-capable pixel capture, or
  a probe that samples `getComputedStyle(item)` / `element.style` across the
  transition window and records the samples.
- `out.layers` is scoped to the **order and presence of layer containers** in the
  output DOM. Visual blending (opacity, filters, z-index, "does the underlay really
  sit behind the slide on a projector") stays `code`.

---

## 0. How the reference is driven today (facts the scenario design relies on)

Read from `parity/tools/observe_reference.mjs` on 2026-11-12, not edited:

- Scenario shape: `SCENARIOS[id] = { description, seed: {…}, steps: [{ name, purpose,
  run, verify }] }` (`:3200-3398`). Seed flags in use: `targetShow`, `outputs:
  "stage" | "styles"`, `media`, `mediaFiles`, `styles` (`:524`, `:631-633`, `:536`).
  A new scenario with no new flag must not disturb the four committed seeds.
- `check(condition, message, detail)` throws `StepFailure` on the first failure and
  records `{ok, check, saw}` in `record.assertions` (`:142-157`); every step writes
  `NN-<slug>.json` plus its assertions, and `steps.json`/`run.json` roll up
  (`:1464-1509`, `:3559-3597`).
- `readController` (`:874-1031`) already returns: `lockTitles` (all
  `button[data-title]` containing `[Ctrl+L]`), `clear.entries` (Clear all / Restore
  output: title, disabled, `isActive`, text) and `clear.groups` (`layer`,
  `clearTitle`, `clearDisabled`, `disclosureDisabled`), `preview.tiles` (`id`, `name`,
  `titleBar`, `buttonTitle`, `active`, `struck`), `projectItems`,
  `activeProjectItems`, `toast`, and the media strip. It does **not** return the show
  view's slide cards.
- `readOutput` (`:1033-1117`) returns `text`, `lines`, `rootClass`, `outputId` (from
  `.zoomed[id]`), `stageArea`, `videos`, `images`, `contentBox`, `viewportBox`. It does
  **not** return the layer structure.
- Helpers that generalise: `outputById`, `tileById`, `tileLocator`,
  `readOutputSnapshot` (sorted by output id), `waitForOutputPages`,
  `presentOutputs(ctx, names)` (`:1838-2029`), `dismissOverlayPopups`,
  `clickInController`, `openOutputsSettings`, `selectOutputTab`.
- `stepPresent` hardcodes the single default output titled `Primary`; the multi-output
  path is `presentOutputs` + a `verify*` that hardcodes three ids
  (`:2031-2097`). Two-output scenarios need their own present/verify pair.
- `settleAll`/`settlePage` (`:1174-1228`) only waits on `document.getAnimations()` plus
  two rAFs. It therefore returns while a Svelte transition is still running and while
  `Output.svelte`'s own timers (`linesTimeout` 50 ms, `slideTimeout` at
  `src/frontend/components/output/Output.svelte:391-404`) and the overlay delay
  (`showActions.ts:462-470`, 200 ms) are pending. **Every step below polls for text or
  DOM state; none samples once after a fixed wait.**

**Recommended reading extension** (step-local helpers, so the four committed scenarios'
JSON stays byte-identical): `readShowSlides(page)` and `readLayerTree(page)`. Do not
grow `readController`/`readOutput` unless the harness-engineer prefers one record shape
for all runs — then the added fields must be additive only.

---

## 1. Scope table

"Observed" below always means: a step performs the operator action and records a
state that can only be true if the claim holds, with the artefact kept under
`parity/reports/evidence/observe-nav-output-controls-<date>-<env>/`.

### 1.1 `show.slides.disabled` — `show/presenting.md` §"Disabled slides" (page `:181-205`)

| In/out | Claim (quoted from the page) | Citation | What "observed" means in DOM/state terms |
| --- | --- | --- | --- |
| IN | "Disable is an entry in a slide's right-click menu" — **the flag's storage is what we need, not the menu** | `contextMenus.ts:383-384`; `menuClick.ts:1198-1233`; page `:183-190` | Seed only: `layouts[layout].slides[i].disabled = true`. The menu item itself is not driven (see OUT). The run proves the *seeded layout flag* is honoured, which is the same flag `menuClick` writes. |
| IN | "Sequential navigation skips disabled entries" | `OutputHelper.ts:414-425`; skip loops `:367` (next) and `:399` (previous); page `:193` | Two output texts separated by one Space: the output jumps from slide *n* to the entry after the disabled one, and never shows the disabled slide's text. Previous (`ArrowLeft`) mirrors it. |
| IN | "start-show skips them" | `showActions.ts:571-574`; page `:159-160`, `:194` | With entry 0 disabled, one Space from a selected show puts entry 1's text on the output, and entry 0's text is never seen. |
| IN | "Clicking a disabled slide plays it, because the click path has no check" | `Slides.svelte:96-160`, `:143-144`; page `:201-205` | Clicking the *card* of a disabled entry puts its text on the output. The card keeps `class="disabled"` and the output text changes to the disabled slide's own text. |
| IN (controller DOM) | "disabled slides are dimmed to 0.2 in the show view alongside an 'Enable' button" | `Slide.svelte:287` (`class:disabled`), `:566-568` (`opacity: 0.2`); **the button is `Icons.svelte:112-119`, not `Slide.svelte`** | On the controller: `#showArea .grid .slide` at the seeded indices carries `disabled`, `getComputedStyle(card).opacity === "0.2"`, and contains `button[data-title="<Enable>"]`. Non-disabled cards do not. |
| OUT | "In groups view, disabling a parent also disables all of its children" | `menuClick.ts:1204`, `:1218-1228`; page `:191-192` | Needs the right-click menu in groups view and a parent/child fixture. A run would seed a parent + child, drive the menu, and read both layout flags. Not this slice (menu surface + group mode are separate observations). |
| OUT | "Slide timers skip them too" | `tick.ts:24-51`; page `:196-200` | Needs a slide timer and a real wait; the skip loop is the same `getNextSlide` the advance step already proves, so the incremental evidence is small and the timing is flaky. Timers are their own area. |
| OUT | "Direct index jumps also bypass the check: number-key navigation and slide/group shortcuts call `playSlideAtIndex`" | `Preview.svelte:165-172`; page `:203-205` | The exact key binding was not traced in this pass and it is a controller-wide shortcut surface. Establish it with a run that presses the documented key and reads the output; not here. |
| OUT | "The same slide can therefore be enabled in one arrangement and disabled in another" | page `:189-190` | Multi-layout fixture (two layouts, one slide disabled in one). Cheap in principle, but it is a file-model claim rather than an operator behaviour; keep `code` until an arrangements slice. |

### 1.2 `out.multiple.specific` — `outputs/multiple-outputs.md` §"bindings" (page `:127-151`)

| In/out | Claim (quoted) | Citation | What "observed" means |
| --- | --- | --- | --- |
| IN | "When playing a bound slide, `setOutput` targets exactly the bound outputs instead of the active set" | `output.ts:151-155`; page `:132-137` | With two active normal outputs, clicking a slide bound to `primary` changes `primary`'s page text and leaves `secondary`'s page text exactly as it was. |
| IN | "Advancing skips a slide that is bound to other outputs: `slideCannotBeOutputted` returns true when `bindings` is non-empty and the current output is not in it" | `OutputHelper.ts:414-425`; page `:135-137` | One Space from slide *n*: the non-bound output lands on the entry **after** the bound one (its text), not on the bound slide, and the previous step's record shows it never held the bound text. |
| IN | "`isOutputBound` treats an empty/absent list as 'all outputs'" | `output.ts:91-95`; page `:144-147` | The unbound slides in the same run reach **both** pages, so the bound slides' non-arrival is attributable to the binding, not to a one-output seed. |
| IN | "`bind_item` toggles the output id in the item's `bindings` … items are filtered per output with `isOutputBound`" | `menuClick.ts:1916-1968` (menu, not driven); filter `output.ts:1958-1964`; page `:139-142` | Seed one item with `bindings: ["primary"]` on a slide that also has an unbound item. `primary`'s page shows both texts; `secondary`'s page shows only the unbound one. This observes the *filter*, not the menu item. |
| IN (optional) | "`isOutputBound` … also accepts a stored output name by resolving it to an id" | `output.ts:74-95`, `:91-95`; page `:144-147` | A binding written as the output's **name** (`"Secondary"`) binds exactly like its id. Fold into the same fixture by binding one slide to `["primary", "Secondary"]`. |
| IN — contradiction test | "A binding list that names outputs which no longer exist makes the slide unbindable from every output: `setOutput` resolves to an empty target list and sends nothing" | page `:149-151`; the code is `output.ts:151-155` + `:85-88` | **Source says the opposite for the click path**: `resolvedBindings.length ? resolvedBindings : getActiveOutputs(...)` (`:152-153`) falls back to *all active outputs* when nothing resolves. Prediction: clicking a slide bound to a nonexistent id puts it on **both** pages. See §4 and A-candidate 3. |
| IN — open question | "How two outputs that are both bound to the same slide behave when one is locked is `unknown` (the locked one is not active, so `setOutput` skips it …)" | `multiple-outputs.md:217-219`; `output.ts:151-155` (bound branch) vs `:699-714` (active filter) | **Source prediction: the locked one is *not* skipped on the bound branch** — the bound branch never consults `active`, and the write loop `output.ts:247-318` has no active check. Prediction: with `secondary.active === false`, clicking a slide bound to `["primary", "secondary"]` changes **both** pages. If only `primary` changes, the page's parenthetical is right and the open question resolves the other way. Either way it is a finding (§4). |

Boundary this slice does not cover: the **UI** that writes bindings (slide right-click "Specific
outputs", `bind_item`) stays `code` — we seed the field the menu writes; the effect is what is
observed. Also out: bindings on **stage** outputs (`output.ts:699-703` excludes stage from
fan-out; a stage output ignores `active`), and the "project moved" migration path beyond the
stale-id case.

### 1.3 `out.lock` — `outputs/output-window.md` §`out.lock` (page `:283-302`)

| In/out | Claim (quoted) | Citation | What "observed" means |
| --- | --- | --- | --- |
| IN | "Blocks slide advance" | `OutputHelper.ts:30` | Already `observed` 2026-11-11 (Space). Re-recorded incidentally by the new scenario's start step; not the target. |
| IN (new) | "Blocks … [the click path]" — the page's global row says "Blocks slide advance (`helpers/OutputHelper.ts:30`)", and `Slides.svelte:98` guards the click too | `Slides.svelte:96-98`; page `:287` | Locked: clicking a *different* slide card leaves both output pages' text unchanged and `lockTitle` stays `Unlock output [Ctrl+L]`. Unlocked: the same click changes them. |
| IN (new) | "Blocks … every per-layer clear button/F-key" | `ClearButtons.svelte:45-47`; `shortcuts.ts:359-363` (F1), `:378-383` (F3), `:384-386` (F4); page `:287` | Locked, with an overlay on the output, press **F3**: the overlay text is still on both pages. **Do not use F2 for this test**: `shortcuts.ts:367` also returns when something is selected, so F2 would fail for two reasons and prove neither. F3's guard is the lock alone (`:379`). |
| IN (new) | "Not stopped by the global lock, as far as was traced: … toggling a per-output lock" | `OutputPreviewLabel.svelte:13-38` (no `outLocked` guard); page `:291-293` | With the global lock on, a plain click on `Primary`'s tile title bar flips that tile to `active:false`, the name is struck through, and `lockTitle` is *still* `Unlock output [Ctrl+L]`. A second click restores it. |
| IN (new) | Per-output lock "Removes that output from `getActiveOutputs`, so `setOutput`, advance and clear skip it" | `output.ts:699-714`, `:153`, `OutputHelper.ts:21`; `clear.ts:13-34`, `:39`, `:62`; page `:288` | Advance was `observed` 2026-11-12 (`stage-multi-output`). **Clear is not**: deactivate `primary`, click the controller's `Clear all` button, and `secondary` empties while `primary` keeps its slide text. Use the button (`clearAll(true)`), not Escape: `clear.ts:15` adds a selection/popup/edit guard that forces the two-press quirk the 2026-11-11 run recorded. |
| OUT | Bounds lock "Stops moving, resizing and auto-positioning the window" | `OutputVisibility.ts:83`; `OutputLifecycle.ts:1582,1590,1601-1610`; `OutputBounds.ts:83`; page `:289` | **Not observable with this harness.** It acts only on the OS window frame (drag, resize, re-apply on display change), and on one display the reference creates the output window *hidden* (A-005/A-007). Needed: a second display, a real window manager, a scripted drag (`workspace_drag` on a mapped window) and a display-change event. Out. |
| OUT | "Blocks … media toggle (`shortcuts.ts:492`), scenes (`output.ts:514`), audio start/playlist/mic …, remote commands …, and the guarded API actions" | page `:287` | Own areas (`media.controls` covered the media buttons; scenes/audio/remote/API are Tier 2/3 or separate). |
| OUT | "The last active normal output cannot be locked" | `OutputPreviewLabel.svelte:29-33` | Already `observed` 2026-11-12 (`last_active_guard`). The new scenario must not step on it: keep one normal output active at every point. |

### 1.4 `out.layers` — `outputs/output-window.md` §`out.layers` (page `:171-215`)

Scope: **order and presence of layer containers**. The clear buttons' behaviour and the
Restore path are already `observed` (2026-11-11) and only re-recorded.

| In/out | Claim (quoted) | Citation | What "observed" means |
| --- | --- | --- | --- |
| IN | "then **Background**, **Slide**, **Overlays**, **Audio**, **Next timer**" (controller order) | `ClearButtons.svelte:141-213`; page `:173-177` | Already `observed` as *order*. This run records it again with content in three layers, so each `clear.groups[].clearDisabled` can be read as a presence signal. |
| IN | "A layer button is red while the layer has content and dark when the layer is clear" | `ClearButtons.svelte:144-205` (the buttons carry `red` **unconditionally**; content is `disabled={$outLocked \|\| xCleared}`), disabled styling `:246-248` | **Restate the claim before relabelling**: the DOM observable is *enabled + titled* vs *disabled + untitled* per layer, not a colour. Background/Slide/Overlays `clearDisabled === false` while their layer has content; Audio/Next timer `true` with no audio/timer. The rendered colour is CSS and stays `code`. |
| IN | Compositing order of the output page's containers: style background → background → effects-under → **underlays** → **slide** → metadata → effects-over → **overlays** → attribution → draw | `Output.svelte:408-485` (order), `:420` (background gate), `:387` (slide gate), `:359`/`:168` (overlays gate), `:434-438` vs `:465-467` (underlay above/below the slide), `Zoomed.svelte:155-189` (`.zoomed > .slide > .zoom`, the children host) | On each output page, the document order of content markers inside `.zoomed .slide`: background media element, then the `placeUnderSlide` overlay's text, then the slide's text, then the normal overlay's text. Record the whole child tree, assert only the relative order of the four known markers. |
| IN | "Presence": a layer is rendered only when the style's `layers` includes it | `Output.svelte:77-83` (`defaultLayers`), `:359`, `:387`, `:420`; `defaultLayers` at `output.ts:1854`; absence already `observed` for background by `styles-multi-output` | With no `layers` override all three are present and each marker exists; the *absence* half was observed in the styles run (`style-nobg`). The new run supplies the positive half (all three present, with content). |
| OUT | The five layer buttons' **rendered colour** ("red"/"dark") | `ClearButtons.svelte:246-248` | Colour is a CSS/theme question; without a pixel capture the honest observable is the enabled/disabled + title state that produces it. |
| OUT | "Audio" and "Next timer" as *output-page* layers | — | They have no output-page DOM: audio is player state and timers live in stores. Only the controller's buttons can speak for them (already observed). |
| OUT | "**Scene** is a separate layer with its own clear button" | `ClearButtons.svelte:115-124`; `clear.ts:13-34`; page `:201-202` | No scene in the fixture; scenes are their own area. |
| OUT | Visual stacking/blending on a mapped window (z-index, opacity, filters) | — | Needs pixels (§0). DOM order is the proxy; the claim stays `code` for appearance. |

---

## 2. Seed requirements

Follow the established pattern: **build fixtures in memory** (like `createStylesFixture`,
`observe_reference.mjs:441-470`) or transform a *scratch copy* (`transformMediaFixture`,
`:366-431`). Nothing under `parity/fixtures/**` is edited.

### 2.1 New fixtures (in memory, one per scenario)

Every slide is its own group (`group: "."`, as in `createStylesFixture`) so
`fixShowIssues` keeps it (`converters/importHelpers.ts:268-290`); a `group: null` slide
that no parent lists is deleted on load and the show silently loses slides.

1. **`Parity Nav`** — 5 flat slides, unique text so an index can be checked by text:

   | index | text | layout data |
   | --- | --- | --- |
   | 0 | `Nav one` | `disabled: true` |
   | 1 | `Nav two` | — |
   | 2 | `Nav three` | — |
   | 3 | `Nav four` | `disabled: true` |
   | 4 | `Nav five` | — |

   Entry 0 tests start-show; entry 3 tests the next/previous skip and the click.

2. **`Parity Bindings`** — 5 flat slides, two normal outputs:

   | index | items | layout data |
   | --- | --- | --- |
   | 0 | `Bind one`; `Bind one, primary only` (`bindings: ["primary"]` on the **item**) | — |
   | 1 | `Bind two` | `bindings: ["primary"]` |
   | 2 | `Bind three` | — |
   | 3 | `Bind four` | `bindings: ["primary", "Secondary"]` (id + name, exercises name resolution) |
   | 4 | `Bind five` | `bindings: ["ghost-output"]` (stale id) |

3. **`Parity Locks`** — 2 flat slides, 2 normal outputs:

   * slide 0: one text item `Layer one`; `background: "l-bg"`; `overlays: ["ov-under", "ov-over"]`; media `{ "l-bg": { path: <generated logo>, type: "image" } }`.
   * slide 1: one text item `Layer two`; no background, no overlays.

   Overlay store (`overlays.json`, portable, store cwd — `src/electron/data/store.ts:39`):

   ```json
   { "ov-under": { "name": "Underlay", "color": null, "category": null, "items": [<textItem "Underlay text">], "placeUnderSlide": true },
     "ov-over":  { "name": "Overlay",  "color": null, "category": null, "items": [<textItem "Overlay text">] } }
   ```

   Shape from `src/types/Show.ts:532-546` (`placeUnderSlide` at `:544`); `<textItem …>` is the
   driver's existing `textItem(lines)` helper (`observe_reference.mjs:433-439`). A slide carries its
   overlays via the **layout entry**: `showActions.ts:461-470` sends
   `setOutput("overlays", data.overlays, …, add = true)` 200 ms after the slide is played, and
   re-sends the overlay store first (`:466`). This is better than seeding
   `outputs[id].out.overlays` at startup, which depends on the order of the
   `sendInitialOutputData` messages (`listeners.ts:465-524`: stores first, `OUTPUTS` after
   100 ms) and on `Output.svelte`'s `clonedOverlays` cache being refreshed.

### 2.2 Seed state

- **Outputs.** Do **not** reuse `seedMultiOutput` (`:301-358`): it adds a stage output, which
  changes fan-out and adds three pages to every assertion. Add a `seedTwoOutputs()` that
  returns `primary` + `secondary` in the same shape (`enabled`, `active`, `name`, `color`,
  `bounds: {x:0,y:0,width:1920,height:1080}`, `screen: null`, `style: "default"`, `show: {}`),
  and a plan flag that selects it. Keep the existing `stage` and `styles` seeds untouched so
  the committed runs stay reproducible.
- **Scenario `nav-disabled-slides`** uses the **default single output** (no `outputs` key in
  `settings.json`), exactly like `outputs-basic`, so `stepPresent` (`:1612-1639`) works
  unchanged and the window title stays `Primary`.
- **Media for the layers fixture.** Reuse `generateMedia` through the existing `mediaFiles`
  plan flag (`:536-540`) and take the logo only (`MEDIA_LOGO`, `:76`), as
  `createStylesFixture` does (`:456`).
- **Project.** Add each new show id to `projects.projects.parity.shows` (`:611-621`);
  `seedProfile` already writes `Shows/<name>.show` for every fixture (`:580-589`).
- **`overlays.json`.** New file written beside `settings.json`/`themes.json`/`templates.json`
  (`:643-652`), which the current driver does not do. It is the only new store file this
  slice needs.

### 2.3 Seed read-back (the driver already proves its seeds landed; keep doing it)

Before the run, read back from disk and fail loudly if absent — the pattern at
`:657-746`:

- each fixture's 5 (or 2) layout entries exist and the seeded `disabled`/`bindings`/
  `overlays`/`background` are on the expected indices;
- `overlays.json` contains both overlay ids with the expected `placeUnderSlide`;
- the two seeded outputs exist with `active: true`, `enabled: true`, `style: "default"`;
- the media file for `l-bg` exists (`existsSync`) — a missing image would silently turn the
  background layer into "nothing to see".

Record in `seed.json`: fixture names/ids, per-entry `{index, text, disabled, bindings,
background, overlays}`, the overlay records, the output records, and the generated media
paths. A reader relabelling later needs all of it.

### 2.4 Existing fixtures: what can be reused

- `parity-three-slides.show` is usable **only** through a scratch transform: it has three
  slides plus the two group repairs `repairShowGroups` adds (`:267-292`), producing five
  layout entries whose indices depend on that repair. Adds text `Verse one…`, which collides
  with the committed `outputs-basic` expectations. **Recommendation: do not reuse it** for
  these scenarios; the in-memory fixtures make the indices and text explicit and let the
  assertions name the exact slide.
- `parity-with-media.show` / `parity-styles.show` are irrelevant here except for the
  generated media files and the `createStylesFixture` pattern to copy.

---

## 3. Scenario design

Three scenarios, not one: each needs a different output count and a different fixture, and
a failure in one should not lose the other three features' evidence. Order them cheapest
first (`nav-disabled-slides` has one page to read).

Shared helpers to add: `readShowSlides(page)`, `readLayerTree(page)`, `readOutputById(ctx,
id)`, `presentOutputs(ctx, [PRIMARY, SECONDARY])` (exists), `verifyPresentTwoOutputs`
(one page per seeded output, each page names its own id, two distinct OS windows), and a
`clickSlideCard(ctx, index)` that clicks the **card body**, not the icon strip (§5.2).

### A. `nav-disabled-slides` — one output, fixture `Parity Nav`

| # | Step | Action | Assertion (what it proves) |
| --- | --- | --- | --- |
| 1 | `ready` | — | controller up, project listed (existing helper) |
| 2 | `open_project` | click the project | existing `verifyOpenProject` |
| 3 | `open_show` | click `Parity Nav` | `activeProjectItems` contains the name |
| 4 | `present` | one Present click | existing `verifyPresent` (page exists, real window, hidden allowed) |
| 5 | `disabled_markers` | read, no action | `#showArea .grid .slide` count = 5; exactly indices 0 and 3 have `disabled`, `opacity === "0.2"`, and a `button` whose `data-title` is the localised "Enable"; the other three do not. **Proves the preview marker claim.** |
| 6 | `start_skips_disabled` | Space | output text = `Nav two`; never `Nav one`. **Proves start-show skip.** |
| 7 | `next` | Space | `Nav three` |
| 8 | `next_skips_disabled` | Space | `Nav five`; not `Nav four`. **Proves the next skip** (and that the skip is a loop, not one step). |
| 9 | `previous_skips_disabled` | ArrowLeft | `Nav three`; not `Nav four`. **Proves the previous skip** (`OutputHelper.ts:399`). |
| 10 | `click_disabled_plays` | click card 3 | output text = `Nav four`. **Proves the click bypasses the disabled check.** |
| 11 | `click_first_disabled_plays` | click card 0 | output text = `Nav one` (a second disabled entry, at index 0). |
| 12 | `advance_from_disabled` | Space | `Nav two` (from a disabled slide forward navigation behaves normally) — optional, but it closes the loop: playing a disabled slide does not wedge navigation. |

Boundary covered by 8+9 together: a **run** of one disabled entry between two normal ones, in
both directions, so "skip" cannot be confused with "end of show".

### B. `nav-output-bindings` — two normal outputs, fixture `Parity Bindings`

| # | Step | Action | Assertion |
| --- | --- | --- | --- |
| 1 | `ready` / `open_project` / `open_show` | existing | |
| 2 | `present_outputs` | one Present click | two pages, `primary` and `secondary`, two OS windows titled `Primary`/`Secondary`, both pages name their own id |
| 3 | `start` | Space | **both** pages show `Bind one`; **`primary` also shows `Bind one, primary only`, `secondary` does not.** Proves the textbox/item filter (`output.ts:1958-1964`) and that unbound slides fan out. |
| 4 | `click_bound_slide` | click card 1 (`Bind two`, bound `["primary"]`) | `primary` = `Bind two`; `secondary` still `Bind one` and not `Bind two`. **Proves the bound-target `setOutput`.** |
| 5 | `advance_skips_bound` | Space | `primary` = `Bind three` (advanced from index 1) and `secondary` = `Bind three` (jumped index 0 → 2). **Proves `slideCannotBeOutputted`'s binding branch**: one advance, no stop on `Bind two`. |
| 6 | `deactivate_secondary` | click `Secondary`'s tile title bar | tile `active:false`, struck; `primary` still active (existing helper) |
| 7 | `bound_slide_to_locked_output` | click card 3 (`Bind four`, bound `["primary","Secondary"]`) | Record both texts; **assert both pages = `Bind four`** (prediction: the bound branch ignores `active` — `output.ts:151-155` vs `:699-714`). If `secondary` does not change, the assertion fails **and that failure is the finding**: record it, do not re-run (§4). |
| 8 | `reselect_secondary` | click `Secondary`'s title bar | both tiles active |
| 9 | `stale_binding` | click card 4 (`Bind five`, bound `["ghost-output"]`) | Record both texts; **assert both pages = `Bind five`** (prediction: `resolveOutputIds` empties, `getActiveOutputs` is the fallback, `output.ts:152-153`). If nothing changes, the page's "sends nothing" is right — again a finding, not a harness bug. |

Steps 7 and 9 are the two places where the code reading contradicts the page. They are
deliberately last so that a failed prediction still leaves steps 3–6 and the whole of A and C
as evidence. The reader must be told in the run record which of the two outcomes happened.

### C. `lock-and-layers` — two normal outputs, fixture `Parity Locks`

| # | Step | Action | Assertion |
| --- | --- | --- | --- |
| 1 | `ready` / `open_project` / `open_show` / `present_outputs` | as B | two pages |
| 2 | `start` | Space | both pages = `Layer one`; then **poll** until `Overlay text` *and* `Underlay text` are present (the overlay `setOutput` is 200 ms after the slide, `showActions.ts:464-469`) |
| 3 | `layer_order` | read, no action | On each page, `readLayerTree` shows, in document order: the background marker (`img.media` with the logo's src), `Underlay text`, `Layer one`, `Overlay text`. **Proves presence + compositing order**, including the underlay slot below the slide (`Output.svelte:434-438` vs `:465-467`). Record the full child tree, not just the order. |
| 4 | `layer_buttons` | read, no action | controller groups `Background`, `Slide`, `Overlays`, `Audio`, `Next slide timer` in that order; `clearDisabled === false` for Background/Slide/Overlays, `true` for Audio and Next timer; the first three are titled (`clear.background [F1]`, `clear.slide  [F2]`, `clear.overlays [F3]`). **Proves per-layer presence from the controller side** and extends the 2026-11-11 observation (where only Slide was enabled). |
| 5 | `lock_global` | Ctrl+L | `lockTitles.length === 1`, title = `Unlock output [Ctrl+L]` (existing `verifyLock`) |
| 6 | `lock_blocks_click` | click card 1 (`Layer two`) | both pages still `Layer one`; lock title unchanged. **Proves the click guard** (`Slides.svelte:98`). |
| 7 | `lock_blocks_f3` | press F3 | `Overlay text` still on both pages. **Proves the per-layer F-key guard** (`shortcuts.ts:379`). |
| 8 | `lock_allows_output_lock` | click `Primary`'s tile title bar | `primary` tile `active:false`, struck; `secondary` still active; **`lockTitle` is still `Unlock output [Ctrl+L]`**. Proves the global lock does not guard the per-output lock (`OutputPreviewLabel.svelte:13-38`). |
| 9 | `unlock` | Ctrl+L | title back to `Lock output [Ctrl+L]` |
| 10 | `clear_skips_inactive` | click `Clear all` — the `.clearAll` button, or the entry whose `title` starts with `Clear all` in `clear.entries` | `secondary`'s page has no text/background/overlay markers; `primary`'s page still shows `Layer one` with its background and both overlays. **Proves clear is per active output** (`clear.ts:13-34`, `getAllActiveOutputIds` at `:39`, `:62`) — the part of the per-output row that was not observed. |
| 11 | `reselect_and_play` (optional) | click `Primary`'s tile, then click card 0 | both pages show `Layer one` again — the fan-out is restored, so step 10's result is attributable to `active`, not to a wedged output. |

Note on step 10: `Clear all` is *disabled* while locked (`ClearButtons.svelte:133`), so the click
must come after step 9. Do **not** use Escape: `clear.ts:15` adds a selection/popup/edit guard
that produced the two-press quirk in the 2026-11-11 run.

---

## 4. Open questions the run settles, and the ones it cannot

**Settles (and must be written back with the run's record):**

1. `multiple-outputs.md:217-219` — "How two outputs that are both bound to the same slide behave
   when one is locked": scenario B step 7. Both possible outcomes are informative; the *page's
   parenthetical* is the thing under test.
2. `multiple-outputs.md:149-151` — the stale-binding edge case ("sends nothing"). Scenario B
   step 9. Source predicts the opposite; see A-candidate 3 below.
3. `multiple-outputs.md:144-147` — name-as-identity: scenario B step 3/7 binds `"Secondary"` by
   name; the binding takes effect or it does not.
4. `output-window.md:460-461` — "Which exact actions the global lock does *not* guard": one more
   entry (the per-output lock toggle) from scenario C step 8. The list stays open.
5. `output-window.md:204-215` — the boundary "no background, overlay, audio or timer content
   existed": scenario C supplies background + two overlays, so the per-layer *presence* state and
   the underlay slot are settled.
6. `presenting.md:339-342` (doc vs code) — the doc's "Keyboard navigation & slide timers will
   skip disabled slides … you can still click it": the click half is settled by A10/A11 (and
   still nothing about timers).

**Cannot settle (and must stay `code`/`unknown` after the run):**

- Bounds lock (`out.window.position` / `out.lock` row 3): needs a mapped window on a real
  display and a scripted drag/resize plus a display change.
- The transition *appearance* (`out.transitions`, `out.transitions.priority`) and the ghost's
  0.4 opacity (`show.backgrounds`): need pixels or a style-sampling probe (§0). Note for the
  orchestrator: the ghost's *presence* (`.background.ghost` in the show view,
  `Slide.svelte:320`, computed `opacity`) and the output's *inherited background identity*
  (`<img class="media">` src on the output page) are DOM-readable — so `show.backgrounds`
  can be split into an observable "which background is inherited" half and an unobservable
  "how it looks" half in a later slice. This spec does not do that.
- Slide timers skipping disabled entries, group-view parent→child disable, number-key jumps,
  and the *menus* that write `disabled`/`bindings`: not driven here.
- Whether a **mapped** output shows the same frame as the hidden page (existing open question).

**Page corrections already visible from the source (no run needed; file them when the pages are
next edited, with audit IDs `A-010` onward):**

1. `presenting.md:29-30` cites `Slide.svelte:287, 562-568` for both the dimming **and** the
   "Enable" button. The button is `src/frontend/components/slide/Icons.svelte:112-119`
   (`removeLayout("disabled")`); `Slide.svelte:287,566-568` only carries the class and the
   opacity. Label stays `code`.
2. `output-window.md:181-182` says "A layer button is **red while the layer has content** and
   dark when the layer is clear (`ClearButtons.svelte:144-205`, disabled styling at
   `:246-248`)": the buttons carry `red` unconditionally and content is signalled by
   `disabled={$outLocked || xCleared}` plus an empty title
   (`ClearButtons.svelte:144,159,175,188,202`). Correct the wording; the label stays `code`.
3. `multiple-outputs.md:149-151` — "`setOutput` resolves to an empty target list and **sends
   nothing**": `output.ts:152-153` falls back to `getActiveOutputs(...)` when nothing resolves.
   Confirm with scenario B step 9 before rewriting, then correct with the run's citation.

---

## 5. Risks

1. **The "Enable" button is localised.** `Icons.svelte:115` uses
   `translateText("actions.enable")`; the title is English only because the run's locale is
   `en`. Assert on `classList.contains("disabled")` + computed `opacity: 0.2` as the primary
   signal and treat the button as secondary evidence; record the locale (`run.json` already
   does, `:3590`).
2. **Clicking the Enable button probably also clicks the slide.** `inputs/Button.svelte:15` renders
   `<button … on:click>` and does not stop propagation, so a click on the icon strip would run
   `removeLayout("disabled")` **and** bubble to `Slides.svelte`'s `on:click`, enabling *and*
   playing the slide (code reading, not observed). Do not test that here:
   `clickSlideCard` must click the card body (e.g.
   `position: { x: box.width / 2, y: box.height * 0.75 }`), never the icon strip at the top.
   Also: the icons only render when `icons && !altKeyPressed && viewMode !== "simple" &&
   !$focusMode` (`Slide.svelte:282`), so the scenario must stay in grid mode, not Focus mode,
   and must not hold Alt.
3. **Card selection.** `#showArea .grid .slide` is the element with `on:click`
   (`Slide.svelte:287`); the wrapper `div.main` has the width. If the default view mode is not
   grid (`slidesOptions` default `{ columns: 4, mode: "grid" }`, `stores.ts:246`) the class is
   still `slide` but the container differs; assert the count (5 / 2) first and fail loudly if
   the mode changed.
4. **Disabled flag placement.** It goes on the **layout entry**
   (`layouts[layout].slides[i].disabled`), which `getLayoutRef` exposes as `ref[i].data`
   (`helpers/shows.ts:426`: `data: layoutSlide`). Putting it on `show.slides[id]` would be
   read by nothing. The same is true of `bindings` (`:412`) and `overlays` (`:385`) — all three
   are layout-entry fields on `types/Show.ts:370-415`.
5. **Child vs parent.** Our fixtures make every slide a parent entry (`group: "."`), so the
   disabled/binding flag is the *parent* branch of `slideCannotBeOutputted` /
   `menuClick`. A child slide's flag lives at
   `layouts[layout].slides[parent].children[childId].disabled` (`menuClick.ts:1224-1228`;
   `shows.ts:456`). Do not mix the two in one fixture: the indices differ
   (`getLayoutRef` expands children before the next entry, `shows.ts:427-458`).
6. **Layer markers are text/src based, not class based.** Both `Background` components render
   `div.media` (`Background.svelte:152`), the overlay wrapper is an unclassed `div`
   (`Overlays.svelte:66-71`), and slide items and overlay items are both `div.item`
   (`Textbox.svelte:814-815`). The only stable discriminators are the unique strings and the
   media `src`. Assert the **relative order of known markers** and keep the full child tree in
   the record, so an unexpected extra child (metadata items, effects) is visible instead of
   turning the order assertion into a mystery failure. Our fixture has no style background and
   the default style has no metadata items, so at most one `div.media` should appear — if two
   do, the record explains it.
7. **Svelte transitions are invisible to `settlePage`.** Text may still be fading (old and new
   item both mounted) when a step reads. Every assertion that "the output changed" must poll
   for the expected text and every assertion that "the output did *not* change" must compare
   snapshots taken after a `waitFor` that the *settled* text is stable across two reads
   ≥ 300 ms apart. Otherwise "locked click did nothing" can pass while a transition is merely
   mid-flight.
8. **Overlay arrival.** If `layoutSlide.overlays` does not put the overlay out (ordering,
   `clonedOverlays` cache), the fallback is to seed `outputs[id].out.overlays` and read after
   `present`. Record which path was used; if neither works, the overlay half of `out.layers`
   is not observed and stays `code` — say so in the run record rather than dropping the
   assertion.
9. **One display, hidden output windows.** As in every prior run: a page existing is not a
   window on screen (A-005/A-007). Assert on page DOM; the output screenshots will time out
   on llvmpipe and that is **not** a step failure (`takeScreenshots` records the errors,
   `:1464-1509`). Do not add a pixel assertion anywhere in these scenarios.
10. **Per-output tile toggling.** `toggleOutput` returns early when `outs.length <= 1`
    (`OutputPreviewLabel.svelte:14`) and the last-active guard re-activates the tile
    (`:29-33`). Keep exactly two normal outputs and keep one active at all times; never test
    the guard here (it is already observed).
11. **Two-output identity.** Pages are matched by `.zoomed[id]` (`readOutput`, `:1071-1074`) and
    `readOutputSnapshot` sorts by id. Assert by `id`, never by page order or window order.
12. **`out.layers` is a DOM-order claim.** Document order of absolutely-positioned siblings is
    the paint order only because nothing sets `z-index` on the layer roots; that reasoning is
    `code`, not `observed`. The page must keep appearance claims `code`.

---

## 6. What the next session should be able to write

After a clean run (or after recording the two contradiction outcomes in B7/B9):

- `presenting.md` §"Disabled slides": items 4 and 6 and the controller marker move to
  `observed`, with the run path; add the boundary that the *menu*, timers, group propagation and
  number-key jumps remain `code`.
- `multiple-outputs.md`: confidence line, §bindings (slide + item + name + stale), the open
  question, and a `Doc vs code`/audit entry if B7 or B9 contradicted the page.
- `output-window.md`: `out.lock` (click, F3, per-output toggle under global lock, clear skipping
  an inactive output) and `out.layers` (presence with content, underlay slot, DOM order) move to
  `observed`; the "red while content" wording is corrected; bounds lock and appearance stay
  `code`/`unknown`.
- `audit.md`: `A-010` for the `Icons.svelte` citation, `A-011` for the layer-button wording,
  `A-012` for the stale-binding claim **if** the run shows the fallback (the spec predicts it
  does; the run decides).
- `parity/features/*.yaml`: one entry per in-scope feature, `reference.commit:
  ff784eb388c7baef60d67e6d4e7c504f4322bca3`, `confidence` high for the observed parts and
  medium for anything resting on the seeded-in-memory fixtures, with the evidence paths.
