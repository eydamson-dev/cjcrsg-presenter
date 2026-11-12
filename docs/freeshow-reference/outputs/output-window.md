# Output window and output controls

- **IDs:** `out.window`, `out.layers`, `out.enable`, `out.preview`,
  `out.controls`, `out.lock`, `out.status`, `out.settings`,
  `out.window.position`, `out.recorder`
- **Area:** outputs
- **Online docs:** [Output](https://freeshow.app/docs/output)
- **Pinned code:** ff784eb388c7baef60d67e6d4e7c504f4322bca3
- **Confidence:** `code` overall; `observed` for the present/lock/advance/clear
  path measured on 2026-11-11 and for the lock scopes (click, F3, per-output
  toggle, clear skipping an inactive output) and the layer presence/order
  measured on 2026-11-12 (see Observed). Unobserved parts stay `code`.

## Screenshot

![The output page rendering the live slide: a 1920×1080 Playwright page
screenshot of the output window.](../screenshots/output-window.png)

Captured from the running reference (1.6.8-beta.3), 2026-11-09. This is a
screenshot of the output window's *page*, not a frame captured from a mapped
window; whether that window was on screen at capture time was not recorded. The
2026-11-11 runs show the page renders while the window is not mapped. See
`A-007`.


## Summary

Each output is a frameless, transparent, always-on-top window created hidden and
shown inactive; an "invisible" output is instead an offscreen surface that is
never shown and exists only to be captured (NDI, OMT, RTMP, recording). The
window is a view of `outputs[id].out`; the state lives in the main window.

On one display the output window may never be shown at all: a Present click
creates the output page and leaves the window hidden while the output still
renders, starts, locks, advances and clears (`observed`, 2026-11-11 — see
Observed). A page existing is not evidence that a window is on screen.

## Observed — the `outputs-basic` run

Source: `parity/reports/evidence/observe-outputs-2026-11-11-workspace/`.
Scenario `outputs-basic`, 2026-11-11, FreeShow `1.6.8-beta.3` at
`ff784eb388c7baef60d67e6d4e7c504f4322bca3` (`commitMatchesPin: true`). One
display at 1920×1080, hidden X11 agent workspace, project `Parity Project`, show
`Parity Fixture` (3 slides), no media. The harness repaired the fixture's group
links in the scratch copy only (`seed.json`: `groupRepairs` added `fx-2` and
`fx-3` as children of `fx-1`); the controller's 5 entries come from that
flattening, not from a 5-slide fixture. 11/11 steps, 21 screenshots
(`run.json`, `steps.json`). A second run on a Wayland/KDE desktop with an RTX
5060 Ti (`parity/reports/evidence/observe-outputs-2026-11-11-host/`) recorded
the same present-time window state but produced **no output frames**:
Playwright's `page.screenshot` and `capturePage()` both failed, and the
reference logged `Capture failed for output default: [Error: UnknownVizError]`.
That run is not used for frame claims.

Every bullet below is `observed` from the workspace run unless it says
otherwise. "Frame is byte-identical" means the md5 of the captured output PNG
matches; all output captures in the run were 1919×1079.

1. **Present creates an output page.** A Present click adds a second page whose
   root class is `fill context #output_window`
   (`src/frontend/MainOutput.svelte:122-124`) in a window titled `Primary`.
   The main window stays the only visible window.
2. **The output window is not on screen.** `browserWindows[].visible` is false
   for `Primary` in every step from `present` to `clear`, before and after
   starting the show; the run's README records that the X server never mapped
   `Primary`. The page still renders, and its slides advance, lock and clear.
   The same `present` step on the two-display GPU desktop also recorded `Primary`
   `visible:false`, so this is not a GPU-less-workspace artefact.
3. **The Present control stays off.** `presentButton` is
   `{ on: false, className: "context #output display off …",
   title: "Present [Ctrl+O]" }` in all 11 steps, even while the output page
   exists and shows a slide. The control's state is derived from the windows'
   reported visibility (`src/frontend/utils/receivers.ts:119-124`), and no
   visible output was reported.
4. **Space starts the show on the output.** After `open_show` the output was
   empty; a Space put slide 1 on it as one slide with two lines:
   `Verse one, line one` / `Verse one, line two`.
5. **Ctrl+L locks without changing the frame.** The single lock control's
   `data-title` flips from `Lock output [Ctrl+L]` to `Unlock output [Ctrl+L]`,
   and the captured output PNG is byte-identical to the unlocked frame
   (md5 `0acc002ff1ed99999da5a5778e848294`).
6. **Space while locked does not advance.** The output text is unchanged
   (`Verse one, line one` / `Verse one, line two`) and the frame is
   byte-identical to the locked frame.
7. **Ctrl+L unlocks.** The title returns to `Lock output [Ctrl+L]`; the frame is
   still identical.
8. **Space after unlocking advances.** The output text becomes
   `Verse one, line three`; the controller's position indicator moves `1/5` to
   `2/5`, consistent with group children being flattened into layout entries.
   The frame differs from the previous one
   (md5 `cf5178b7e8197d4a99d5e7e32bf987d9`).
9. **The clear controls are inline in the controller.** In the preview column,
   top to bottom: `Clear all [esc]` (enabled), then five layer groups —
   `Background` (no clear title; disabled), `Clear slide  [F2]` (enabled; two
   spaces), `Clear overlays [F3]` (disabled), `Clear audio [F4]` (disabled),
   `Clear next slide timer` (disabled). Locking disabled `Clear all` and
   `Clear slide`.
10. **Escape clears the output.** Output text becomes `""` and the captured
    frame is byte-identical to the empty output captured before `start`
    (md5 `a695902316f25b356d8a3862f6f6f782`). `Clear all` is replaced by
    `Restore output`, still disabled immediately after the clear — the 1 s
    enable delay at `src/frontend/components/output/preview/ClearButtons.svelte:22-28`.
11. **The output surface was 1919×1079, not 1920×1080.** Chromium shrinks a
    normal window that exactly matches a display; on the 2560×1440 desktop run
    the recorded bounds were 1920×1080. The size is not a fixed property of an
    output.

**Boundary this run does not cover.** A second display, more than one output,
per-output styles/aspect/line limits, invisible/NDI outputs, transitions,
media, audio, the stage layout, and any frame from a window that was actually
mapped on a display. Nothing here says what a visible output looks like on a
projector.

## Observed — the `lock-and-layers` run

Source: `parity/reports/evidence/observe-lock-and-layers-2026-11-12-xvfb/`.
Scenario `lock-and-layers`, 2026-11-12, FreeShow `1.6.8-beta.3` at
`ff784eb388c7baef60d67e6d4e7c504f4322bca3` (`commitMatchesPin: true`). Hidden X11
agent workspace, one 1920×1080 display, controller viewport 1600×900. Two enabled
normal outputs (`Primary`, `Secondary`). Show `Parity Locks`, 2 slides: slide 0 is
`Layer one` with a `logo.png` background and two overlays, `Underlay text`
(`placeUnderSlide: true`) and `Overlay text`; slide 1 is `Layer two`, with no
background and no overlays. 14/14 steps, `failed: []` (`run.json`); seven page
screenshot timeouts on the second window are recorded and are not step failures.
An output is evidenced by its page DOM (`outputs[]`, `layerTrees`) plus the
controller, not by an output PNG.

1. **A layer container is present when its layer has content, in a fixed
   document order.** On both pages, inside `.zoomed .slide`
   (`src/frontend/components/slide/Zoomed.svelte:155-189`), the order of the four
   content markers was: the background `<img class="media">` with the logo's src,
   then `Underlay text`, then `Layer one`, then `Overlay text` — the
   `placeUnderSlide` overlay below the slide, the ordinary overlay above it,
   matching `Output.svelte:420-467`. Exactly one background media element appeared
   (no style background was seeded) (`06-layer-order.json`).
2. **The controller's per-layer buttons reflect that content.** The five groups
   were `Background`, `Slide`, `Overlays`, `Audio`, `Next slide timer` in that
   order; the first three `clearDisabled: false` and titled `Clear background
   [F1]`, `Clear slide  [F2]`, `Clear overlays [F3]`; Audio and Next slide timer
   `clearDisabled: true` (`07-layer-buttons.json`). The title/content rule is
   corrected in `out.layers` below (audit `A-011`).
3. **The global lock blocks the slide click.** With the lock on (title `Unlock
   output [Ctrl+L]`), clicking another slide card changed neither page, stable
   across two reads ≥400 ms apart (`09-lock-blocks-click.json`; `Slides.svelte:98`).
4. **The global lock blocks the per-layer F-keys.** With the lock on, F3 left both
   overlays on both pages (`10-lock-blocks-f3.json`); F3's guard is the lock alone
   (`shortcuts.ts:378-383`).
5. **The global lock does not guard the per-output lock.** With the lock on, a
   click on `Primary`'s tile title bar deactivated and struck it while the global
   lock title stayed `Unlock output [Ctrl+L]` (`11-lock-allows-output-lock.json`;
   `OutputPreviewLabel.svelte:13-38` has no `outLocked` guard).
6. **Clear skips an inactive output.** With `Primary` inactive and `Secondary`
   active, one `Clear all` click emptied `Secondary` (slide, overlays, background)
   and left `Primary` showing `Layer one` with its background and both overlays.
   Reselecting `Primary` and replaying restored both pages, so the result is
   attributable to `active` (`13-clear-skips-inactive-output.json`,
   `14-reselect-and-play.json`; `clear.ts:87,124,145,164`).

**Boundary this run does not cover.** Bounds lock (needs a mapped window, a
window manager and a scripted drag), F1/F2/F4 and the per-layer clear buttons
(only F3 was fired), scenes/audio/timers as output-page layers, and any rendered
colour, z-index or opacity. The layer claim observed is presence and document
order, not appearance.

## <a id="outwindow"></a>`out.window` — the output window

**What the user sees.** A full-bleed picture with no title bar, no menu, no
taskbar entry by default, that sits above other windows.

**How it behaves.**

1. `CREATE` calls `createOutput` (`OutputLifecycle.ts:92-156`). If an output
   with the id already exists it is removed and recreated (`:97-101`).
2. The window is a `BrowserWindow` with `outputOptions`: `frame:false`,
   `transparent:true`, `alwaysOnTop:true`, `resizable:false`, `skipTaskbar:true`,
   `hasShadow:false`, `enableLargerThanScreen:true`, `show:false`
   (`src/electron/utils/windowOptions.ts:42-72`). `transparent` on the output
   swaps the backdrop to `#00000000` (`OutputLifecycle.ts:119`).
3. `alwaysOnTop` is on unless the output says `false` (`:119`). `false` makes
   the window resizable unless bounds are locked, and puts it back in the
   taskbar (`:263-266`). On macOS an always-on-top output is a `panel` window, so
   it can overlay fullscreen apps without switching Spaces (`OutputAlwaysOnTop.ts:25-27`).
   The always-on-top level is `screen-saver` on Windows and `pop-up-menu`
   elsewhere; on Windows a helper exe also excludes it from Aero Peek
   (`OutputAlwaysOnTop.ts:6-21,29-39`).
4. The window loads the output page, gets no menu, and its title is the output
   name (`OutputLifecycle.ts:285`, `:1574-1575`).
5. Showing calls `showInactive()` then `moveTop()` (`OutputVisibility.ts:142-148`);
   hiding calls `setKiosk(false)` and `hide()` (`:150-167`). This branch is not
   always reached: an output whose resolved bounds cover more than half of the
   main window is hidden instead of shown when bounds are not locked and it is
   auto-positioned, auto-started, or always-on-top (`OutputVisibility.ts:58-72`).
   The default output is always-on-top, so this is the single-display case the
   2026-11-11 run observed.
6. **Invisible output:** created with `show:false` and `webPreferences.offscreen`,
   never shown, rendered at the configured size with DPI correction so the
   captured pixels match the config (`OutputLifecycle.ts:112-118,254-261`;
   `OutputBounds.ts:57-71`). `toggleOutput` returns `"invisible"` without
   showing (`OutputVisibility.ts:44-50`).
7. **Locked bounds or invisible** ⇒ window is not resizable or movable
   (`OutputLifecycle.ts:1597-1615`).
8. **Finished with:** `removeOutput` stops capture and the NDI/OMT/Blackmagic
   senders, destroys the window and deletes the entry
   (`OutputLifecycle.ts:1514-1559`). Quitting the app closes all outputs
   (`:1617-1625`, `src/electron/utils/close.ts:40`).
9. **No close handler** is registered for an output window: listeners are
   `ready-to-show`, `move`, `resize` only (`OutputLifecycle.ts:1565-1595`). If a
   window is destroyed some other way, the next toggle recreates it
   (`OutputVisibility.ts:38-42`).
10. **Double-click the output window** hides the outputs
    (`MainOutput.svelte:130-133` → `hideDisplay()` at `utils/common.ts:81-83`
    → `toggleOutputs(null,{state:false})`).
11. **Ctrl/Cmd-hover** shows a "Drag window" bar at the top; the page then tells
    the main process that moving is enabled (`MainOutput.svelte:30-35,135-139,166-179`;
    `OutputHelper.ts:28-31`).

**Edge cases.** A display change re-applies bounds after 500 ms (metrics) or
1000 ms (display added) (`OutputLifecycle.ts:57-65`). Requesting a show that
would cover more than half of the main window, when bounds are not locked and
positioning is automatic, is refused and raises `error.display`
(`OutputVisibility.ts:58-72`; the main window turns that into the
Choose-screen popup, `IPC/responsesMain.ts:164-176`).

## <a id="outlayers"></a>`out.layers` — layers, clear and restore

**What the user sees.** Under the previews, in Show view: **Clear all** (or
**Restore Output** when everything is cleared), then **Background**, **Slide**,
**Overlays**, **Audio**, **Next timer**, plus **Scene** when a scene is showing.
Each layer button has a tiny expand control underneath for that layer's tools
(`ClearButtons.svelte:114-215`).

**How it behaves.**

- **Corrected 2026-11-12 (audit `A-011`).** Every layer button is passed `red`
  unconditionally (`ClearButtons.svelte:144,159,175,188,202`); a *disabled* button
  is painted `background-color: var(--primary)` by the `button:disabled` rule
  (`:246-248`). "Red with content, dark when clear" therefore describes the look,
  not the mechanism. Content is signalled by `disabled={$outLocked || …cleared}`:
  Background `:144`, Slide `:159`, Overlays `:175` (`overlayCleared &&
  effectsCleared`), Audio `:188`, Next timer `:202`. The clear *title* is not a
  content signal on three of the five: Slide, Audio and Next timer carry theirs
  unconditionally; Overlays drops its title only for a locked overlay
  (`lockedOverlay`, `:175`), not for an empty layer; only Background drops its
  title when it is cleared or the output is locked (`:144`). `observed`
  (2026-11-12): with content in three layers all five groups are titled and the
  first three enabled (`07-layer-buttons.json`), while in the `nav-disabled-slides`
  run an **empty** Overlays group was still titled `Clear overlays [F3]` and
  disabled, and Background was untitled and disabled
  (`parity/reports/evidence/observe-nav-disabled-slides-2026-11-12-xvfb/06-start-skips-disabled.json`).
  The rendered colour itself stays `code`.
- **Clear all** clears background, slide, overlays, audio and timers
  (`clear.ts:29-34`). It returns immediately if the global lock is on (`:14`).
  It also caches the current `out` per active output first (`:24,36-57`).
- **Clear background** → `setOutput("background", null)` for every active output
  (`clear.ts:86-95`).
- **Clear slide** stores the slide position for later (unless it is the last
  slide in a non-focus layout) and sets `slide` to null (`clear.ts:98-126`).
- **Clear overlays** removes overlays *except those whose overlay record has
  `locked: true`*, and clears all effects (`clear.ts:144-156`).
- **Clear audio** fades out playing audio and stops the playlist; **Clear all**
  does not pass `clearMicrophones`, so microphones keep running
  (`clear.ts:32`, `audioFading.ts:43-47`). **Clear next timer** removes
  `out.transition` and clears that output's slide and overlay timers
  (`clear.ts:158-181`).
- **Restore Output** appears only when everything is clear and a cache exists;
  it is enabled 1 s after caching and is dropped as soon as anything becomes
  active again (`ClearButtons.svelte:22-32,127-131`). It restores `out` for the
  active outputs and restarts audio/metronome (`clear.ts:59-84`).
- **Scene** is a separate layer with its own clear button; **Clear all** does
  not clear a scene (`clear.ts:13-34`, `ClearButtons.svelte:115-124`).

**Observed (2026-11-11).** With one output and one slide showing, the inline
list was, top to bottom: `Clear all [esc]` (enabled), `Background` (disabled,
no `data-title`), `Clear slide  [F2]` (enabled; note the two spaces),
`Clear overlays [F3]` (disabled), `Clear audio [F4]` (disabled), and
`Clear next slide timer` (disabled). This matches the order and the
enabled/disabled rules above (`ClearButtons.svelte:133,144,159,175,188,202`).
Locking the output disabled `Clear all` and `Clear slide`. Escape cleared the
output and replaced `Clear all` with `Restore output`, which was still disabled
immediately after the clear; the post-clear frame was byte-identical to the
empty frame before `start`. Boundary: no background, overlay, audio or timer
content existed, so the per-layer clear actions (F1–F4) themselves were not
fired; only Clear all via Escape was.

**Observed (2026-11-12).** With content in Background, Slide and Overlays, both
output pages rendered the four markers in document order — background image, the
`placeUnderSlide` underlay, the slide text, the ordinary overlay — and the
controller listed the five groups with the first three enabled and titled and
Audio/Next timer disabled (`06-layer-order.json`, `07-layer-buttons.json`). This
settles the 2026-11-11 boundary ("no background, overlay, audio or timer content
existed") for presence and order. Appearance — the rendered colour, z-index,
opacity and filters, and the underlay's actual stacking on a projector — remains
`code`; see the `lock-and-layers` section above.

## <a id="outenable"></a>`out.enable` — present and stop

- The present button is in the top bar; it is red while `outputDisplay` is true
  and its title is "Present" / "Stop presentation" (`Top.svelte:132-152`,
  `public/lang/en.json:306-308`).
- Clicking once to stop only arms a confirm; a second click within 1800 ms
  stops (`Top.svelte:27-50`). Ctrl/Cmd-click, or Ctrl+O, stops immediately
  (`Top.svelte:30,40-44`; `shortcuts.ts:55`).
- Starting sends `TOGGLE_OUTPUTS` with every *enabled* output in the target
  list (`output.ts:115-134`). Per-output `enabled:false` means no window is
  created at all (`output.ts:120`).
- `outputDisplay` is derived from the windows' reported state; it only changes
  when all visible outputs agree (`receivers.ts:111-125`).
- **`observed` (2026-11-11):** one Present click on one display created the
  output page in a window titled `Primary`, but the window was not visible and
  the control stayed `off` for the whole run. The output page still rendered,
  started, locked, advanced and cleared. The output's default bounds covered
  the controller and the window is always-on-top, so `toggleOutput` took the
  hide branch (`OutputVisibility.ts:58-72`); with no visible output reported,
  `outputDisplay` stayed false (`receivers.ts:119-124`). See Observed.
- **Edge cases:** with one display and `autoStartup`, no window is shown
  (`OutputVisibility.ts:52-54`). A normal Present on one display can also leave
  the window hidden when its bounds cover the main window and it is
  always-on-top or auto-positioned (`OutputVisibility.ts:58-72`; observed
  2026-11-11). If no output is enabled, the first one is
  silently enabled (`output.ts:631-646`).

## <a id="outpreview"></a>`out.preview` — previews and meters

- One tile per enabled output, in a grid whose column count is
  `special.outputPreviewGrid` (default 2); tiles hidden by `hideFromPreview`
  become title bars only (`MultiOutputs.svelte:21-26,236-244`).
- With more than one output each tile has a coloured border in the output's
  colour and a title bar (`MultiOutputs.svelte:254-259`;
  `OutputPreviewLabel.svelte:49-55`).
- A tile is a live mirror of the output (`PreviewOutput.svelte:75-81`), with
  transitions disabled in the mirror (`Output.svelte:222`,
  `output.ts:1866-1870`). If the output is being captured, the tile draws the
  downscaled capture instead (`PreviewOutput.svelte:29-31,51-68,89-91`).
- Network outputs (NDI/OMT/WebRTC/RTMP) get a vertical audio meter on the tile
  (`MultiOutputs.svelte:337-341`); the main audio meter sits to the right of
  the preview area (`Preview.svelte:260-262`).
- Clicking a tile makes it the fullscreen preview with a resolution/aspect
  readout (`MultiOutputs.svelte:51-81,229-235`).

## <a id="outcontrols"></a>`out.controls` — the five buttons

Under the previews, left to right (`ShowActions.svelte:89-119`):

| Button | Action | Disabled when |
| --- | --- | --- |
| Previous slide | `OutputHelper.advanceOutputs("previous")` | global lock, temp slide, at the first line/slide |
| Next slide | `advanceOutputs("next")` | global lock, temp slide, at the end |
| Update Output / Start Show | `refreshOut()` (increments `out.refresh`) or play the active show's first enabled slide | global lock / selection unsuitable |
| Lock Output | toggles `outLocked` | never |
| Transition | opens the transition popup | never |

Shortcuts in the tooltips: Arrow Left/Right, Ctrl+R, Space, Ctrl+L
(`ShowActions.svelte:90-107`). `refreshOut` bumps `out.refresh` on every active
output (`output.ts:761-769`).

**Observed (2026-11-11).** The run recorded the lock control only: Ctrl+L
flipped its title from `Lock output [Ctrl+L]` to `Unlock output [Ctrl+L]` and
back. The other four buttons' presence and disabled states were not captured,
so the five-button order above remains `code`, not `observed`.

## <a id="outlock"></a>`out.lock` — three different locks

| Lock | Where | Effect |
| --- | --- | --- |
| Global (`outLocked`) | `stores.ts:391`; Ctrl+L (`shortcuts.ts:341`); padlock (`ShowActions.svelte:107`); API (`apiHelper.ts:332-337`) | Blocks slide advance (`helpers/OutputHelper.ts:30`), a slide-card click (`Slides.svelte:98`), Clear all (`clear.ts:14`) and every per-layer clear button/F-key (`ClearButtons.svelte:45-47`; `shortcuts.ts:360,367,379,385`), media toggle (`shortcuts.ts:492`), scenes (`output.ts:514`), audio start/playlist/mic (`audioPlayer.ts:84`, `audioPlaylist.ts:61`, `audioMicrophone.ts:77`), remote commands (`remoteTalk.ts:109`) and the guarded API actions (`apiHelper.ts:69,243,299-335`). |
| Per output (`active:false`) | Title bar click or Ctrl/Cmd+click (`OutputPreviewLabel.svelte:13-38`); API (`apiHelper.ts:338-361`) | Removes that output from `getActiveOutputs`, so `setOutput`, advance and clear skip it (`output.ts:699-714`; `output.ts:153`; `OutputHelper.ts:21`; `clear.ts:87,124,145,164`). Name is struck through (`OutputPreviewLabel.svelte:54`). The last active normal output cannot be locked (`OutputPreviewLabel.svelte:29-33`). |
| Bounds (`boundsLocked`) | Lock button in Choose screen (`Screens.svelte:143-152`) | Stops moving, resizing and auto-positioning the window (`OutputVisibility.ts:83`; `OutputLifecycle.ts:1582,1590,1601-1610`; `OutputBounds.ts:83`). |

Not stopped by the global lock, as far as was traced: enabling/disabling
outputs, toggling a per-output lock, and editing styles/settings
(`output.ts:115-134`; `apiHelper.ts:347-361`; `Styles.svelte:23-39`). The
per-output toggle is now `observed` (2026-11-12): with the global lock on, a
title-bar click deactivated and struck `Primary` and left the lock title
`Unlock output [Ctrl+L]`
(`parity/reports/evidence/observe-lock-and-layers-2026-11-12-xvfb/11-lock-allows-output-lock.json`).
Enabling/disabling outputs and the style/settings editors were not run.

**Observed (2026-11-11).** The single lock control flipped its title on Ctrl+L
(`ShowActions.svelte:107`), and the captured output frame was byte-identical
before and after locking (md5 `0acc002ff1ed99999da5a5778e848294`). Space while
locked left the output text and frame unchanged, matching the early return at
`helpers/OutputHelper.ts:30`. `Clear all` and `Clear slide` became disabled
while locked (`ClearButtons.svelte:133,159`); unlocking restored the title and
still did not change the frame. Boundary: only the global lock on one output
was exercised; per-output (`active:false`) and bounds locks were not.

**Observed (2026-11-12).** With two outputs and an overlay on each page: the
global lock blocked a click on another slide card (neither page changed across
reads ≥400 ms apart) and blocked **F3** (both overlays stayed). F3's handler
returns on the lock alone (`src/frontend/utils/shortcuts.ts:378-383`), unlike
F2's, which also returns when something is selected (`:367`). The lock did
**not** guard the per-output toggle. Clearing was per active output: with
`Primary` inactive, `Clear all` emptied `Secondary` and left `Primary` showing
its slide, background and overlays. Evidence:
`09-lock-blocks-click.json`, `10-lock-blocks-f3.json`,
`11-lock-allows-output-lock.json`, `13-clear-skips-inactive-output.json` in
`parity/reports/evidence/observe-lock-and-layers-2026-11-12-xvfb/`. Boundary:
bounds lock (needs a mapped window and a drag), F1/F2/F4, the media, scene,
audio, remote and API rows, and the last-active guard (already observed
2026-11-12) were not part of this run.

## <a id="outstatus"></a>`out.status` — the dot

The dot is a circle in the output's title bar (`OutputPreviewLabel.svelte:51,73-97`).
Classes are applied in this order: `locked` when `active` is false; `invisible`
when the output is invisible; `ndi` when `ndiData[id].connections > 0`; `active`
when `outputState` reports the window as shown (`OutputPreviewLabel.svelte:43-51`).
Because all two-class rules have equal specificity and the later rule wins:

| State | Colour | Note |
| --- | --- | --- |
| Locked (and not NDI) | tan `#c98b55` (docs call it yellow) | `!output.active` |
| Locked and NDI connected | amber `#ffb16d` | `locked.ndi` is 0,3,0 |
| Active/shown | green `#6dff85` | `outputState` true |
| NDI connected, not shown | blue `#48cbe9` | invisible NDI output |
| Invisible, no receivers | grey `#897f7f` | "disconnected invisible window" |
| Enabled, not shown | red `#ce3535` | base rule |

`outputState` filters invisible outputs out (`receivers.ts:119-120`), so an
invisible output is never green. Tooltip text: Locked / Enabled / NDI / Network
output / Inactive (`OutputPreviewLabel.svelte:40-46`).

## <a id="outsettings"></a>`out.settings` — the Outputs tab

- One tab per output, sorted by name with stage outputs last; the tab strip has
  a New output button (`OutputsTabs.svelte:41,157-160`).
- Add flow: normal or stage (`ChooseOutput.svelte:6-13`, only offered when stage
  layouts exist, `OutputsTabs.svelte:94`), then a style (normal only), then a
  local type (`window`, `blackmagic`) or network type (`ndi`, `omt`, `webrtc`,
  `rtmp`) (`OutputSetup.svelte:10-20`). Any non-`window` local type becomes
  `invisible`; NDI/OMT also become `transparent` (`OutputsTabs.svelte:135-139`).
- **Enabled** toggle: turning it off sends `REMOVE` (the window is destroyed) and
  drops the NDI/OMT data; turning it on sends `CREATE` (`Outputs.svelte:54-73,90-94`).
  It is hidden when only one enabled output exists and is disabled for the last
  one, or while the output is streaming (`Outputs.svelte:359-362`).
- Normal outputs choose an **active style**; stage outputs choose a **stage
  layout** instead of a style (`Outputs.svelte:364-378`).
- **Window** section (screen picker, Always on top) is hidden for invisible
  outputs (`Outputs.svelte:382-388`). **NDI**, **OMT**, **Blackmagic**, WebRTC
  and RTMP sections appear only when that target is enabled
  (`Outputs.svelte:390-447`).
- Right-clicking an output tab gives rename/recolour, duplicate, delete
  (`contextMenus.ts:434-435`).
- Changing `transparent`, `invisible`, any capture flag, or `alwaysOnTop` on
  macOS recreates the window, because those are fixed at creation
  (`Outputs.svelte:75-85`).

## <a id="outwindowposition"></a>`out.window.position` — placement

- **Choose screen** draws the displays to scale; clicking one sets `bounds` to
  that display, stores `screen`, turns the output on and re-sends the bounds
  (`Screens.svelte:113-141`). A display is auto-matched when an output's bounds
  already equal it (`Screens.svelte:34-42`).
- **Identify** opens a numbered full-screen window on each display for 3 s
  (`OutputIdentify.ts:8-37`; `Screens.svelte:154-156`).
- **Manual values:** X/Y and width/height, minimum 40 px. Editing X/Y clears
  `screen` so auto-placement will not fight the manual position
  (`ChangeOutputValues.svelte:38-43,111-121`).
- **Invisible outputs:** no X/Y and no screen; only size, with presets 4K,
  1440p, 1080p, 720p, 480p, 360p (`ChangeOutputValues.svelte:96-134,47-56`).
- **Bounds resolution** order: locked bounds win; valid bounds whose centre is
  on a display are kept; otherwise the stored `screen` id is used; otherwise
  (not macOS) the second display when there are exactly two and the caller
  asked to auto-position (`OutputVisibility.ts:76-110`).
- **Always on top off** makes the window resizable
  (`OutputLifecycle.ts:263-266`), matching the docs.
- **Align with screen** snaps every unlocked, visible output to the display
  nearest its centre and reports the new bounds and screen
  (`OutputBounds.ts:80-103`).
- **Observed (2026-11-11), default only:** with one display and no configured
  bounds, the created output took the whole primary display — recorded as
  1919×1079 on a 1920×1080 X11 display and 1920×1080 on a 2560×1440 Wayland
  display. That is what made it cover the controller. Multi-monitor placement,
  manual X/Y, and bounds lock were not exercised.

## <a id="outrecorder"></a>`out.recorder` — two recorders

1. **Screen/window recorder.** `navigator.mediaDevices.getUserMedia` with
   `maxWidth:4096`, `maxHeight:2160` (`Recorder.svelte:37-61`), recorded as WebM
   (VP9/Opus when supported) by `MediaRecorder` in 1 s chunks (`recorder.ts:51,61-64`),
   and written by `Main.RECORDER` to `special.audioRecordingsPath`
   (`recorder.ts:143-147`). Default path is `<data root>/Recordings`
   (`AudioInfo.svelte:19-20`; `src/electron/utils/files.ts:366,397-401`).
   Filename `FreeShow_<label>_<ISO timestamp>.webm` (`recorder.ts:132-136`).
2. **Output recording.** Per output, requires FFmpeg (`recorder.ts:167`),
   encoded in the capture worker: `RECORD_OUTPUT` plus the `recorder` capture
   flag (`recorder.ts:20-25`). The recording is a file *destination of the
   output's RTMP encode*, so the output is encoded once
   (`OutputRecording.ts:6-15,32-35`); that encode has a video and an audio
   stream and holds video until audio arrives (`RtmpStreamer.ts:340,678-688`).
   File is `FreeShow_<output name>_<timestamp>.mp4`, with `_part2`, `_part3`…
   after pause/resume (`recorder.ts:22,76`); the containing folder is opened in
   the system when recording stops (`OutputRecording.ts:22-25`).

## Settings

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Output enabled | `outputs[id].enabled` | `true` for the first output | Window is created/removed |
| Output active (per-output lock) | `outputs[id].active` | `true` | Output receives/ignores changes |
| Always on top | `outputs[id].alwaysOnTop` | `true` | Top-most; off ⇒ resizable, taskbar |
| Invisible | `outputs[id].invisible` | absent | Offscreen capture surface |
| Transparent | `outputs[id].transparent` | absent | Transparent backdrop |
| Bounds | `outputs[id].bounds` | 1920×1080 at 0,0 | Window rect |
| Screen id | `outputs[id].screen` | `null` | Preferred display |
| Bounds locked | `outputs[id].boundsLocked` | absent | No move/resize/auto-position |
| Global lock | `outLocked` | `false` | Blocks presentation changes (`stores.ts:391`) |

## Code

- `src/electron/output/helpers/OutputLifecycle.ts:92-156,251-291,1514-1625`
- `src/electron/output/helpers/OutputVisibility.ts:11-167`
- `src/electron/output/helpers/OutputBounds.ts:23-103`
- `src/electron/output/helpers/OutputAlwaysOnTop.ts:6-39`
- `src/electron/utils/windowOptions.ts:42-72`
- `src/frontend/components/output/clear.ts:13-201`
- `src/frontend/components/output/preview/ClearButtons.svelte:36-215`
- `src/frontend/components/output/preview/OutputPreviewLabel.svelte:13-97`
- `src/frontend/components/output/ShowActions.svelte:89-119`
- `src/frontend/components/output/preview/MultiOutputs.svelte:21-344`
- `src/frontend/components/output/preview/PreviewOutput.svelte:29-91`
- `src/frontend/components/settings/Screens.svelte:113-156`
- `src/frontend/components/settings/tabs/Outputs.svelte:54-94,359-447`
- `src/frontend/components/settings/tabs/OutputsTabs.svelte:89-174`
- `src/frontend/components/drawer/live/recorder.ts:20-183`
- `src/electron/streaming/OutputRecording.ts:6-35`

## Doc vs code

- `doc` says pressing the present button "activate[s] the output window(s)" and
  that "the button is red when the output window(s) are active"
  (`source/docs/output.md:36`). `observed` 2026-11-11: on one display the output
  page presented, advanced, locked and cleared while the button stayed `off` and
  no window was mapped. Code separates the output page/content from the window's
  visible state (`OutputVisibility.ts:58-72`; `receivers.ts:119-124`), so "active"
  in the doc covers two different things. Audit `A-005`.
- `doc` says double-click "disables" the output window
  (`source/docs/output.md:51`). Code calls `toggleOutputs(null,{state:false})`,
  hiding **all** enabled outputs (`utils/common.ts:81-83`).
- `doc` says right-click a preview "to show or hide individual windows"
  (`source/docs/outputs.md:20`). Hiding from preview is a main-window-only flag
  (`menuClick.ts:884-898`) and the window is unaffected; toggling the *window*
  is on the title-bar menu (`contextMenus.ts:260`).
- `doc` calls the locked dot "yellow" (`source/docs/output.md:72`). The CSS is a
  tan/amber pair (`OutputPreviewLabel.svelte:91-97`).
- `doc` says the Invisible setting lives "under NDI settings"
  (`source/docs/output.md:98`). It is a general output flag, set when a network
  output is created (`OutputsTabs.svelte:135-139`).

## Open questions

- Whether `outputs` (as opposed to `outLocked`/`lockedOverlays`) is persisted in
  settings was not traced.
- Whether a second output joining one render page changes the visible frame
  timing is `unknown`.
- macOS behaviour of the creation-time `minimize()` (`OutputLifecycle.ts:279`)
  is `unknown`.
- Which exact actions the global lock does *not* guard across the whole API
  surface is not exhaustively traced; the list above is what was read. One entry
  was observed on 2026-11-12: the per-output lock toggle
  (`11-lock-allows-output-lock.json`).
- Whether a mapped output window shows the same frame as the hidden page
  capture, and how it behaves on a second display (focus, always-on-top,
  bounds), is `unknown`. A run with two displays and a screen capture of the
  second display would establish it.

## Changelog

- `2026-11-11` — added the `outputs-basic` observed section (present creates a
  hidden output page; Present stays off; start, lock, advance and clear work);
  corrected the present/visibility edge case and the screenshot caption; added
  the caveat that an output window can be created without being shown. Audit
  `A-005`, `A-007`.
- `2026-11-12` — added the `lock-and-layers` observed section and relabelled the
  global lock's click guard, the F3 guard, the unguarded per-output toggle and
  Clear-all skipping an inactive output `observed`; relabelled layer presence and
  document order (background → underlay → slide → overlay) and the controller's
  per-layer enabled state `observed`. **Corrected** the layer-button wording: the
  `red` prop is unconditional, content is signalled by `disabled`, and only
  Background drops its clear title when empty. Audit `A-011`. Appearance, bounds
  lock, F1/F2/F4 and the media/scene/audio/remote lock rows stay `code`.
