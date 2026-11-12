# Observed: media behaviour in the reference

What the pinned reference actually does with a media background: the drawer's
click-to-play and click-to-clear, the media control strip (play/pause, loop,
mute, lock), and the "next on media finished" advance out of a **looping** clip.

| | |
| --- | --- |
| Reference | FreeShow `1.6.8-beta.3` at `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (`commitMatchesPin: true`) |
| Driver | `parity/tools/observe_reference.mjs`, scenario `media-behaviour` |
| Run | 2026-11-12, `xvfb-run` virtual display (`:99`, 1920×1080), controller viewport 1600×900 |
| Result | `14/14` steps, `failed: []` (`run.json`) |
| Fixtures | media fixture `parity-with-media.show` (paths rewritten at seed time to `/tmp/opencode/media/`; committed fixture untouched) |
| Generated media | `/tmp/opencode/media/video-bg.webm` (VP9 + Opus, 1280×720, 3.008 s, 440 Hz sine), `/tmp/opencode/media/logo.png` (320×180 magenta) |
| Seeded | layout slide `fx-1` background = media id `m-bg` with `{loop:true, muted:true}` + `actions.nextAfterMedia:true`; `settings.json` `mediaFolders` → `Parity Media`; project media item `{id: "/tmp/opencode/media/video-bg.webm", type: "video"}` |

## What each step recorded

| Step | Observed (`observed`) |
| --- | --- |
| `ready` / `open_project` / `open_show` / `present` | controller up; no output before presenting; the media show opens; one Present click creates the output page and OS window |
| `start` | Space starts the show; slide 1 text reaches the output |
| `media_background` | the output renders a `<video>` for `video-bg.webm`; `video.loop === true` (the seeded `{loop:true}` is honoured); finite duration 3 s; `readyState >= 2`; decoded frame 1280×720; the media control strip is present, revealed as the **Background** layer, names the media, and its mute button reads **Unmute** (player muted) |
| `media_playpause` | the strip's Pause/Play flips the live player's `paused` |
| `media_loop_mute` | clicking loop turns the live player's `loop` off; clicking mute unmutes it; the **stored** show media entry still reads `loop:true`/`muted:true` — the strip changes the player, not the stored style |
| `media_lock` / `media_unlock` | locking disables the play/pause/mute buttons but not loop; unlocking restores |
| `media_next_finished` | a **looping** background advanced the output to slide 2 when the clip ended — the `nextAfterMedia` check runs before the loop branch; exactly one advance; the advance fired at the clip's remaining 1616 ms, not a fixed wait; the video background is gone and the advance target renders its own image background |
| `media_drawer_play` | a single drawer card click sets a background on the active output with `loop:true`, and the mute button reads **Mute** (unmuted) — the no-type drawer default |
| `media_drawer_clear` | clicking the same card again clears the background |
| `media_project_item` | playing the project media item (no type) does **not** loop (`loop:false`) — the project-item default differs from the drawer default |

Raw artefacts: `steps.json` (all 14 records), `NN-<step>.json` (one per step),
`NN-<step>-controller.png`, `run.json`, `seed.json`, `run.log`, `electron.log`.

## What this run does not show

- **Output-window PNGs.** Every output `page.screenshot` timed out on llvmpipe
  (13 problems recorded in `run.json`); the output windows are created hidden. The
  evidence for each output is its **DOM/player state** (`NN-<step>.json` →
  `outputs[]` → `videos[]`, `images[]`, `contentBox`) and the **controller
  screenshot** showing the preview. This is the same limitation as
  `observe-stage-multi-output-2026-11-12-workspace`.
- **`muted` from the DOM.** The output `<video>` carries a hardcoded `muted`
  attribute (`media/Video.svelte:263`), so `video.muted` is always true and is
  *not* evidence of the stored mute state. The run reads the strip button title
  (`Mute` ⇔ unmuted, `Unmute` ⇔ muted) and records `video.muted` only to document
  that it is not usable. `loop` **is** DOM-observable.
- **The drop action itself.** The layout-slide background was seeded directly
  (as a media-id reference, `history.ts:110-142`). The port's *renderer honouring*
  `{loop:true, muted:true}` is observed; the drag-and-drop normalisation that
  produces that object stays `code`.
- **Foreground video `nextAfterMedia`** and "does a card click set the preview"
  — optional in the spec, not exercised.
- **Pixel correctness.** These are behavioural claims (state transitions), not a
  visual diff.
