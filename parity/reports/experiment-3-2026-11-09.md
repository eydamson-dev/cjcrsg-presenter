# Experiment 3 — video across output windows

**Status:** the durable answer is in (no dropped frames at four surfaces); the
CPU attribution failed and is recorded as such.

Date: 2026-11-09. Machine: Ryzen 5 5600X, RTX 5060 Ti, Fedora 44, Wayland.

## Question

The same 1080p clip in 1, 2 and 4 surfaces: does the browser keep up, and what
does each extra surface cost?

## Method

Each "surface" is a page with one `<video autoplay muted loop>` at 1280×720,
standing in for an output window's WebView. Per configuration: warm up, then
sample for 15 s, reading `getVideoPlaybackQuality()` per page.

Clip: `testsrc2` 1920×1080, 30 fps, 15 s, **VP9/WebM**.

## Results

| Surfaces | Frames decoded | Dropped | Kept up |
| --- | --- | --- | --- |
| 1 | 591 | **0** | yes |
| 2 | 1184 | **0** | yes |
| 4 | 2376 | **0** | yes |

Frames decoded scale linearly (≈ 1 : 2 : 4), which shows every surface really is
decoding independently — the same clip is not being shared.

**Operational verdict: four WebView surfaces play 1080p30 without dropping a
frame on this machine.** That is the criterion that matters for the media
architecture decision.

## What failed, and why it is recorded

Two attempts to attribute CPU:

1. **H.264 clip produced a dead player.** Playwright's Chromium build has no
   H.264. Everything read zero — a silent failure that looked like "video costs
   nothing". Switched to VP9/WebM.
2. **/proc CPU sampling was unusable.** Summing `utime+stime` across every
   Chromium process before and after the window gave idle CPU of 24.9 s, 1.7 s
   and 21.4 s for the same workload, and one negative delta. Chromium starts and
   stops processes inside the window, so the set being summed is not stable.

The numbers are in `evidence/experiment-3/video.json` for completeness, but they
are **not** used to draw a conclusion.

## What this means for the architecture

- Four independent decoders are affordable at 1080p30 on this hardware, so
  `<video>` per output remains a valid Phase 4 starting point.
- The clip is trivial content. Real worship media (high bitrate H.264, 4K, or
  multiple simultaneous videos) is the harder case and still needs measuring.
- CPU cost must be measured **inside the app**, where the process tree is stable,
  not with a proxy harness. That is the next step, and it should happen when the
  media engine (Phase 4) starts.

## Evidence

![A surface playing the test clip](evidence/experiment-3/playing.png)

Raw run: `evidence/experiment-3/video.json`.

Reproduce:

```bash
ffmpeg -f lavfi -i "testsrc2=size=1920x1080:rate=30:duration=15" \
  -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -b:v 0 -crf 32 out.webm
cd parity/tools && node experiment3_video.mjs out.webm /tmp/exp3/video.json
```
