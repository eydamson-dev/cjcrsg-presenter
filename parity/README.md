# Parity harness

Checks that what we build behaves like FreeShow. Plan:
[`docs/parity-workflow.md`](../docs/parity-workflow.md).

Status: **structure only.** Calibration has run; no adapter is implemented.

```
features/     one YAML per feature, with reference evidence and confidence
scenarios/    operator-level steps, shared by both adapters
fixtures/     input files (FreeShow .show for now, .cjcp later)
tools/        capture and comparison scripts (Node)
reports/      evidence: preflight, calibration, experiment runs
```

## What has been established

| Result | Where |
| --- | --- |
| FreeShow's web clients run and can be driven by Playwright | `reports/preflight-2026-11-09.md` |
| Navigation lives on the controller (5512), not the remote | same |
| Static Chromium captures are bit-identical across runs | `reports/calibration-2026-11-09.md` |
| Four-window state recovery works in our app | `reports/experiment-1-2026-11-09.md` |
| FreeShow's controller drawer is read, contracted, implemented and verified | `reports/reader/controller-layout-2026-11-09.md`, `../docs/contracts/ui-drawer.md`, `reports/ui-drawer-2026-11-09.md` |
| The left project browser is contracted, implemented and verified | `../docs/contracts/ui-project-browser.md`, `reports/ui-project-browser-2026-11-09.md` |
| Output-window basics are now `observed` in the reference: present, start, lock, Space-while-locked, unlock, next, clear | `../docs/freeshow-reference/outputs/output-window.md`, `reports/evidence/observe-outputs-2026-11-11-workspace/` |

## Running the reference

Setup from a clean machine (cloning and building FreeShow, installing the tools,
the Playwright browser, and ffmpeg for test clips) is in `CONTRIBUTING.md`,
under "Parity harness".

```bash
# 1. FreeShow must be built and running with a scratch profile
cd ~/projects/reference/freeshow
FS_MOCK_STORE_PATH=/tmp/opencode/fs-store NODE_ENV=production npx electron . \
  --user-data-dir=/tmp/opencode/fs-userdata

# 2. Capture
cd parity/tools
npm install
npx playwright install chromium     # once per machine
node capture_freeshow.mjs /tmp/parity-capture
```

The scratch profile needs:

- `config.json` with `dataPath` pointing at a scratch folder;
- `settings.json` with every server explicitly enabled —
  `disabledServers: { remote: false, stage: false, controller: false, output_stream: false }`,
  because a server starts only when its value is exactly `false`;
- `projects.json` listing the fixture project;
- `<dataPath>/Shows/<name>.show` holding `[id, show]` JSON with a real layout.

**Store location.** With `FS_MOCK_STORE_PATH` set, FreeShow reads every
electron-store file from that directory, not from `config.dataPath`. So
`projects.json`, `settings.json`, `themes.json` and `templates.json` belong
beside `config.json`; only `Shows/` (and the app's `Config`, `Bibles`, `Audio`
folders) live under `dataPath`. A `projects.json` under `dataPath` is ignored,
and the Projects panel then says "Nothing here" while the Shows drawer still
lists the files.

## Observing the reference (output-window basics)

`tools/observe_reference.mjs` launches the pinned reference with a profile
reseeded from scratch, performs a named sequence of operator steps, and writes
a machine-readable record plus a screenshot after every step. It is how an
output-area behaviour becomes `observed` when the observing agent has no shell
of its own.

```bash
# from the repository root (the form a read-only agent's shell can run)
node parity/tools/observe_reference.mjs /tmp/opencode/observe-outputs-$(date +%F)

# equivalent, from the tools directory
cd parity/tools && node observe_reference.mjs /tmp/opencode/observe-outputs-$(date +%F)
```

What it writes:

| File | Contents |
| --- | --- |
| `steps.json` | every step: window count, each OS window's title/`visible`/`offscreen`/`minimized`/`focused`/`opacity`/bounds, each page's title/URL, controller visible text, the Present control's own state, the output window's visible text, the lock control's `data-title`, clear-control entries, assertions, screenshot path |
| `NN-<step>.json` | the same record for one step |
| `NN-<step>-controller.png` | the controller after the step (1600×900 requested; `run.json` records the actual viewport) |
| `NN-<step>-output.png` | the output window after the step, when one is open |
| `run.json` | reference version/commit, profile seed, harness (node, display, locale), `controller.viewport`/`controller.displays`, per-step `screenshots` and `failed`, pass/fail |
| `seed.json` | exactly what was written to the scratch profile |
| `run.log`, `electron.log` | the driver's log and the app's stdout/stderr |

