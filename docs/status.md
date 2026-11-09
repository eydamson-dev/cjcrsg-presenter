# Status — the handover

What exists, what does not, and what to do next. **Update this at the end of
every session.** It is the only place that describes current state; if it is
wrong, the next session starts wrong.

Last updated: 2026-11-09.

## Verify the workspace in one command

```bash
scripts/check.sh
```

Runs rustfmt, clippy (`-D warnings`), the test suite, and a check that
`EVIDENCE.md` declares the correct test count. CI runs the same script on
`ubuntu-24.04` and is green.

To set up a new machine first, follow `CONTRIBUTING.md`.

## What works end to end

```bash
cargo run -p cjcrsg-presenter -- <file.cjcp>        # open a project
cargo run -p cjcrsg-presenter -- serve --port 5521  # headless remote
cargo run -p cjcrsg-presenter -- render <f> out.html --layout stage
```

- Import a FreeShow `.show`, a whole project (`projects.json` + `shows/`), or a
  native `.cjcp`/`.cjcs`; unknown fields survive a read-write cycle.
- Make media portable: `bundle` copies external files into `<root>/media` and
  rewrites them to relative paths; `inspect` reports missing and invalid ones,
  and the controller's Project panel has a **Make portable** button.
- See the project's media in the controller: kind, origin, size, tags, and a
  **missing** flag per file.
- Migrate a FreeShow data folder: `import-store` writes one `.cjcp` per project
  and reports the ones it could not import.
- Remember work: recent projects in a JSON session file; the last project opens
  on start, and the left column is a project browser with the open project
  marked, recent projects newest first, a missing-file flag and Forget.
- Drive it from the keyboard with FreeShow's bindings (`Space`/arrows/`PageUp`/
  `PageDown`, `Esc` to blank); any navigation restores a blanked output.
- Navigate: next, previous, first, last, next/previous **group**, goto by index,
  clear/blank (which keeps the position).
- Four output windows with distinct roles: audience (live), stage (live + next +
  notes + message + countdown), preview (the next slide), confidence (live +
  clock).
- All eight of FreeShow's transitions, with each slide's own duration and easing
  from the project; the project default is FreeShow's fade/500 ms/sine.
- An HTTP remote that drives all of the above, returning 409 for a no-op.
- Close any output, keep presenting, reopen it and it returns to the live slide
  in ~180 ms.
- Use FreeShow's bottom drawer: eight tabs in its order, drag to resize or
  collapse to the 40 px strip, Ctrl+1..8, a remembered height, the project's
  media split into Media and Audio, and a clock with the long-form date.

## Phases

| Phase | State |
| --- | --- |
| 0 — architecture validation | **done.** All three experiments measured |
| 1 — walking skeleton | **done** except the second physical display |
| 2 — presentation engine | mostly: outputs with distinct roles, clear with restore, keyboard, stage with message/countdown/layouts, full-window focus view, transitions with project timing and direction, own remote clients, groups. Missing style-level transitions |
| 3 — data | **done for content and metadata**: single show, project with sections, whole store with categories/tags, native format, media copy-in, document import, recent/restore. No media library UI (durations, thumbnails, playlists) |
| 4 — media engine | **started.** Items render, video plays in the app (loopback media server), timeline resumes mid-clip, 1080p decodes with 0 dropped frames over 10 minutes, outputs drift < 6 ms over 10 min. No audio routing or shared start instant |
| 5 — professional AV | not started (needs hardware) |
| 6 — release/packaging | Windows: installer verified on a clean Windows 11 VM (installs, shortcut, uninstall key, app launches); fixed a missing-CRT blocker. Linux: per-user tarball with desktop entry, icon and install script, built in CI. DPI/monitors/audio, Windows uninstall and AppImage/Flatpak unverified |
| 7 — controller UI parity | **shell, drawer and project browser done.** Top bar, three columns, live preview, FreeShow palette, resizable persisted columns, focus-in-centre, the eight-tab bottom drawer with clock, the left project browser, and side-by-side comparisons against FreeShow 1.6.8. Remaining: a folder tree and project store behind the browser, and the slide editor (DEV-013) |

