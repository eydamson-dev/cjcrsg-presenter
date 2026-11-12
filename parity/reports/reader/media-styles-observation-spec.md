# Observation specification — media + out.styles (Tier 1, stage 1 Read)

Date: 2026-11-12
Reference: FreeShow `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (1.6.8-beta.3).
Reference checkout: read-only, `~/projects/reference/freeshow`.
Role: `reader`. This is a **pre-run specification**, not a run report and not a
relabel pass. No reference page is edited here; relabelling to `observed` happens
in a later session after the run. The harness (`parity/tools/observe_reference.mjs`)
is owned by `harness-engineer` and is **not** edited by this spec.

The slice: upgrade the Tier 1 features still labelled `code`/`unknown` to
`observed`, for **media** (`media.play`, `media.background`, `media.controls`,
`media.next-finished`; page `docs/freeshow-reference/drawer/media.md`) and
**output styles** (`out.styles`, `out.styles.aspect`, `out.styles.lines`,
`out.styles.layers`; page `docs/freeshow-reference/outputs/styles.md`).
`audio.play` is Tier 2 and out of scope; the status line's "audio" here means the
**audio track of a media file** (muted-vs-unmuted background video), which is what
these claims ride on.

---

## 0. How the reference is currently driven (context for the harness author)

From `parity/tools/observe_reference.mjs` (read 2026-11-12, not edited):

- Scratch profile: `--store /tmp/opencode/fs-store`, `--data /tmp/opencode/fs-data`,
  deleted/reseeded each run; `assertScratchPath` refuses paths outside `/tmp`/`/var/tmp`.
- Stores live **beside `config.json`** under `--store` (electron-store cwd
  `FS_MOCK_STORE_PATH`), not under `--data`. `SETTINGS → settings.json`,
  `SYNCED_SETTINGS → settings_synced.json`, `PROJECTS → projects.json`,
  `STAGE → stage.json` (`src/electron/data/store.ts:30-53`). Shows go in
  `--data/Shows/*.show` as `[id, show]`.
- `styles` is a **synced setting**: `defaultSyncedSettings.styles = {}`
  (`src/electron/data/defaults.ts:108`), persisted in `settings_synced.json`
  (`store.ts:35`; `save.ts` writes `data.SYNCED_SETTINGS`). The current driver seeds
  `settings.json`, `projects.json`, `themes.json`, `templates.json`, `config.json`,
  `stage.json` — **it does not seed `settings_synced.json`**. That file must be added
  for this slice.
- Outputs are seeded into `settings.json` `outputs` (`seedMultiOutput`,
  observe_reference.mjs:246-303), each with `style: "default"`. `"default"` is a
  literal id with no entry in `styles`; an unresolved style falls back to the
  built-in default (`helpers/output.ts:1856-1861`).
- Media fixture: `parity-with-media.show` is `OPTIONAL_MEDIA_FIXTURE` and is only
  seeded when **every** `show.media[].path` exists on disk
  (observe_reference.mjs:324-332). Its paths are currently `/srv/freeshow/media/…`,
  which do **not** exist on this machine today — so it is skipped. The harness must
  (a) write the media files under `/tmp/opencode/media/` and (b) point the fixture's
  absolute paths there.
- `readOutput` (observe_reference.mjs:650-687) captures per-output `text`, `lines`,
  `mainBackground`, `rootClass`, `outputId` (the `.zoomed[id]`), `stageArea`. It does
  **not** capture media-element or geometry state. `readController`
  (observe_reference.mjs:551-648) captures clear buttons, project items, preview
  tiles, toasts, lock titles. Neither captures the media control strip.

## 1. Scope table

"Observed" for each claim means: a recorded run at the pin performs the semantic
action and records a state that proves the claim, with the artefact kept. Claims
are quoted from the reference page and cited to the underlying source (both
`path:line`s given). Claims **in** are the ones this slice should upgrade; claims
**out** are excluded deliberately and stay `code`/`unknown`.

### `media.play` — page `drawer/media.md` §"Play media" (confidence `code`)

| In / out | Claim (quoted) | Citation | What "observed" means |
| --- | --- | --- | --- |
| IN | "A single click on a card returns immediately if Ctrl/Cmd/Shift is held, the output is locked, a double-click is pending, or an icon button was the target" | `MediaCard.svelte:111-118` (media.md:147-149) | Only the **plain single-click with nothing held and unlocked** branch is exercised; the lock-blocked branch is covered by a lock step (see `media.play` "playing refused while locked" row). Ctrl/Cmd/Shift-hold and the "double-click pending" early-return are **out** (timing-dependent, see risks). |
| IN | "If any active output's background already has this path or id, the click clears the background instead" | `MediaCard.svelte:120-126` (media.md:150-151) | Click a card → background appears; click the **same** card → background is gone. Assert `<video>`/`<img>` present, then absent (or background cleared). |
| IN | "Otherwise it … sends a background to **every active output** … `setOutput("background", { path, type, loop, muted, startAt: 0, … })`" | `MediaCard.svelte:128-140` (media.md:152-154) | With ≥2 active outputs, a drawer click must put the background on each active output (fan-out). This is only asserted if the media scenario runs on the multi-output seed; on the single-output seed, "every active output" degenerates to one output (still observed, weaker). |
| IN | "Defaults in this path: `loop = contentProvider || videoType === "foreground" ? false : true`, and `muted = videoType === "background"` … a file with no folder/file type loops and is **not** muted when clicked in the drawer" | `MediaCard.svelte:129-130` (media.md:155-158) | Click a no-type card → the background player reports `loop === true` and `muted === false`. |
| OUT | "A foreground file clears the current slide first (`ignoreLayer`) … and does not loop" | `MediaCard.svelte:132-133` (media.md:159-160) | Requires a file typed `foreground` (folder `mediaType` or `videoType`). Optional; can be included if the harness seeds a foreground-typed folder, otherwise stays `code`. |
| IN (weak) | "Double-click adds `{ id, name, type }` to the project via `addProjectItem`" | `MediaCard.svelte:151-157` (media.md:161-163) | `page.dblclick` on a card → the project's show list gains the media item. Flagged **weak** because MediaCard defers single-click for a double-click timer (media.md:147-149), so a synthetic dblclick must be timed to register; if flaky, seed the project item directly and mark the double-click handler `code`. |
| IN | "Playing is refused while the output is locked" | `MediaCard.svelte:112` (media.md:168) | Lock the output, click a card, assert no background appears; unlock, click, assert it does. |
| OUT | Search-field Enter / Ctrl+Enter (media.md:164-165) and Ctrl/Cmd+Left/Right preview highlight (media.md:166-167) | `Media.svelte:382-453` | Separate interaction surface (drawer search + arrow preview). Not needed to establish the click contract. |

Open question to settle (media.md:207-209): "Whether a click on a card also sets
the preview (`activeShow`)". A run that clicks a card and reads the preview pane
(right column) can answer this; it is a cheap add to the click step.

### `media.background` — page `drawer/media.md` §"Media as background" (confidence `code`)

| In / out | Claim (quoted) | Citation | What "observed" means |
| --- | --- | --- | --- |
| IN (renderer half) | "On a slide drop the data is normalised with a default `backgroundData = { muted: true, loop: true }`" | `dropActions.ts:710-711` (media.md:657) | Seed a layout slide whose background is the video with `{ muted: true, loop: true }` (the post-drop state) and observe the player honours it: `<video>.loop === true`, mute button reports muted, `currentTime` advances. **The drop action itself is not driven** — see §4 note; the *normalisation* stays `code`, the *renderer honouring the defaults* becomes `observed`. |
| OUT | Layer-type resolution (`foreground` when several files dropped away from centre, providers forced `foreground`) | `dropActions.ts:700-721` (media.md:658-660) | Multi-file/provider drop. Not seeded; stays `code`. |
| OUT | "A `foreground` video becomes `{ muted: false, loop: false, videoType: "foreground" }`" | `dropActions.ts:718-720` (media.md:661-663) | Same foreground-typing prerequisite as `media.play` OUT row. |
| OUT | Centre-drop vs Ctrl-drop slide-background mechanics | `dropActions.ts:727-759` (media.md:664-666) | Drag/drop mechanics. Stays `code`. |
| IN | "**Project media is different**: playing a media item from a project reads per-item `loop`/`muted` if present, else loops and mutes only when the layer is `background`, else neither … a project video plays unmuted and **without looping** by default" | `shortcuts.ts:531-542` (media.md:669-672) | Seed a project media item (or add via dblclick) with no type, play it, observe `loop === false`, `muted === false`. This is the contrast to the drop default. |
| IN | "Clicking the same media in the drawer uses yet another default: loop unless foreground, mute only when the type is explicitly background" | `MediaCard.svelte:129-130` (media.md:673-674) | Already covered by `media.play` "Defaults in this path" row; recorded once, cited to both. |

Open question to settle (media.md:716-719): "Whether the project-item editor exposes
`loop`/`muted` as toggles." A run can answer this only by opening the project-item
editor; it is **out of the core scenario** and noted as an optional add.

### `media.controls` — page `drawer/media.md` §"Video controls" (confidence `unknown`)

The section's own bullets carry `code` citations to `MediaControls.svelte`, yet the
section confidence is `unknown` (media.md:729) — the page flags that the whole strip
was not exercised end to end and its reveal control was not traced. A run can upgrade
the code-cited bullets **and** settle the `unknown` reveal question.

| In / out | Claim (quoted) | Citation | What "observed" means |
| --- | --- | --- | --- |
| IN | "The component only renders when the output has a background" | `MediaControls.svelte:114` (media.md:747) | No strip before a background is set; strip present after. |
| IN | "It subscribes to `videoSync(path, outputId)` and mirrors `currentTime`, `duration`, `paused`, `loop` and `muted` from the player" | `MediaControls.svelte:38-60` (media.md:748-749) | Read the strip's play/pause + loop + mute button state and the seek slider value; assert they track the player (`<video>.paused/.loop/.currentTime`). |
| IN | "Play/pause calls `VideoPlayer.play/pause`" | `MediaControls.svelte:101-109` (media.md:750) | Click the strip play/pause; assert `video.paused` flips. |
| OUT | "±10 s clamps" (`+10 s → duration−0.1`, `−10 s → 0.01`, −10 s only in the big variant) | `MediaControls.svelte:129-144` (media.md:750-751) | Seek slider dragging / ±10 s buttons are fragile to automate and need a long-enough video; leave `code` unless the harness finds a stable click target. |
| IN | "Loop and mute call `VideoPlayer.toggleLoop` / `toggleMute` … they change the live player, not the stored media style" | `MediaControls.svelte:74-88` (media.md:752-754) | Click loop → `video.loop` flips; click mute → the mute button title flips (`actions.mute` ↔ `actions.unmute`); assert the show's stored `media[path]`/style is unchanged (no save write). |
| OUT | "The media name is a button that opens the media preview" | `MediaControls.svelte:90-99,158-164` (media.md:755) | Preview navigation; not needed for the control contract. |
| IN | "All play/pause/mute buttons are disabled while the output is locked; loop is not" | `MediaControls.svelte:119,148-154` (media.md:757-758) | Lock the output; assert play/pause/mute buttons `disabled`, loop button not. |
| UNKNOWN → settle | "Which control shows/hides the strip (the doc's 'almost invisible button')" | (media.md:788-791) | Observe how the strip becomes visible under the clear buttons; record the control (button class/`data-title`) that reveals it. If it cannot be identified, record that and keep `unknown`. |

### `media.next-finished` — page `drawer/media.md` §"Next on media finished" (confidence `code`)

| In / out | Claim (quoted) | Citation | What "observed" means |
| --- | --- | --- | --- |
| IN | "The flag lives on the layout slide: `layoutSlide.actions.nextAfterMedia`" | `Actions.svelte:132`; `loadItems.ts:189` (media.md:819-821) | Seed `nextAfterMedia: true` on the slide's layout entry; the run observes the *effect* (advance on end), not the menu item (menu UI is out). |
| IN | "On every end check the player first calls `checkNextAfterMedia(path, "media", outputIds)` and returns if it advanced; only then does it consider looping … That ordering is why it fires while looping." | `videoPlayer.ts:362-374` (media.md:822-826) | A slide with a **looping** background video (`loop: true`) **and** `nextAfterMedia: true`: after ~one duration the output advances to the next slide. This is the headline claim. |
| IN | "The same check is repeated after the loop branch" | `videoPlayer.ts:404-407` (media.md:824-826) | Covered by the same run (the advance still happens whether the first or second check fires); not separately isolated. |
| IN | "`checkNextAfterMedia` only advances if the current output's slide actually contains the ended media, then … guards against a second advance for 600 ms" | `showActions.ts:676-728` (media.md:827-829) | Assert exactly one advance (slide index +1, not +2) within the observation window. The "slide contains the media" guard is exercised implicitly (the media IS on the slide). |
| OUT | "When the media has no next-after flag and is not looped, the background is cleared after 200 ms unless `special.clearMediaOnFinish === false`" | `videoPlayer.ts:409-423` (media.md:830-831) | Requires a non-looping, non-nextAfter background. Can be a cheap extra step (clear-on-finish); otherwise stays `code`. |
| OUT | The audio/timer reuse of `nextAfterMedia` (`showActions.ts:694-713`, media.md:833) | — | `audio.play` and timers are Tier 2. |

Open question to settle (media.md:866-869): "does a foreground video trigger it"
(whether the check runs for foreground media that is not the background). The guard
requires the slide's `background` to match (`showActions.ts:704-705`), so the code
says no; a run with a foreground video and `nextAfterMedia` would confirm. Include as
an optional extra step; not required for the gate.

### `out.styles` — page `outputs/styles.md` §"`out.styles` — the style object" (confidence `code`)

| In / out | Claim (quoted) | Citation | What "observed" means |
| --- | --- | --- | --- |
| IN | "`styles` is a store keyed by style id … An output points at one with `outputs[id].style`; no style means 'default'" | `stores.ts:380`; `output.ts:1856-1861` (styles.md:26-28) | Two outputs point at two different seeded styles and render differently (different aspect / lines / layers). Proves per-output look applied to the same shared content. |
| IN | "Applying or changing a style calls `refreshOut()` so every output re-renders" | `OutputsTabs.svelte:51`; `output.ts:761-769` (styles.md:38-39) | Only observable if the run edits a style in Settings > Styles and watches an output re-render. Keep as a **soft** in-scope item: seed-first observation proves the attach, not the live refresh; flag if the live-edit step is skipped. |
| OUT | Style field list (`Settings.ts:13-37`) and the background-layer internals (`Output.svelte:334,348`) | styles.md:29-33,40-44 | Structural; the specific per-field behaviours are covered by the four sub-features below. |

### `out.styles.aspect` — page `outputs/styles.md` §"`out.styles.aspect`" (confidence `code`)

| In / out | Claim (quoted) | Citation | What "observed" means |
| --- | --- | --- | --- |
| IN | "Default is 16:9" | `Styles.svelte:75-76`; `output.ts:854` (styles.md:48) | The no-style / default output renders 16:9 content; the 4:3 output renders 4:3. |
| IN | "The content is scaled inside the style ratio; media fit defaults to `contain`" | `Styles.svelte:93,167` (styles.md:55) | A 4:3 style on a 1920×1080 output renders a content box of ~1440×1080 (letterboxed), vs 1920×1080 for 16:9. Read the rendered content-box geometry (see §5 fallback). |
| IN | "The rendered output resolution is computed from the style ratio and the output bounds" | `output.ts:871-912` (styles.md:60-62) | Same as above: assert the content box matches ratio×bounds. |
| OUT | Preset list (`AspectRatio.svelte:13-28,71-78`) | styles.md:49-50 | UI enumeration; a single seeded non-default ratio proves the mechanism. |
| OUT | `outputResolutionAsRatio` (follow the window bounds) and `fontSizeRatio` scaling | `AspectRatio.svelte:92`; `output.ts:840-852` (styles.md:51-54,58-59) | Needs a live toggle + font-metric read; leave `code`. |

### `out.styles.lines` — page `outputs/styles.md` §"`out.styles.lines`" (confidence `code`)

| In / out | Claim (quoted) | Citation | What "observed" means |
| --- | --- | --- | --- |
| IN | "`lines` is a per-style number, default 0 = all lines" | `Settings.ts:27`; `Styles.svelte:96` (styles.md:66-67) | `lines:0` output shows the full slide text; `lines:2` output shows a 2-line window. |
| IN | "Each output computes its own visible window from `style.lines`: `start = lines * floor(linesIndex / lines)`, `end = start + lines`; 0 returns `null/null`, meaning the whole slide" | `output.ts:1968-2023` (styles.md:71-74) | A 4-line slide on the `lines:2` output shows exactly lines 1-2, then (after one advance) lines 3-4; the `lines:0` output shows all 4 throughout. |
| IN | "**The paging step, however, is shared:** … the smallest non-zero limit across the *active* outputs whose style shows the slide layer … So a 2-line output makes the whole presentation page 2 lines at a time, while another output with `lines:0` still shows the full slide on each page." | `showActions.ts:163-182`; `OutputHelper.ts:427-441` (styles.md:75-80) | Advance the show once; assert the `lines:0` output stays on slide 1 (now showing lines 3-4 = the full slide of page 2), not "all lines in one frame". |
| OUT | `showAsFaded` dimming and `skipVirtualBreaks` | `Settings.ts:28-30` (styles.md:81-83) | Rendering details; `showAsFaded` is itself an open question (styles.md:204). |

### `out.styles.layers` — page `outputs/styles.md` §"`out.styles.layers`" (confidence `code`)

| In / out | Claim (quoted) | Citation | What "observed" means |
| --- | --- | --- | --- |
| IN | "`layers` is a subset of `background`, `slide`, `overlays` … absent means all three" | `Settings.ts:12`; `output.ts:1854`; `Styles.svelte:91` (styles.md:87-89) | A style with `layers: ["slide","overlays"]` hides the background layer; a style with no `layers` shows all three. |
| IN | "Turning the background layer off **also** changes item rendering: a media item with no path is filled with the slide's background" | `MediaItem.svelte:23-42,74-83` (styles.md:94-95) | Seed a slide with a background media (image). Assert the `layers:["slide","overlays"]` output does **not** render the background media while the default output does. |
| OUT | "PDF is drawn by the background layer; PPT by the slide layer" | `Output.svelte:441-450` (styles.md:97-98) | PDF/PPT import path; not seeded. |
| OUT | The three toggle buttons' UI (`Styles.svelte:111-116,170`) | styles.md:90-91 | UI enumeration; the seeded `layers` value proves the behaviour. |

---

## 1a. Correction after the run (2026-11-12)

Added after both runs passed. It corrects one pre-run prediction and records what
the run actually showed. The table row above is left as written so the error stays
visible; audit `A-009`.

- **`out.styles.lines`, shared-paging row — the prediction was wrong.** The spec
  said the `lines:0` output would stay on slide 1 "now showing lines 3-4 = the
  full slide of page 2". The run shows it keeps rendering **all four lines** on
  every page: its window is `null/null`, so the page index does not change what
  it renders
  (`parity/reports/evidence/observe-styles-multi-output-2026-11-12-xvfb/08-styles-lines-paging.json`,
  assertion "the lines:0 output still shows the whole slide: its window is
  null/null, so the page does not change it"). What *is* true from the row: one
  advance moved the `lines:2` output to lines 3–4 and the presentation stayed on
  slide 1, because the 2-line output set the shared page size. A scenario must
  expect all lines on the `lines:0` output, not lines 3–4.

---

## 2. Fixture / media requirements

Media files do **not** exist on this machine today. The harness must generate them
(ffmpeg is acceptable; the harness may also check in tiny generated fixtures, but
they must be reproducible) and write them under `/tmp/opencode/media/`, then update
`parity/fixtures/parity-with-media.show` so its `media[].path` values are those
absolute paths (the current `/srv/freeshow/media/…` values are skipped as missing).

| File | Format / codec | Size / duration | Content | Why |
| --- | --- | --- | --- | --- |
| `video-bg.webm` | WebM **VP9** (+ Opus audio) — fall back to **VP8** if VP9 fails to decode | 1280×720, ~**3.0 s**, ~1 Mbit/s | Solid-red first frame → solid-blue last frame, distinct mid-frame; a quiet **440 Hz sine audio track** (~-20 dB) | Video background for play/controls/next-finished. The audio track makes (a) `muted` meaningful and (b) the end-of-media detection deterministic (see §5). First/last-frame distinction lets a human confirm the clip actually decoded to the end if a screenshot is ever possible. |
| `logo.png` | PNG (any; no codec risk) | ~320×180 | Magenta (#ff00ff) square with a white border | Image background for `media.play` click/clear and `out.styles.layers` (background layer off hides it). Colour is unambiguous against the default black backdrop. |

Both files' absolute paths appear in the fixture's `media` entries and in the
drawer-folder seed.

### Seed requirements

1. **`settings_synced.json`** (new file under `--store`, beside `settings.json`):
   `styles` key with the two named styles (see scenario B for bindings):
   - `style-lines2` → `{ name: "Two lines", lines: 2 }`
   - `style-43` → `{ name: "Four-three", aspectRatio: { width: 4, height: 3 } }`
   - `style-nobg` → `{ name: "No background", layers: ["slide", "overlays"] }`
   The `aspectRatio` shape is `{ width, height }` (`src/types/Settings.ts:47-55`).
2. **`settings.json`** additions (beside the existing `outputs`, `outLocked`,
   `disabledServers`, `initialized`):
   - `mediaFolders` → a folder id mapping to `{ name: "Parity Media", icon: "folder", path: "/tmp/opencode/media" }` so the Media drawer lists the two files
     (folder shape from `dropActions.ts:608-622`; listing via `Main.READ_FOLDER`,
     `MediaTabs.svelte:29-42`).
   - Output `style` bindings per scenario (see below).
3. **`parity-with-media.show`** (existing `OPTIONAL_MEDIA_FIXTURE`, paths updated):
   - `media.m-bg.path = /tmp/opencode/media/video-bg.webm`, `media.m-logo.path = /tmp/opencode/media/logo.png`.
   - Slide 1 (`fx-1`) gains a **layout slide background** = the video with
     `{ muted: true, loop: true }` (the post-drop state; shape resolved by the
     harness author from the `showMedia` history handler or a one-off reference
     drop + file dump — see §4). Slide 1 also gains `actions.nextAfterMedia: true`
     on its layout entry.
   - Slide 2 (`fx-2`) is the advance target for `media.next-finished`.
4. **Project media item** for the `media.background` project-item path: a media
   entry `{ id: "m-bg", name: "background", type: "media" }` in
   `projects.json` → `projects.parity.shows`, OR rely on the dblclick-to-add path.
   Prefer seeding (deterministic); dblclick is the fallback.
5. **Styles scenario fixture** (recommend a new `parity-styles.show`, or extend
   `parity-three-slides.show`):
   - Slide 1: **4 text lines** (so `lines:2` paging is observable in two pages) **plus**
     a layout-slide background = `logo.png`.
   - Slide 2: 2 text lines.
   - Two normal outputs (reuse `seedMultiOutput`'s `primary`/`secondary`) with
     `style` bound as in scenario B.

---

## 3. Scenarios

Recommend **two scenarios** rather than one: media is single-output and driven
mostly through the drawer/show; styles needs two outputs with distinct styles.
They share the media-file + folder seed.

### Scenario A — `media-behaviour` (one output)

Output: the default single `Primary` (`settings.json` outputs default) or a
single seeded output. Fixture: `parity-with-media.show` (updated). Drawer folder:
`/tmp/opencode/media`.

Ordered steps (semantic action → assertion; `name`/`purpose`/`verify` shape, to be
turned into `stepX`/`verifyX` by the harness author):

1. **ready / open_project / open_show / present / start** — reuse the existing
   `outputs-basic` helpers (observe_reference.mjs:1104-1277). After start, the
   output shows slide 1's text.
2. **media.background (slide background default)** — slide 1 already has the video
   background (`{muted:true, loop:true}`). Assert on the output page: a `<video>`
   element exists with `loop === true`; `currentTime` advances between two reads
   (playing); the mute control reports muted (via the strip/Show tool button title,
   not `<video>.muted` — see §5).
   → upgrades `media.background` renderer half + `media.controls` claim 1 (strip
   present when a background exists).
3. **media.controls play/pause** — locate the strip under the clear buttons (or the
   Show Media tool); click pause → `<video>.paused === true` and the button reports
   play; click play → `paused === false`, `currentTime` resumes.
4. **media.controls loop/mute** — click loop → `<video>.loop` flips; click mute →
   the mute button title flips (`actions.mute` ↔ `actions.unmute`). Assert the
   stored `media[path]`/style is unchanged (no persist).
5. **media.controls lock-disable** — lock the output; assert play/pause/mute buttons
   `disabled` and loop not; unlock.
6. **media.next-finished (loop-and-still-advance)** — slide 1 background is looping
   (`loop:true`) **and** has `nextAfterMedia:true`. Wait ≤ ~duration + margin; assert
   the output advanced exactly one slide (slide 1 → slide 2 text). Record the
   elapsed time so the advance is tied to the clip length, not a fixed sleep.
   → upgrades the ordering claim (videoPlayer.ts:362-374).
7. **media.play click / clear** — open the Media drawer; single-click the
   `video-bg.webm` card → a background appears on the active output with
   `loop === true`, `muted === false` (the no-type drawer default); click the same
   card again → background cleared.
   → upgrades `media.play` claims 1-4. (Optional: also click `logo.png` to confirm
   the image path uses the same click/clear.)
8. **media.background project-item path** — play the seeded media project item;
   assert `loop === false`, `muted === false` (no-type project default).
   → upgrades `media.background` claim 6.
9. (Optional) **media.next-finished foreground** — a foreground video with
   `nextAfterMedia` should NOT advance; settles the media.md:866 open question.

### Scenario B — `styles-multi-output` (two normal outputs)

Outputs: `primary` → `style-43` (4:3) — or split aspect onto a dedicated style and
lines onto another; the bindings below keep each sub-feature independently
assertable:

- `primary` → `style-lines2` (`lines: 2`), aspect default 16:9.
- `secondary` → `style-43` (`aspectRatio: 4:3`), `lines: 0`.
- For layers, add a **third** output `tertiary` → `style-nobg`
  (`layers: ["slide","overlays"]`), or — to avoid a third output — re-bind
  `secondary` to `style-nobg` and put 4:3 on `primary` alongside `lines:2`
  (`style-43` and `style-lines2` are then one style). The harness author may
  combine; the spec requires only that each claim has one output exercising it and
  one default/contrast output.

Ordered steps:

1. **ready / open_project / open_show / present_outputs / start** — reuse the
   `stage-multi-output` seeding and present helpers, but with the styles fixture.
   Assert all outputs render (page reads `outputId`).
2. **out.styles.aspect** — assert the 4:3 output's rendered content box is
   4:3-shaped (e.g. ~1440×1080 on a 1920×1080 window) vs the 16:9 output's
   1920×1080. Read content-box geometry (harness extension, see §5).
3. **out.styles.lines (per-output window)** — slide 1 has 4 lines; assert the
   `lines:2` output shows exactly lines 1-2 and the `lines:0` output shows all 4.
4. **out.styles.lines (shared paging)** — advance once; assert the `lines:0` output
   still shows the full slide (now page 2 = lines 3-4) rather than "all lines in
   one frame"; assert the `lines:2` output now shows lines 3-4. This proves the
   shared `getFewestOutputLines` step (showActions.ts:163-182).
5. **out.styles.layers** — slide 1's background is `logo.png`; assert the
   `style-nobg` output does not render the background media (no `<img>`/`<video>`
   for it, and/or the base backdrop differs) while the default-layer output does.
6. **out.styles (attach)** — the differing aspect/lines/layers across outputs, all
   reading the same show, is the evidence that the style attaches per output
   (`outputs[id].style`). Optionally open Settings > Styles and change one field,
   asserting the output re-renders (refreshOut, styles.md:38-39) — a soft step.

---

## 4. Open questions the run should settle

From each page's "Open questions", with whether a run can answer it:

- **media.play** (media.md:207-209): does clicking a card also set the preview
  (`activeShow`)? → read the right preview pane after a card click. Answerable.
- **media.background** (media.md:716-719): does the project-item editor expose
  `loop`/`muted` toggles? → open the project-item editor. Answerable but UI-heavy;
  optional.
- **media.controls** (media.md:788-791): which control shows/hides the strip (the
  "almost invisible button")? → observe how the strip appears once a background is
  set. **Answerable and required** — this is the `unknown` that the feature
  confidence hangs on.
- **media.next-finished** (media.md:866-869): does a **foreground** video trigger
  `nextAfterMedia`? → seed a foreground video + flag and observe no advance.
  Answerable; optional.
- **styles** (styles.md:202-210): `showAsFaded`/`lineOpacity` rendering and whether
  faded lines still count toward paging (`unknown`); `fontSizeRatio` exact scaling
  (`unknown`); deleting a style still referenced by an output (`unknown`). A run
  using `showAsFaded`/`lineOpacity` is the only way to answer the first; the others
  need UI edits (font-size slider, style delete). All **out of the core scenario**,
  noted for a later slice.

### Ambiguities the reader could not resolve from source (flagged, not guessed)

- The exact on-disk shape of a **layout-slide background** after a drop
  (`layouts[layout].slides[i].background` vs a media-id reference). The drop site
  (`dropActions.ts:727-759`) sets `h.newData = data[0]` = `{path, muted, loop, …}`,
  but the history handler that applies it was not traced. The harness author must
  resolve it by reading the `showMedia` history handler **or** doing one manual
  drop in the reference and dumping the `.show` file. If unresolved, seeding the
  background is itself `unknown` and the renderer-half observation cannot run.
- The **muted** observable: the output `<video>` element has a hardcoded `muted`
  attribute (`media/Video.svelte:263`), so `video.muted` is always `true` and is
  **not** evidence of the stored muted state. The muted state lives in the player
  (`videoData.muted`) and is surfaced by the strip/Show-tool mute button title
  (`actions.mute` ↔ `actions.unmute`; `MediaControls.svelte:152-153`,
  `Show.svelte:112-113`). The harness must read the **button**, not the `<video>`.
- **loop** *is* DOM-observable: `video.loop` is bound to `videoData.loop`
  (`media/Video.svelte:263`, `:73`). This is the reliable loop signal.

---

## 5. Codec / environment risks

What must be verified **before** the run is trusted, and the fallback evidence when
pixels are unavailable.

1. **Video codec.** The repo trap (Playwright's Chromium has no H.264) does **not**
   directly apply — the reference runs in its own Electron, and the harness drives
   Electron, not Playwright's bundled Chromium. Electron's stock ffmpeg build
   excludes proprietary codecs (H.264/AAC), so an `.mp4` H.264 background likely
   will **not** decode in the pinned reference. **WebM VP9 (+Opus)** is the house
   format (FreeShow's own recorder writes `video/webm; codecs=vp9,opus`,
   `media.md:572`). Verify at runtime: the output `<video>` reaches
   `readyState >= 2` and `duration > 0`; if VP9 fails, fall back to VP8 (which
   every Chromium/Electron decodes).
2. **End-of-media detection is audio-driven.** `VideoPlayer.checkIfEnding` reads an
   `HTMLAudioElement`'s `currentTime`/`duration` and returns early when
   `endingTime <= 0` (treated as a live stream, `videoPlayer.ts:344-360`); the
   `ended` listener (`:281-317`) is the deterministic path, with a virtual
   `timeTick` fallback for audio-less files (`:292-307`). The next-finished video
   **must carry an audio track** so `ended` fires cleanly and the
   loop-and-advance ordering (`:282-289`) is exercised. A silent WebM risks the
   claim becoming unobservable (or flaky via the ticker fallback). Verify: the
   output's media audio `duration` is the clip length, not `Infinity`.
3. **Screenshot failure on llvmpipe.** The prior `stage-multi-output` run recorded
   32 capture problems: Playwright `page.screenshot` timed out on llvmpipe and the
   output windows are created hidden (`visible:false`). A **video background is
   even less likely** to produce a usable still (a decoded frame may not paint to
   the offscreen surface the way text does). Therefore:
   - **Fallback evidence = DOM/player state**, not pixels: `video.loop`,
     `video.paused`, `video.currentTime`, `video.duration`, `video.readyState`,
     `video.videoWidth/videoHeight`; the strip/Show-tool mute/loop button titles;
     the output `text`/`lines` arrays; content-box geometry
     (`getBoundingClientRect()` of the slide/content container) for aspect and
     layers. These are exactly the assertions in §3 and are readable via
     `page.evaluate` with the window hidden.
   - The harness must therefore **extend `readOutput`** (observe_reference.mjs:650-687)
     to also return: `videos: [{ src, loop, paused, muted, currentTime, duration, readyState }]`,
     `images: [src…]` (or a `[data-source]`/`.media` element list), and a
     `contentBox: { width, height }` for the slide/content container; and extend
     `readController` to return the media-control strip's buttons
     (title + `disabled`), mirroring the existing clear-button read.
4. **Double-click timing.** `MediaCard` defers the single-click for a double-click
   timer (media.md:147-149). A synthetic `dblclick` must be timed so the
   single-click branch does not fire first; if it is flaky, seed the project item
   (deterministic) and leave the dblclick handler `code` — say which happened in
   the run record.
5. **Hidden output windows.** As in the prior run, "an output page exists" is not
   "a window is on screen" (A-005). Assertions rest on the output page's DOM, and
   the controller screenshot of the preview tiles, never on a mapped window.

## Recommended follow-up for the scenario author (out of this spec's role)

- `media.play`: repeat the click/clear cycle (play → clear → play) and the
  locked-click refusal; add the foreground-typed variant if a foreground folder is
  seeded.
- `media.next-finished`: boundary case — a **non-looping** background without the
  flag should clear (not advance); the clear-on-finish default.
- `out.styles.lines`: `lines` equal to the slide's line count, and `lines` greater
  than it (single page), plus a `lines:0` output in the same run to pin the shared
  paging step.
- `out.styles.layers`: each layer hidden in turn (slide layer off → no slide text;
  overlays off → overlays gone), not only the background layer.