The default scenario, `outputs-basic`, runs: `ready`, `present`,
`open_project`, `open_show`, `start`, `lock`, `next_while_locked`, `unlock`,
`next`, `clear_entries`, `clear`. It asserts only that the reference performed
each step — text appeared, the lock title flipped, Space while locked did not
advance, Escape emptied the output — not that the behaviour is right for the
port.

`--scenario stage-multi-output` runs the other slice: `ready`, `open_project`,
`open_show`, `present_outputs`, `start`, `advance`, `stage_tile_click`,
`deselect_secondary`, `advance_inactive`, `last_active_guard`,
`reselect_secondary`, `disable_output`, `enable_output`, `back_to_show`. It
records `out.multiple`, `out.multiple.select`, `out.stage-window` and
`stage.items`:

- **Seed.** That scenario seeds two enabled normal outputs plus a stage output
  into the scratch profile: `outputs` inside `settings.json` (the reference's
  own default key, `src/electron/data/defaults.ts:19-30`) and a `stage.json`
  (`store.ts:38`) holding one layout with two `slide_text` items, `slideOffset`
  0 and 1, copied from the reference's default layout
  (`utils/createData.ts:17-38`). The stage output's entry carries
  `stageOutput: <layout id>` (`helpers/output.ts:1202-1229`). `outputs-basic`
  seeds neither, so its observations are unchanged.
- **Reading several outputs.** Each output page names its own output in the DOM:
  `Zoomed` renders `id={outputId}` (`slide/Zoomed.svelte:156`) in both the slide
  (`Output.svelte:408`) and the stage layout (`StageLayout.svelte:164`), and the
  preview tile carries the same id. That is how `steps.json`'s `outputs[]`,
  `controller.preview.tiles[]` and the OS window titles are joined without
  guessing. A stage page is identified by `.stageArea` (`StageLayout.svelte:147`),
  which a normal output never renders.
- **One Present click, three windows.** `toggleOutputs(null)` fans out to every
  enabled output, stage included. On this machine all three windows are created
  hidden (the reasons are in the section above), so their *content* is
  observable while their pixels are not.
- **What it asserts.** Both normal outputs follow `start` and `advance`; a plain
  click on a tile deactivates exactly that output and the next advance skips it;
  the last active normal output snaps back and toasts; the stage tile cannot be
  deactivated; the stage page shows the current slide's text and the next
  slide's text at the same time and follows the output it mirrors; disabling one
  output from Settings > Outputs removes its window and leaves the other two
  untouched.

The disable/enable steps drive the real settings UI: the top-bar Settings
button, the `Outputs` section in the left panel, the output's tab, then the
`Enabled` switch. The steps read the switch's `aria-checked` and the selected
tab before clicking, and record both, so a wrong tab fails loudly instead of
disabling the wrong output.

**Present can be capture-only, not a shown window.** The reference creates the
output window and leaves it hidden: `BrowserWindow.isVisible()` is `false` in
both a GPU-less X11 workspace (one display) and a Wayland desktop with **two**
displays, and the X server never maps a window titled `Primary`. The cause is the
output's configured bounds landing on the controller's display — the default
1920×1080 at 0,0 centers inside display 1 — so `OutputVisibility` hides it rather
than covering the controller, and a second display does not save it because
`resolveOutputBounds` keeps valid on-display bounds as they are. Presenting is
still real — the output page renders, and its slides advance, lock and clear — so
a run can observe the output's *content* without ever having seen it on a
display. Three consequences, all measured on 2026-11-11:

- **The Present control can stay "off" while an output exists.** `Present` is a
  state-dependent toggle (`helpers/output.ts`: `state = force || !currentOutputState`),
  and `OutputVisibility.toggleOutput` hides an output whose bounds would cover
  the controller. The click is still the step; `steps.json`
  records `presentButton.on` so "the operator asked and the reference answered
  off" is visible rather than assumed. Do not assert that Present made a window
  appear — assert that the output page exists, and say whether the window did.
- **The output surface is 1919×1079, not 1920×1080.** Chromium shrinks a window
  that would match a display exactly; the capture inherits the odd size. Any
  pixel comparison has to resize first, or compare at 1919×1079.
- **A startup popup swallows pointer clicks.** "Graphics acceleration is
  unavailable" / "Hardware video decoding is unavailable" is a modal across the
  controller, and while it is up a click never dispatches while keyboard steps
  still work — which reads as a broken selector. The driver presses Escape before
  every pointer step and logs it. This is what made `open_show` time out on the
  desktop run while the same step passed in the workspace.