## Measured, with evidence

| Claim | Where |
| --- | --- |
| Four outputs, one engine, 184 ms recovery | `parity/reports/experiment-1-2026-11-09.md` |
| Renderer parity: 0.35 % differing pixels, boxes within 0.15 px | `parity/reports/experiment-2-2026-11-09.md` |
| Four surfaces, 1080p30, zero dropped frames | `parity/reports/experiment-3-2026-11-09.md` |
| Same slide twice: 0 differing channels | `parity/reports/calibration-2026-11-09.md` |
| FreeShow navigation lives on the controller (5512) | `parity/reports/preflight-2026-11-09.md` |
| Import, formats, media | `parity/reports/data-layer-2026-11-09.md` |
| Remote commands | `parity/reports/remote-2026-11-09.md` |
| Keyboard capture: 15/15 cases in Chromium; clear/restore live on the remote | `parity/reports/keyboard-2026-11-09.md` |
| Stage | `parity/reports/stage-2026-11-09.md` |
| Transitions | `parity/reports/transitions-2026-11-09.md` |
| Transition timing: 1200 ms imported timing honoured; sine/linear ratio 0.571 vs 0.586 | `parity/reports/transition-timing-2026-11-09.md` |
| Media copy-in: copied bytes identical, project portable after the originals are deleted | `parity/reports/media-copy-in-2026-11-09.md` |
| Persistence: two launches recorded, restore-on-start, stale entry falls back to demo | `parity/reports/persistence-2026-11-09.md` |
| Documents: 3-page PDF → 3 contained image slides; DOCX through LibreOffice | `parity/reports/documents-2026-11-09.md` |
| Store import: 3 projects → 2 written, 1 broken project reported, others unaffected; category `Songs` and tags resolve | `parity/reports/store-import-2026-11-09.md` |
| Sections: ordered entries; next/previous section jumps fx-1 (1/6) → tx-1 (4/6) → 409 → fx-1 | `parity/reports/sections-2026-11-09.md` |
| Outline: play a show by index, live marker; remote fx-1 → tx-1 → fx-1 | `parity/reports/outline-focus-2026-11-09.md` |
| Focus view: full-window project list with live marker, rendered at 980×780 | `parity/reports/focus-view-2026-11-09.md` |
| Media tags from `media.json` attach to the imported asset (`tags=worship,background`) | `parity/reports/store-import-2026-11-09.md` |
| Media CPU: 112.6 % of one core (9.4 % of 12 CPUs), 2.2 GB RSS, three 1080p decoders | `parity/reports/media-cpu-2026-11-09.md` |
| Next at the end: project boundary is a no-op, as in FreeShow | `parity/reports/navigation-end-behaviour-2026-11-09.md` |
| Slide direction: imported bottom_top moves down, top_bottom up, default left | `parity/reports/transition-direction-2026-11-09.md` |
| elastic/bounce sampled to 101-point `linear()`; max error 1.25 % / 0.71 %, accepted by Chromium and WebKitGTK | `parity/reports/easing-2026-11-09.md` |
| Windows: exe 2.5 MB, installer 3.6 MB built by CI; manifest asserted in the exe | `parity/reports/windows-packaging-2026-11-09.md` |
| Windows install+launch on a clean VM; first build died on VCRUNTIME140.dll, static CRT fixed it; app runs | `parity/reports/windows-verification-2026-11-09.md` |
| Linux tarball: desktop file validates, installs to a scratch prefix, packaged binary runs | `parity/reports/linux-packaging-2026-11-09.md` |
| Media panel: bundled 9.4 MB video, external file flagged missing, tags shown | `parity/reports/media-panel-2026-11-09.md` |
| Controller shell: top bar + 3 columns + live preview, captured from the real window; FreeShow palette; resizable columns | `parity/reports/ui-shell-2026-11-09.md` |
| Media: VP9 advances 2.04 s over a 2 s wait, 54,205/921,600 pixels differ; reopening 2.5 s in resumes at 3.468 s | `parity/reports/media-playback-2026-11-09.md` |
| Four outputs, 1080p VP9: 841–843 frames each, 0 dropped over 30 s; three live surfaces, 0 dropped over 10 min (17.9k frames each) | `parity/reports/media-four-outputs-2026-11-09.md` |
| Audio: imported audio is audible (was muted); WAV advances 1.69 s → 9.71 s, paused=false, no error | `parity/reports/audio-playback-2026-11-09.md` |
| Output drift over 10 min: Stage 5.8 ms, Confidence 1.6 ms against Audience (offset is start time, not drift) | `parity/reports/media-drift-2026-11-09.md` |
| Stage message + countdown: 120 s set, pause holds 90 s, remote reports 299 994 ms running; split and live-only layouts | `parity/reports/stage-message-timer-2026-11-09.md` |
| Output kinds: preview renders the next slide, confidence the live slide + clock | `parity/reports/output-kinds-2026-11-09.md` |
| Controller drawer: 8 tabs, 40/300/744 px geometry, 79/80 px drag threshold, remembered height across restart, 17 images and 9 session files | `parity/reports/ui-drawer-2026-11-09.md` |
| Project browser: open project first, recents newest first, missing-file flag, Forget, and the outline in the Shows tab | `parity/reports/ui-project-browser-2026-11-09.md` |

