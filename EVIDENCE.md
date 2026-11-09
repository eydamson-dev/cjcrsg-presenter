# Test evidence

Visual proof and raw artefacts for each milestone. The prose reports in
[`parity/reports/`](parity/reports/) carry the detail; this page is the index.

**As of `main`, 2026-11-09.** <!-- tests: 71 -->

Two things keep this page honest: `git log -1 -- EVIDENCE.md` says when it last
changed, and `scripts/check.sh` fails if the declared test count and the
workspace disagree.

---

## Experiments — the three that gate development

### Experiment 1 — four outputs, one engine

Seven checks, all passing. Recovery **184 ms** against a 1,000 ms budget; the
first run, before the shared-engine refactor, measured 205 ms.

| | |
| --- | --- |
| Raw result | `parity/reports/evidence/experiment-1-smoke.json` |
| Report | `parity/reports/experiment-1-2026-11-09.md` |

No photograph: it drives four native windows, and this Wayland session refuses
to let a program focus its own window, so an automated capture lands on whatever
is already focused. Reproduce with `CJCRSG_SMOKE=1`.

### Experiment 2 — renderer parity

Every text box agrees within **0.15 px**; glyph advance and horizontal placement
are identical. **0.35 %** differing pixels at 1920×1080.

| FreeShow | Ours | Difference |
| --- | --- | --- |
| ![FreeShow](parity/reports/evidence/experiment-2/freeshow-1920x1080.png) | ![Ours](parity/reports/evidence/experiment-2/ours-1920x1080.png) | ![Diff](parity/reports/evidence/experiment-2/diff-1920x1080.png) |

Report: `parity/reports/experiment-2-2026-11-09.md`.

### Experiment 3 — four surfaces playing 1080p

Zero dropped frames at 1, 2 and 4 surfaces; frames decoded scale 1:2:4, so each
surface decodes independently. CPU attribution failed and is recorded as failed.

![A surface playing the test clip](parity/reports/evidence/experiment-3/playing.png)

Report and raw JSON: `parity/reports/experiment-3-2026-11-09.md`,
`parity/reports/evidence/experiment-3/video.json`.

---

## Rendering

`cjcrsg-presenter render <file.cjcp> out.html` renders the real `SlideView` /
`StageView` components to HTML; Playwright screenshots them headlessly. No
window, no display server, no desktop involvement.

**Audience, 1920×1080**

![Audience 1920x1080](parity/reports/evidence/render/audience-1920x1080.png)

**Audience, 1366×768**

![Audience 1366x768](parity/reports/evidence/render/audience-1366x768.png)

**Audience, portrait 1080×1920**

![Audience portrait](parity/reports/evidence/render/audience-1080x1920.png)

**Stage — live + next**

![Stage](parity/reports/evidence/render/stage-1920x1080.png)

**Stage with operator notes and a clock slot**

![Stage with notes](parity/reports/evidence/render/stage-notes-1920x1080.png)

**All eight transitions**, frozen 200 ms in: none, blur, fade, crossfade / fly,
scale, slide, spin.

![Transitions](parity/reports/evidence/transitions/montage.png)

Reports: `parity/reports/stage-2026-11-09.md`,
`parity/reports/transitions-2026-11-09.md`.

---

## FreeShow reference

Captured from FreeShow `ff784eb` running with a scratch profile.

**The fixture show, as FreeShow renders it**

![FreeShow slides](parity/reports/evidence/remote-show-slides.png)

**FreeShow's project list**

![FreeShow project](parity/reports/evidence/remote-project.png)

**FreeShow's controller client — the navigation surface**

![FreeShow controller](parity/reports/evidence/controller-page.png)

Report: `parity/reports/preflight-2026-11-09.md`.

---

## Calibration — the same slide, twice

Two captures of one FreeShow slide, 700 ms apart. **0 differing channels, max
delta 0** across 53,196 pixels, so static Chromium content is deterministic.

