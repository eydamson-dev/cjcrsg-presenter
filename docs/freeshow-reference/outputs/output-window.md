# Output window and output controls

- **IDs:** `out.window`, `out.layers`, `out.enable`, `out.preview`,
  `out.controls`, `out.lock`, `out.status`, `out.settings`,
  `out.window.position`, `out.recorder`
- **Area:** outputs
- **Online docs:** [Output](https://freeshow.app/docs/output)
- **Pinned code:** ff784eb388c7baef60d67e6d4e7c504f4322bca3
- **Confidence:** `code` (see page-level exceptions in Doc vs code)

## Screenshot

![The output window at 1920x1080 showing the live slide.](../screenshots/output-window.png)

Captured from the running reference (1.6.8-beta.3), 2026-11-09.


## Summary

Each output is a frameless, transparent, always-on-top window created hidden and
shown inactive; an "invisible" output is instead an offscreen surface that is
never shown and exists only to be captured (NDI, OMT, RTMP, recording). The
window is a view of `outputs[id].out`; the state lives in the main window.

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
   hiding calls `setKiosk(false)` and `hide()` (`:150-167`).
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

- A layer button is red while the layer has content and dark when the layer is
  clear (`ClearButtons.svelte:144-205`, disabled styling at `:246-248`).
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
- **Edge cases:** with one display and `autoStartup`, no window is shown
  (`OutputVisibility.ts:52-54`). If no output is enabled, the first one is
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

## <a id="outlock"></a>`out.lock` — three different locks

| Lock | Where | Effect |
| --- | --- | --- |
| Global (`outLocked`) | `stores.ts:391`; Ctrl+L (`shortcuts.ts:341`); padlock (`ShowActions.svelte:107`); API (`apiHelper.ts:332-337`) | Blocks slide advance (`helpers/OutputHelper.ts:30`), Clear all (`clear.ts:14`) and every per-layer clear button/F-key (`ClearButtons.svelte:45-47`; `shortcuts.ts:360,367,379,385`), media toggle (`shortcuts.ts:492`), scenes (`output.ts:514`), audio start/playlist/mic (`audioPlayer.ts:84`, `audioPlaylist.ts:61`, `audioMicrophone.ts:77`), remote commands (`remoteTalk.ts:109`) and the guarded API actions (`apiHelper.ts:69,243,299-335`). |
| Per output (`active:false`) | Title bar click or Ctrl/Cmd+click (`OutputPreviewLabel.svelte:13-38`); API (`apiHelper.ts:338-361`) | Removes that output from `getActiveOutputs`, so `setOutput`, advance and clear skip it (`output.ts:699-714`; `output.ts:153`; `OutputHelper.ts:21`). Name is struck through (`OutputPreviewLabel.svelte:54`). The last active normal output cannot be locked (`OutputPreviewLabel.svelte:29-33`). |
| Bounds (`boundsLocked`) | Lock button in Choose screen (`Screens.svelte:143-152`) | Stops moving, resizing and auto-positioning the window (`OutputVisibility.ts:83`; `OutputLifecycle.ts:1582,1590,1601-1610`; `OutputBounds.ts:83`). |

Not stopped by the global lock, as far as was traced: enabling/disabling
outputs, toggling a per-output lock, and editing styles/settings
(`output.ts:115-134`; `apiHelper.ts:347-361`; `Styles.svelte:23-39`).

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
  surface is not exhaustively traced; the list above is what was read.
