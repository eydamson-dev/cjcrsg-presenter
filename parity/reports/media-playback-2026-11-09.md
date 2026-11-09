# Media playback — first slice, 2026-11-09

> **Correction, same day.** The playback measured below was rendered by the SSR
> harness, which loads its page from `file://`. In the real app the page comes
> from `dioxus://`, where `file://` media is blocked: the element existed and
> never decoded. A loopback media server fixed it
> (`media-four-outputs-2026-11-09.md`). The numbers in this report are real but
> they describe the harness until the server landed.

Phase 4 starts with the smallest thing that proves the pipeline: a FreeShow
media item becomes a real `<video>`/`<img>`/`<audio>` in the output, and a video
actually decodes and advances.

This is **not** a media engine yet. There is no playback coordinator, no seeking,
no audio routing, no pause/resume per slide, and no measurement of four videos
at once.

## What changed

| Layer | Change |
| --- | --- |
| `domain::MediaRef` | `path`, `kind`, `origin`, `looped`, `muted` on a `SlideElement`; `None` means text |
| Import | `type: "media"` items keep `src`, extension-derived kind, and the authored `loop`/`muted`; an item with no path is dropped |
| `render::RenderMedia` | Kind, absolute `file://` URL, loop/mute, `playing` — no project lookups left for the renderer |
| Engine | Resolves media against the project root (`with_media_root`), percent-encodes the URL, and sets `playing = !cleared` |
| Renderer | `<img>`, `<video autoplay muted playsinline loop>`, `<audio>`; the stage renders the same slide with playback off, so it does not play a second copy |
| `bundle` | Rewrites element media paths as well as the project's media list, so a bundled project's elements point into `media/` |
| CLI | `render` sets the media root from the `.cjcp`'s folder |

`MediaRef` carries its own path because that is how FreeShow stores it
(`item.src`); the show's media map is not needed to render an item.

Muted is the default for imported items (`item.muted` absent → `true`). An output
must start playing without a click, and browsers only autoplay muted media. A
project that says `"muted": false` wins, and may then be blocked by the WebView —
an honest limitation rather than a silent one.

## Measured

A 6-second VP9 clip and a PNG, in a two-slide FreeShow show, imported, bundled
into the project, and rendered through the real component at 1280×720:

```text
copied    2
media     m1 [Video Bundled] media/clip.webm
          m2 [Image Bundled] media/backdrop.png
```

The rendered page loads `file:///tmp/opencode/media/media/clip.webm` — the
project-relative path resolved against the project root, not the page.

Headless Chromium, same page, two moments:

| | 500 ms | 2500 ms |
| --- | --- | --- |
| `currentTime` | 0.977 s | 3.017 s |
| `paused` | false | false |
| `readyState` | 4 | 4 |
| `videoWidth × videoHeight` | 1280×720 | 1280×720 |
| `error` | null | null |

Advanced **2.04 s** over a 2 s wait; 54,205 of 921,600 pixels differ between the
two frames. Both frames show the clip's burnt-in timecode (01.000 and 03.033),
so the difference is the video advancing, not a rendering artefact.

![Video frames and an image slide](evidence/media/montage.png)

Left: 500 ms. Centre: 2500 ms. Right: the still-image slide with a text overlay.

Raw: `evidence/media/video-report.json`, `frame-500ms.png`,
`frame-2500ms.png`, `image/remote-1280x720.png`.

## Recovery mid-clip

The engine owns a media timeline: position advances with an injected clock,
pauses when the output is blanked, resumes on restore, and resets when the slide
changes. A window that opens mid-clip asks for a fresh snapshot
(`SharedEngine::snapshot`) instead of the cached publication, which carries the
position from the moment the slide changed.

The renderer expresses the position as a media fragment (`#t=2.500`), so the
WebView seeks without a script and without per-frame traffic. Rendering as if an
output reopened 2.5 s into the clip:

```text
<video class="media" src="file:///tmp/opencode/media/media/clip.webm#t=2.500" …>
```

Headless Chromium, 500 ms after load: `currentTime` **3.468 s** (2.5 + 0.968),
`paused: false`, then advancing 2.039 s over the next 2 s. The clip resumes where
the show was, not from zero.

Raw: `evidence/media/resume/video-report.json`.

## Tests

- a media item keeps its path, video kind, external origin and authored
  `loop`/`muted`;
- a media item with an empty path is dropped;
- relative media resolves against the project root and percent-encodes spaces;
- an absolute media path ignores the root;
- `playing` is false for a blanked output;
- bundling rewrites an element's media path and origin, not just the project list;
- `file://` URLs keep a Windows drive letter and encode `#` and spaces;
- position advances with the clock, freezes while blanked, resumes on restore,
  and resets on a slide change;
- seeking moves the position, bumps the revision and emits no transition;
- a fresh snapshot reports the live position while the cached state keeps the
  one from publication.

## Serving media to the app

Media elements ask `http://127.0.0.1:<ephemeral>/media/<path>`; the server
serves only files the loaded project references, with Range support. The render
CLI keeps `file://`, because its page is loaded from `file://`.

## Not done

- **No continuous sync.** The position is applied when an output mounts; a
  running output lets its own WebView clock carry the clip. Drift between two
  outputs over a long service is unmeasured.
- **No pause/play control.** Clear/restore pause and resume; there is no
  operator command to pause a clip without blanking the screen.
- **No audio routing.** Audio elements exist but mix into the default device;
  FreeShow's channel mapping is Phase 5.
- **No `filter`, `fit`, `cropping`, `fromTime`/`toTime`.** The item is drawn
  full-bleed with `object-fit: cover`; the rest of FreeShow's box model is not
  modelled.
- **No background media** (`slide.background.media`), only items.
- **No four-output measurement.** Experiment 3 measured HTML surfaces; four
  decoded videos at once is the question that decides the media architecture,
  and it has not been run.
- **One codec.** VP9/WebM was used because Playwright's Chromium has no H.264,
  not because the app should prefer it. WebView2 will play H.264; that path is
  untested.
