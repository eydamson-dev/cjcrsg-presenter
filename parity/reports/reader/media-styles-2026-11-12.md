# Reader report — media + output styles (observed runs)

Date: 2026-11-12
Reference: FreeShow `ff784eb388c7baef60d67e6d4e7c504f4322bca3`
(`package.json` version `1.6.8-beta.3`), `commitMatchesPin: true` in both runs.
The reference checkout is read-only. This report relabels only the claims the two
runs established; it does not re-run anything and does not touch
`parity/tools/` or `parity/fixtures/`.

Scope: the post-run half of stage 1 for the media + output-styles Tier 1 slice,
whose pre-run spec is `parity/reports/reader/media-styles-observation-spec.md`.
The spec's "In / out" tables were the checklist.

Evidence:

- `parity/reports/evidence/observe-media-2026-11-12-xvfb/` — scenario
  `media-behaviour`, 14/14 steps, `failed: []` (`run.json`). One normal output,
  xvfb-run display `:99` at 1920×1080.
- `parity/reports/evidence/observe-styles-multi-output-2026-11-12-xvfb/` —
  scenario `styles-multi-output`, 10/10 steps, `failed: []` (`run.json`). Three
  normal outputs sharing one show, each bound to a seeded style.

## Features covered

| Feature | Page updated | What became `observed` |
| --- | --- | --- |
| `media.play` | `drawer/media.md` | a plain click plays the no-type video on the **one** active output; a second click clears it; the card title is `Play`/`Clear`; the drawer's no-type default is loop + unmuted |
| `media.background` | `drawer/media.md` | the player honours a seeded layout-slide background of `{loop:true, muted:true}`; a no-type project media item plays non-looping and unmuted |
| `media.controls` | `drawer/media.md` | the strip is the Background layer's disclosure; buttons render for a video background, only the name for an image; play/pause drives the player; loop/mute change the player but not the stored media; lock disables play/pause + mute but not loop; the normal strip's button set |
| `media.next-finished` | `drawer/media.md` | a looping background with `nextAfterMedia` advanced exactly one slide, timed against the clip, and left the video background |
| `out.styles` | `outputs/styles.md` | a style attaches per output and changes how one show + one slide looks |
| `out.styles.aspect` | `outputs/styles.md` | default 16:9 and a seeded 4:3 style render their ratios on the same output bounds (1920×1080 vs 1440×1080 at x=240) |
| `out.styles.lines` | `outputs/styles.md` | per-output window (`lines:2` shows 1–2, default 0 shows all) and the shared paging step (one advance → lines 3–4, presentation stays on slide 1, the `lines:0` output keeps all four lines) |
| `out.styles.layers` | `outputs/styles.md` | `layers:["slide","overlays"]` hides the background layer while the slide text still renders; a style with no `layers` includes the background (the overlays part was not exercised) |

`parity/features/media.yaml` was created with the four media entries;
`parity/features/outputs.yaml` gained the four style entries and its header now
names the `styles-multi-output` run.

## Label counts

Upgraded this pass: **21** claims/bullets from `code`/`unknown` to `observed`,
each cited to a run directory + step file on the page:

- `media.play` — 4 (single-output click, same-card clear, no-type default,
  card-title observable): `12-media-drawer-play.json`,
  `13-media-drawer-clear.json`.
- `media.background` — 2 (renderer honours the seeded loop/muted background;
  no-type project item is non-looping + unmuted): `06-media-background.json`,
  `14-media-project-item.json`. Its third "drawer default" bullet is the same
  fact as `media.play`'s and is counted once.
- `media.controls` — 6 (reveal control, strip contents for video vs image vs
  cleared, play/pause, loop/mute not persisted, lock rules, normal strip's
  buttons): `06`, `07`, `08`, `09`, `10`, `11`, `13`.
- `media.next-finished` — 2 (looping background advances once; the advance is
  timed against the clip): `11-media-next-finished.json`.
- `out.styles` — 1: `10-styles-attach.json` (with `05-start.json`).
- `out.styles.aspect` — 2 (16:9 default; 4:3 content box / resolution from ratio
  × bounds): `06-styles-aspect.json`.
- `out.styles.lines` — 3 (per-style number/default, per-output window, shared
  paging + the `lines:0` behaviour): `07-styles-lines-window.json`,
  `08-styles-lines-paging.json`.
- `out.styles.layers` — 1: `09-styles-layers.json` (confirmed at `10`).

Claims that **stayed `code`/`unknown`** (the runs did not observe them):

- `media.play` — the early-return branches (Ctrl/Cmd/Shift held, a locked output,
  a pending double-click, an icon-button target), the **multi-output fan-out**
  (the scenario had one output), playing a card **while locked**, foreground
  typing / `ignoreLayer`, double-click to add to the project, search Enter, and
  the Ctrl/Cmd+Left/Right preview. The open question "does a card click set
  `activeShow`" is still unanswered: the run did not read the media info panel.
- `media.background` — the drop normalisation itself
  (`dropActions.ts:710-711`), layer-type resolution for multi-file/provider
  drops, the foreground object, centre-drop vs Ctrl-drop, drop-off-slide slide
  creation, per-item `loop`/`muted` overrides, and whether the project-item
  editor exposes those toggles.
