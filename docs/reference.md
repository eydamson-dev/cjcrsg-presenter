# Working with the FreeShow reference

The reference is how behaviour is decided. This page is the recipe that took an
hour to work out; do not rediscover it.

## Checkout

The short setup version is in `CONTRIBUTING.md` ("Parity harness"). This section
keeps the detail and the reasons; change both if the pinned commit moves.

```
~/projects/reference/freeshow    # outside this repo
commit ff784eb388c7baef60d67e6d4e7c504f4322bca3   (1.6.8-beta.3)
```

```bash
git clone https://github.com/ChurchApps/FreeShow.git ~/projects/reference/freeshow
cd ~/projects/reference/freeshow
git checkout ff784eb388c7baef60d67e6d4e7c504f4322bca3
npm ci --ignore-scripts          # skips native module builds; fine for the UI
npm run build                    # NOT `vite build` — see below
```

**`vite build` alone is not a build.** It leaves `public/index.html` pointing at
`/src/frontend/main.ts`, so the renderer loads nothing, no server ever starts,
and the log looks healthy. `npm run build` rewrites it to `./build/bundle.js`.

## Starting it

Servers are **off unless a server's `disabledServers` value is exactly `false`**.
Seed a scratch profile:

```
/tmp/opencode/fs-store/
├── config.json      { "dataPath": "/tmp/opencode/fs-data", ... }
├── settings.json    { "disabledServers": { "remote": false, "stage": false,
│                                          "controller": false, "output_stream": false } }
└── projects.json    { "projects": {...} }
/tmp/opencode/fs-data/Shows/<name>.show
```

```bash
FS_MOCK_STORE_PATH=/tmp/opencode/fs-store NODE_ENV=production \
  npx electron . --user-data-dir=/tmp/opencode/fs-userdata
```

Kill it by path, never by `pkill -f "electron ."` — that pattern matches the
shell running it:

```bash
ps aux | grep "[f]reeshow/node_modules/electron" | awk '{print $2}' | xargs -r kill
```

## Ports and what they are

| Port | Client | Notes |
| --- | --- | --- |
| 5510 | Remote | Management UI: projects, shows, slides |
| 5511 | Stage | Needs a configured layout; otherwise "No shows" |
| **5512** | **Controller** | **Playback controls — next/previous live here** |
| 5513 | Output stream | Frame feed |

## A `.show` file

`[id, show]` JSON. Slide order comes from `layouts[activeLayout].slides`, not
from the order of keys in `slides`. A show without a layout is listed but reads
"No slides". `group: "."` starts a group; `group: null` continues the previous
one. `groups` is derived, not stored.

## Screenshots of the reference

The remote's slide preview is a `Zoomed` component that lays out at
**1920×1080** and scales by `min(w/1920, h/1080)`. To get a full-resolution
reference, resize its container and re-read the metrics:

```bash
cd parity/tools
node capture_freeshow_slide.mjs <outdir>      # preview + per-line boxes
node capture_freeshow_fullres.mjs <outdir>    # forces 1920x1080
```

## Playwright's Chromium has no H.264

Video work must use VP9/WebM. An H.264 clip loads to a dead player with no
error, which reads as "video costs nothing".

```bash
ffmpeg -f lavfi -i "testsrc2=size=1920x1080:rate=30:duration=15" \
  -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -b:v 0 -crf 32 out.webm
```

## Tools

| Tool | Purpose |
| --- | --- |
| `parity/tools/capture_freeshow_slide.mjs` | reference slide + metrics |
| `parity/tools/capture_freeshow_fullres.mjs` | reference at 1920×1080 |
| `parity/tools/capture_render.mjs` | our render at an exact size, same metrics |
| `parity/tools/compare.mjs` | pixel diff + ink distribution |
| `parity/tools/capture_page.mjs` | screenshot any URL or `file://` page |
| `parity/tools/experiment3_video.mjs` | 1/2/4 surfaces playing the same clip |
| `parity/tools/capture_video_frames.mjs` | two screenshots of a page with a video, plus its playback state |
| `parity/tools/check_keys.mjs` | runs the shipped `assets/keys.js` in Chromium and reports what it forwards |
| `parity/tools/summarize_probe.py` | frame rate and dropped frames from a `CJCRSG_MEDIA_PROBE` log |

They need `npm install` in `parity/tools` (they do not use the reference's
`node_modules`; ESM ignores `NODE_PATH`).