**Screenshots of the output only work off the GPU.** In the X11 workspace the
driver captured the output after every step (21 files, 11/11 steps). On the
Wayland/KDE desktop every output screenshot timed out — `page.screenshot`
(15 s) and `capturePage()` both returned nothing — while the same run's
controller screenshots were fine. The reference's own capture agrees:
`electron.log` shows `Capture failed for output default: [Error: UnknownVizError]`
with `[OSR] capture mode: cpu bitmap ... gpu compositing=hardware`. Use the
workspace when the output frame is part of the evidence.

**What it cannot observe:** window placement and monitors, the
remote/stage/controller web clients, audio playback (`audio.play`), or anything
that depends on the controller clock. Per-output styles and media are covered by
`styles-multi-output` and `media-behaviour` (see below), and multiple outputs and
the stage *window* are covered by `stage-multi-output`; the stage **web client**
(port 5511, `stage.url`
and its query parameters) is not — it needs a browser pointed at the reference's
stage server, which is a different route. The output window's size comes from the
profile and the screen and is recorded, not forced; the controller clock is
visible in controller screenshots and must be masked before any pixel comparison.
The controller's clear controls are inline in 1.6.8-beta.3
(`ClearButtons.svelte`), so `clear_entries` enumerates them there; there is no
pop-up menu to open. If Playwright cannot screenshot the output window, the
driver asks the main process for `capturePage()` and records which route produced
the file; if both fail it records the error rather than dropping the window.
Every further output window is captured to `NN-<step>-output-2.png`,
`-output-3.png`, … by the same two routes.

**The profile is disposable.** `/tmp/opencode/fs-store` and
`/tmp/opencode/fs-data` are deleted and reseeded on every run (the paths are
overridable with `--store` and `--data`, and must stay under `/tmp` or
`/var/tmp`). Nothing from a previous run is read, so do not run two observers
against the same paths at once. The reference checkout is never written to.

The seeded shows come from `parity/fixtures/` (`parity-three-slides.show`,
`parity-with-notes.show`, `parity-transitions.show`), so a fresh machine needs
no manual copy. `parity-with-media.show` is seeded too only if every absolute
media path it references exists; otherwise `seed.json` records it as skipped
rather than presenting a broken show.

**Fixture group repair.** FreeShow stores a slide group as a parent slide plus
the child ids in the parent's `children` array. The committed fixtures express a
group only as `group: "."` on the first slide and `group: null` on the rest, with
no `children`. FreeShow's loader (`fixShowIssues`, `converters/importHelpers.ts`)
deletes every `group: null` slide it cannot find in a parent's `children`, so the
reference sees a **one-slide show** and Next leaves the show. The driver adds the
missing `children` links in the **scratch-profile copy only** and records them in
`seed.json` (`groupRepairs`); the committed fixture, the scenario and the
reference checkout are untouched. The fixtures should be fixed at the source,
and the reader should record the loader rule; until then, a run without the
repair observes a one-slide show.

## Observing media and output styles

Two more scenarios cover the Tier 1 media and output-style features. They need
media files, which do not exist on a clean machine, so the driver generates them:

```bash
node parity/tools/generate_media.mjs            # once, or let the driver do it
node parity/tools/observe_reference.mjs /tmp/opencode/observe-media-$(date +%F) --scenario media-behaviour
node parity/tools/observe_reference.mjs /tmp/opencode/observe-styles-$(date +%F) --scenario styles-multi-output
```

`generate_media.mjs` writes two deterministic files into `/tmp/opencode/media`:
`video-bg.webm` (WebM VP9 + Opus, 1280×720, 3 s, solid red → green → blue with a
quiet 440 Hz sine) and `logo.png` (320×180 magenta with a white border). The audio
track is required: the reference detects the end of a background from an
`HTMLAudioElement` (`media/video/videoPlayer.ts:344-360`), so a silent file would
fall back to a ticker. The driver calls the same module at seed time, so both
scenarios work from a cold `/tmp`.

- **`media-behaviour`** seeds the media fixture (repointed at the generated files),
  a `mediaFolders` entry, and a media project item. It records `media.play`,
  `media.background`, `media.controls` and `media.next-finished`. The clip is
  paused through the strip right after `start` so a 3 s clip still has time for the
  later steps; the next-after-media step resumes it and records how long the
  advance took relative to the clip's remaining time.