| FreeShow reference: 225 features, 60 pages, 1,630 code citations, 30 screenshots | `docs/freeshow-reference/` |

Pictures and raw artefacts: `EVIDENCE.md`.

## FreeShow reference documentation

`docs/freeshow-reference/` describes the pinned reference (`ff784eb`, 1.6.8-beta.3)
feature by feature. It is built from the published docs and the source, not from
memory.

- `source/` mirrors all 54 published pages and 34 images from
  `ChurchApps/FreeShowWeb` at `8d875b5`; `scripts/fetch_freeshow_docs.sh` refreshes it.
- `feature-inventory.md` lists 225 features with stable IDs; every ID is mentioned
  by at least one detail page.
- 60 pages cover getting started, projects, shows, the drawer, outputs, the remote
  clients, cloud and transfer, advanced topics, formats, and the internal
  architecture (IPC, servers, settings, persistence, API, stores, media, i18n,
  security, build).
- Every behavioural claim is labelled `code`, `doc`, `unknown` or `observed`.
  Nothing is `observed` yet: the reference was run only to capture screenshots, so
  no page is a runtime-verified contract. `USING-THIS.md` says what each label
  permits.
- 30 screenshots of the running reference are in `screenshots/`, with the state and
  viewport of each in its README.
- `scripts/check_freeshow_refs.py` verifies every `src/...:line` citation against
  the pinned checkout (1,628 at present). `scripts/check_freeshow_coverage.py`
  reports inventory IDs no page mentions.

`audit.md` records contradictions found while writing it. The first is still open:
`parity/reports/navigation-end-behaviour-2026-11-09.md` says next-at-end has no
configuration branch, but `OutputHelper.ts:131` checks
`special.nextItemOnLastSlide`, and its default is on. The report needs correcting
before that behaviour becomes a contract.

## Not using Craft Anything

`docs/decisions.md` D10. FreeShow is readable, and every question so far was
answered faster by reading it. The parity work is behavioural, which Craft
Anything does not produce.

## Known deviations

`docs/deviations.md` — one entry, each with an impact and a way to close it.
Read it before claiming parity on anything.

## Windows

Never *run* on Windows. But it now compiles and its library tests execute there:
the first Windows run built the desktop binary in 3m51s and caught a real path
bug (`Path::is_absolute` is false for `/home/...` on Windows); after the fix all
four CI jobs are green. See
`docs/windows.md`. An NSIS installer now builds in CI (run `42549750166`) and
the manifest declares PerMonitorV2 and long paths; installing, DPI, fullscreen
and audio still need a real machine.
Developer setup on Windows is in `CONTRIBUTING.md` under "Windows".

## Tests

```
crates/core    105
crates/compat   41
crates/remote   14
apps/desktop    24
```

## Next, in order