| First | Second |
| --- | --- |
| ![Slide A](parity/reports/evidence/calibration/slide-a.png) | ![Slide B](parity/reports/evidence/calibration/slide-b.png) |

Report: `parity/reports/calibration-2026-11-09.md`.

---

## Remote control

`GET /api/state`, `POST /api/{next,previous,first,last,next-group,previous-group,goto,clear}`.
A command that changes nothing returns **409**, so a client can tell "done" from
"already at the end".

![Remote phone](parity/reports/evidence/remote/remote-390x844.png)

![Remote desktop](parity/reports/evidence/remote/remote-1280x720.png)

| Artefact | Shows |
| --- | --- |
| `remote/state.json` | `/api/state` before and after a `next` |
| `remote/smoke.txt` | curl transcript: `next` → 200, `clear` → 200, `previous` at the first slide → 409 |

Report: `parity/reports/remote-2026-11-09.md`.

---

## Data layer

**A FreeShow `.show` imported into the app.** Readout shows `Slide fx-1`,
`Position 1 / 3` — the imported ids, not the demo project.

![Controller with imported project](parity/reports/evidence/controller-imported-project.png)

Artefacts: `import-cli.txt`, `inspect-cli.txt`.

**A whole FreeShow project** — `projects.json` joined with `shows/`, then
rendered:

![Imported project](parity/reports/evidence/project/imported-project-1920x1080.png)

**Media references** import as `external` (FreeShow keeps media outside the
project), with a kind derived from the extension:

```
$ cjcrsg-presenter inspect media.cjcp
project   Parity With Media
shows     1
slides    3
media     2
```

Artefacts: `evidence/project/import.txt`, `import-media.txt`,
`inspect-media.txt`.

Report: `parity/reports/data-layer-2026-11-09.md`.

---

## Why these are the choices they are

`docs/decisions.md` records the nine expensive-to-reverse decisions and their
consequences — including why visual evidence comes from headless renders rather
than photographs of windows.

---

## Windows — first run

CI compiles and tests on `windows-latest`. First run (`42543078950`):

| Job | Result |
| --- | --- |
| desktop (windows-latest) | **passed**, 3m51s — first time this app compiled for Windows |
| desktop (ubuntu-24.04) | passed, 2m46s |
| library (ubuntu-24.04) | passed, 33s |
| library (windows-latest) | **failed** — one test, and it was right to |

The failure was a genuine cross-platform bug, not a flaky test:

```
media::tests::a_bundled_absolute_path_is_rejected
  left: Ok(())                                    expected Err(AbsoluteBundledPath)
```

`Path::is_absolute("/home/user/worship.mp4")` is **false on Windows**, because
the path has no drive prefix. A project authored on Linux could therefore carry
an absolute media path that validation accepted and resolution then failed on.
Replaced with a platform-independent check that also rejects `C:\…`, `C:foo`
and UNC paths, with tests for each.

**Re-run after the fix (`42545671999`): all four jobs green**, including
`library (windows-latest)` in 2m35s and `desktop (windows-latest)` in 1m19s.

This is the argument for running the library tests on Windows rather than only
compiling there.

## Verification

| Check | Result |
| --- | --- |
| `scripts/check.sh` locally | fmt, clippy `-D warnings`, 67 tests, evidence count — all pass |
| GitHub Actions `check` on `main` | passing on `ubuntu-24.04` (runs `42541284369`, `42541450720`) |

CI runs the same script, so a green tick means the same thing as a green local
run. The workflow pins the runner and installs the WebKit/GTK/Xdo headers the
desktop crate needs to link.

---

## Reproducing any of these

```bash
scripts/check.sh                                     # fmt + clippy + tests
cjcrsg-presenter serve --port 5521                   # remote, headless
cjcrsg-presenter render <file.cjcp> out.html --layout stage --slide 0
cd parity/tools && node capture_page.mjs file:///…/out.html <dir> 1920x1080
CJCRSG_SMOKE=1 cjcrsg-presenter                      # Experiment 1
```