- **`styles-multi-output`** seeds `settings_synced.json` with three styles and three
  normal outputs bound to them (`lines: 2`, `aspectRatio 4:3`,
  `layers: ["slide","overlays"]`), and a show built in memory whose first slide has
  four text lines and an image background. It records `out.styles`,
  `out.styles.aspect`, `out.styles.lines` and `out.styles.layers` from each
  output's content-box geometry, visible text lines and rendered `img.media`/`video.media`.

**What the observations rest on.** The output windows stay hidden on this machine,
so nothing here reads pixels. `readOutput` now also returns each page's
`videos[]` (`src`, `loop`, `paused`, `muted`, `currentTime`, `duration`,
`readyState`, `videoWidth`, `videoHeight`), `images[]`, `contentBox` (the
`.zoomed .slide` rect, which carries the style's `aspect-ratio`) and `viewportBox`
(the `.zoomed` rect). `readController` now also returns the media control strip
(`title` + `disabled` per button, plus the revealed layer and the media name) and
the media drawer's folders/cards.

**The two shapes the reader could not resolve, now read from the source:**

- A dropped layout-slide background is a **media id**, not an object. The
  `showMedia` history handler adds the dropped media to `show.media` and stores
  that entry's key in `layouts[layout].slides[i].background`
  (`src/frontend/components/helpers/history.ts:110-142`); a child slide's layout
  data lives under the parent entry's `children[childId]`. `checkNextAfterMedia`
  then reads `layoutSlide.data.background` and
  `layoutSlide.data.actions.nextAfterMedia`
  (`helpers/showActions.ts:690-716`). The scratch copy of the fixture is written
  in that shape; the committed fixture is untouched.
- The output `<video>` is **hardcoded muted** (`media/Video.svelte:263`), so
  `video.muted` is always true and is not evidence of the stored muted state. The
  driver reads the mute state from the strip's button title (`Mute` when the
  player is unmuted, `Unmute` when it is muted; `MediaControls.svelte:152`,
  `Show.svelte:112`). `loop` *is* DOM-observable: the element's `loop` attribute is
  bound to the player's `videoData.loop` (`media/Video.svelte:73,263`).

**The strip's reveal control** (the reader's `unknown`) is the per-layer clear
selection: `Preview.svelte:281-282` renders `MediaControls` only while the
revealed clear layer is `background`, and the layer's disclosure button
(`data-title` "Background", `ClearButtons.svelte:148`) is what selects it. The
media scenario records the strip absent at `open_show` and present after the
Background layer is selected.

The button titles are the reference's English labels (`public/lang/en.json`), so
the media scenario assumes an English dictionary; `run.json` records the locale.

Two reference traps this driver had to handle, in case the next driver meets
them again:

- `#output_window` is a **class token** (`class="fill context #output_window"` in
  `MainOutput.svelte`), not an HTML id. Selecting `#output_window` matches
  nothing; use `[class~="#output_window"]` or the output window's
  `main.background`.
- Opening a show from the project can leave FreeShow's `selected` store set. In
  1.6.8-beta.3 the global Escape handler clears that selection 20 ms after the
  preview's handler calls `clearAll`, so the first Escape may only deselect and a
  second may be needed to clear. `steps.json` records `escapePresses` and
  `firstEscapeCleared` for every run, so the two cases are distinguishable
  without guessing.

Runs at the pin, all `outputs-basic`, evidence under
`reports/evidence/observe-outputs-2026-11-11-*`:

| Run | Result | Output captures | Output window |
| --- | --- | --- | --- |
| 2026-11-10, hidden X11 workspace, 1920×1080 | 11/11 | 21 | never mapped (`isVisible()` false) |
| 2026-11-11, same workspace, hardened driver | 11/11 | 21 | never mapped (`isVisible()` false) |
| 2026-11-11, Wayland/KDE desktop with an RTX 5060 Ti | 11/11 | 0 | never mapped (`isVisible()` false) |

The 2026-11-10 note that "a desktop run with a GPU should show the window" was
wrong: the reference kept the output hidden in both environments — one display
and two — for the reason in the section above. Read `run.json` and
`browserWindows[].visible` before claiming a window was on screen.

Two diffable facts from the desktop run: it passed `open_show` once the startup
popup was dismissed, and every output capture failed there while the controller
captures succeeded — the environment, not the scenario, decides whether an
output frame is available.

## Not built yet

- `tools/run.mjs` — the runner and gate.
- `adapters/freeshow` — Playwright Electron, main-window DOM as the oracle.
  `tools/observe_reference.mjs` is the first slice of it (present, start, lock,
  clear); it does not yet implement the scenario vocabulary or a normalised
  state, and it records what the reference did rather than comparing it.
- `adapters/cjcrsg` — headless Chromium against the renderer web build.