Before the list: close the reference audit items. A-001 is the first — the
navigation report's "no configuration branch" claim is wrong, and
`special.nextItemOnLastSlide` belongs in the contract and its scenarios.

1. **Controller information architecture, remainder** — DEV-013. The drawer,
   tab strip, clock and project browser are done. Behind the browser there is
   still no project catalogue (folders, create, rename, import), and the left
   column cannot show more than the session's recent list. The slide editor
   stays out until a later phase (`docs/ui-parity.md`).
2. **Section actions** — DEV-009. The focus view and outline exist; FreeShow's
   per-section actions (skip, loop, notes) are still not executed, and the view
   has no drag, auto-scroll or keyboard traversal.
3. **Windows runtime, remainder.** Install and launch are verified; uninstall,
   DPI, multi-monitor, fullscreen, audio and H.264/WebView2 playback are not.
4. **Second physical display.** Experiment 1's placement and focus criteria are
   the only untested part of the walking skeleton. Needs hardware.
5. **Audio routing and a shared start instant.** Drift is single-digit ms, but
   outputs still start at different moments; routing and channels are Phase 5.

## Controller UI

The **outputs** target FreeShow's look (renderer parity 0.35 % differing
pixels). The **controller** now has FreeShow's shell, bottom drawer and left
project browser: top bar, three columns, live preview, palette, resizable
columns, focus-in-centre, eight drawer tabs, the clock, and a Projects column
with the open project marked, recent projects and Forget. Compared side-by-side
with FreeShow 1.6.8 in `parity/reports/ui-shell-2026-11-09.md`,
`parity/reports/ui-drawer-2026-11-09.md` and
`parity/reports/ui-project-browser-2026-11-09.md`.

What still differs is information architecture: FreeShow's left column is a
folder tree over a project catalogue with create, rename, delete and import; ours
is the session's recent list. The centre is a live preview, not an editable
slide grid. The five drawer tabs with no library behind them say so explicitly
(DEV-014). DEV-013 and `docs/ui-parity.md` record the boundary.

## Known gaps and hazards

- **No authentication on the remote**, and it binds `0.0.0.0` — which now
  provably triggers a Windows Firewall prompt on first launch. Bind it to
  localhost or add auth before it runs on a shared network.
- **FreeShow's own remote/stage clients cannot connect.** Deliberate (D12): the
  protocol carries their layout/template model. Our clients are the supported
  surface.
- **The engine is linear within a show.** Groups are navigation sections, not
  FreeShow's full layout/section model (DEV-009).
- **The media panel is read-only.** It lists assets, sizes, tags and missing
  files, but cannot add, relink or remove; thumbnails and durations are not
  stored.
- **Five drawer tabs are empty by design.** Overlays, Templates, Scripture,
  Calendar and Functions each say there is no library behind them; only Shows,
  Media and Audio have content (DEV-014).
- **The project browser only knows the session.** It lists the open project and
  the ten most recent; there are no folders, no create/rename/delete, and no
  file picker or import dialog (DEV-013).
- **Document import needs external tools.** `pdftoppm` and `soffice` must be on
  the machine; they are not bundled, and a machine without them cannot import.
- **The stage message is stage-only.** Routing it to an audience output is not
  implemented and would need an explicit operator choice.
- **Audio has no routing.** It mixes into the default device; channels, fades
  and multi-device output are Phase 5.
- **Media has a partial coordinator.** Position, pause, restore and seek exist;
  continuous sync between outputs and audio routing do not.
- **Media URLs are loopback HTTP.** The app serves only the project's own files;
  an external file outside the project is allowed only because the project
  references it.
- **`nav.bounds.next-at-end` is unverified** against the reference. Ours ignores
  next at the end; FreeShow may wrap or stop.
- **Style-level transitions are not modelled.** FreeShow resolves slide → style
  → global; we resolve slide → default. A project that keeps its timing in
  `styles.json` gets the default (DEV-012 covers the related direction gap).
- **Desktop automation is unreliable on this machine.** Prefer headless
  renders; capture windows by hand.
- **CI is green but the repo history is short.** The original fork's git history
  was absent when this repository started; see `docs/provenance.md`.
