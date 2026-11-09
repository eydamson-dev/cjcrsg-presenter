# Four outputs playing video — 2026-11-09

Experiment 3's actual question, measured in the app rather than in a proxy page:
what does 1080p video cost when four output windows decode it at once?

It also uncovered that media did not play in the real app at all, which the
earlier harness could not see.

## The defect: `file://` media never loaded in the app

The app's page is served from `dioxus://index.html/`. A WebView on a non-file
origin refuses `file://` subresources, so the `<video>` existed but never
started. Measured with the in-app probe:

```text
href=dioxus://index.html/  networkState=3 (NETWORK_NO_SOURCE)
error=null                  videoWidth=0  videoHeight=0  paused=true
t=0  total=0  dropped=0     (still true 30 s later)
```

The earlier playback evidence rendered the page itself from `file://` in
Playwright, where the same source loads — a harness that hid a product bug.

**Fix.** A loopback HTTP server (`apps/desktop/src/media_server.rs`) serves only
the files the loaded project references, with Range support, on an ephemeral
`127.0.0.1` port. The engine emits `http://127.0.0.1:<port>/media/<path>`
instead of `file://`. The allowlist is rebuilt on every project open, and an
unreferenced file is a 404 — the port cannot be used to read the disk.

After the fix, the same probe:

```text
href=dioxus://index.html/  networkState=1  error=null
1920x1080  paused=false  frames increasing  dropped=0
```

## Method

- Real application, not a harness: one controller and four output windows
  (`CJCRSG_DEMO_OPEN=all`), each its own `VirtualDom` and WebView.
- Source: one VP9/WebM, 1920×1080, 30 fps, 30 s, non-looping, 9.9 MB, served by
  the loopback server.
- Probe: `CJCRSG_MEDIA_PROBE=1` samples `getVideoPlaybackQuality()` in every
  output every 2 s and logs it. Off by default.
- The stage plays the same picture muted and renders no audio element, so it is
  a fourth decoder but never a second audio source.
- Machine: Fedora 44, KDE/Wayland, AMD Ryzen 5 5600X, RTX 5060 Ti 16 GB,
  WebKitGTK. The GPU is not used by WebKitGTK for VP9 here; this is software
  decode, though that was not instrumented.

## Results

30 s window, first and last samples with frames:

| Output | Size | Frames | FPS | Dropped |
| --- | --- | --- | --- | --- |
| Audience | 1920×1080 | 841 | 28.00 | **0** |
| Stage (muted) | 1920×1080 | 843 | 28.01 | **0** |
| Preview | 1920×1080 | 841 | 27.99 | **0** |
| Confidence | 1920×1080 | 841 | 29.99 | **0** |

All four were playing simultaneously; `_all_four_playing: true`.

The 28.0 fps figures include the window creation ramp inside the sample window;
Confidence, measured from its first sampled frame, is 29.99 fps. Zero dropped
frames across all four.

Raw: `evidence/media/four-outputs/summary.json`, `probe.log`,
`clip.txt` (ffprobe).

## Ten minutes

Repeated with a 10-minute 1920×1080 VP9 clip (115 MB), same app, same probe,
after the output kinds changed so that **Preview shows the next slide** and no
longer decodes the live video. That makes the product's maximum three concurrent
live-video surfaces, not four:

| Output | Frames | FPS | Dropped | Final position |
| --- | --- | --- | --- | --- |
| Audience | 17,907 | 29.12 | **0** | 600.0 s |
| Stage (muted) | 17,940 | 29.12 | **0** | 600.0 s |
| Confidence | 17,905 | 29.12 | **0** | 600.0 s |
| Preview | — | — | — | shows the next slide (still image) |

614–616 s of samples, zero dropped frames. Frames are 0.5 % below 30 fps × 600 s,
which is the startup and teardown inside the sample window rather than loss: the
dropped counter is the browser's own, and it stayed at zero. Each output reached
600.0 s, the exact end of the clip.

The 30-second run above (four decoders, before the preview change) still stands
as the four-way test; this one is the long-duration test of the surfaces that
decode in the product today.

Raw: `evidence/media/four-outputs/ten-minutes/summary.json`, `probe.log`,
`clip.txt`.

## Decision

The WebView-per-output path stands for 1080p VP9 on this machine: four decoders,
no dropped frames. No native overlay and no GStreamer rewrite is justified by
this measurement.

## What this does not prove

- **No A/V drift measurement.** There is no audio clock to compare against; the
  test clip is video only.
- **VP9, not H.264.** Playwright's Chromium cannot decode H.264, so VP9 was
  used; the app's own WebView does play H.264, but that path is untested.
- **WebKitGTK, not WebView2.** Windows decode and composition are unmeasured.
- **No CPU figure.** `getVideoPlaybackQuality` answers frame loss, not cost.
  CPU was the part Experiment 3's proxy could not attribute either.
- **No hardware decode confirmation.** Whether a GPU path engaged was not
  checked.
- **Same clip, four decodes.** Nothing is shared between outputs.

The dropped-frame criterion is met at 1080p over both 30 s (four decoders) and
10 minutes (three, by design). The H.264/WebView2 repeat, CPU cost and hardware
decode confirmation remain.