- `media.controls` — the seek slider's `currentTime`/`duration` tracking, the
  ±10 s buttons and their clamps, the media-name button opening the preview, the
  `videoSync` subscription, the big-preview variant, and the `startAt: 0`/`...style`
  fields of the drawer's `setOutput` payload.
- `media.next-finished` — the 200 ms clear-on-finish, the audio/timer reuse of
  the flag, and the foreground-video case. The first-vs-repeated end check and
  the 600 ms double-advance guard were not isolated (one advance was observed).
- `out.styles` — the Styles settings UI and the live `refreshOut()` on edit
  (styles were seeded, not edited), the presets and a custom ratio,
  `outputResolutionAsRatio`, `fontSizeRatio`, alignment, the media-fit default,
  `showAsFaded`/`lineOpacity`/`skipVirtualBreaks`, delete-while-referenced, the
  no-path `MediaItem` rule, PDF/PPT layer ownership, overlays/effects rendering,
  the stage-output ratio branch, and the "no style at all" case (every output had
  a style id; only unspecified fields fell back to defaults).

## Page corrections

- **`drawer/media.md`** — the page's status note said "Nothing here is `observed`
  — FreeShow was not exercised for behaviour; it was run only to capture the
  screenshots." The `media-behaviour` run makes that false for four features and
  true for the rest, so the note was replaced and the change logged as **A-008**.
  No behavioural claim was contradicted; this is a status correction plus the
  upgrade.
- **`outputs/styles.md`** — no claim was contradicted. The page already said the
  `lines:0` output "still shows the full slide on each page", which the run
  confirms. The wrong prediction was in the **pre-run spec**, which expected that
  output to show "lines 3–4" after an advance. The run shows it keeps rendering
  all four lines (`getOutputLines` → `null/null`). That correction is **A-009**,
  applied to the spec (a post-run correction section keeps the old prediction
  visible) and recorded as observed on `styles.md`; it is not a correction of a
  reference-page claim.
- `media.controls`' `unknown` was a question, not an error: it is answered, not
  audited.
- `WHAT-IS-THIS.md`'s status line now names `drawer/media.md` and
  `outputs/styles.md`.

## The two source facts the runs settled

1. **`muted` is not DOM-readable.** The output `<video>` is hardcoded muted
   (`src/frontend/components/media/Video.svelte:263`). In
   `12-media-drawer-play.json` `video.muted` was `true` while the strip offered
   `Mute` — the player was unmuted. A contract or harness must read the mute
   state from the control strip's button title (`Mute` ⇔ unmuted,
   `Unmute` ⇔ muted), never from `video.muted`. `loop` **is** DOM-readable
   (`video.loop` is bound to `videoData.loop` on the same line).
2. **The control that reveals the strip is the Background layer's disclosure.**
   The strip lives in the preview's clear-control column and renders only while
   the revealed layer is `background`
   (`src/frontend/components/output/preview/Preview.svelte:278-282`); the button
   is the one titled `Background`, next to `Clear background [F1]`. The media run
   records the reveal step (`05-start.json`, "selecting the Background layer
   reveals a media control strip"), the strip present with that layer selected
   (`06`), the strip absent once the background was cleared (`13`), and only the
   name (no buttons) while the background was an image (`11`), which matches
   `MediaControls.svelte:114-166`. This closes the page's former `unknown`.

## Evidence caveats

- **No output PNGs for most outputs.** The media run recorded 13 output
  screenshot timeouts on llvmpipe and the styles run 17; the styles run captured
  four output PNGs (steps 07–10, primary only). Both runs' behavioural claims rest
  on DOM/player/geometry state (`outputs[]` → `text`, `lines`, `contentBox`,
  `videos[]`, `images[]`) plus controller screenshots, not on output frames.
- **Behaviour, not pixels.** Nothing here establishes pixel correctness,
  font metrics or visual parity. The output windows were created hidden; this
  repeats A-005/A-007 and the stage run's caveat.
- The media run's steps pause the clip through the strip before capturing, so
  `paused: true` in several step files is deliberate, not a reference quirk.

## Recommended coverage for contracts/scenarios

- `media.play` on **two** active outputs (the fan-out is still unobserved), and a
  card click while the output is locked.
- A foreground-typed media file through both the drawer and a drop, to observe
  `ignoreLayer` and `{muted:false, loop:false}`.
- The drop action itself, to turn `dropActions.ts:710-711` from `code` to
  `observed`.
- `media.next-finished` with a non-looping background and no flag (clear-on-finish
  after 200 ms), and with a foreground video (the open question).
- `media.controls`: reading the seek slider's value while the clip plays, and
  clicking ±10 s with a clip longer than 10 s.
- `out.styles`: editing a style in Settings > Styles and watching an output
  re-render (`refreshOut`), plus `showAsFaded`/`lineOpacity` paging and the
  no-path `MediaItem` rule.

## Note on the reference README

`docs/freeshow-reference/README.md` still reports "Claims labelled `observed` |
90: … (2026-11-11)". It was not re-tallied for the 2026-11-12 stage run either, so
this pass left it alone rather than inventing a count. The orchestrator may want
the number replaced with a run list, or re-counted, as a separate edit.
