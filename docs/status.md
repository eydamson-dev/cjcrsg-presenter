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
  rewrites them to relative paths; `inspect` reports missing and invalid ones.
- Migrate a FreeShow data folder: `import-store` writes one `.cjcp` per project
  and reports the ones it could not import.
- Remember work: recent projects in a JSON session file; the last project opens
  on start, and the controller has an Open button per entry.
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

## Phases

| Phase | State |
| --- | --- |
| 0 — architecture validation | **done.** All three experiments measured |
| 1 — walking skeleton | **done** except the second physical display |
| 2 — presentation engine | mostly: outputs with distinct roles, clear with restore, keyboard, stage with message/countdown/layouts, transitions with project timing and direction, own remote clients, groups. Missing style-level transitions |
| 3 — data | import (single show, project with sections, whole store with categories and tags) + native format + media copy-in + document import + recent/restore. Missing FreeShow media metadata |
| 4 — media engine | **started.** Items render, video plays in the app (loopback media server), timeline resumes mid-clip, 1080p decodes with 0 dropped frames over 10 minutes. No continuous sync, audio routing or A/V drift measurement |
| 5 — professional AV | not started (needs hardware) |
| 6 — release/packaging | Windows: MSVC build, embedded DPI manifest and NSIS installer built in CI, never run. Linux packaging not started |

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
| Sections: a project with 2 sections + 1 show + 1 image imports with ordered entries | `parity/reports/sections-2026-11-09.md` |
| Media CPU: 112.6 % of one core (9.4 % of 12 CPUs), 2.2 GB RSS, three 1080p decoders | `parity/reports/media-cpu-2026-11-09.md` |
| Next at the end: project boundary is a no-op, as in FreeShow | `parity/reports/navigation-end-behaviour-2026-11-09.md` |
| Slide direction: imported bottom_top moves down, top_bottom up, default left | `parity/reports/transition-direction-2026-11-09.md` |
| elastic/bounce sampled to 101-point `linear()`; max error 1.25 % / 0.71 %, accepted by Chromium and WebKitGTK | `parity/reports/easing-2026-11-09.md` |
| Windows: exe 2.5 MB, installer 3.6 MB built by CI; manifest asserted in the exe | `parity/reports/windows-packaging-2026-11-09.md` |
| Media: VP9 advances 2.04 s over a 2 s wait, 54,205/921,600 pixels differ; reopening 2.5 s in resumes at 3.468 s | `parity/reports/media-playback-2026-11-09.md` |
| Four outputs, 1080p VP9: 841–843 frames each, 0 dropped over 30 s; three live surfaces, 0 dropped over 10 min (17.9k frames each) | `parity/reports/media-four-outputs-2026-11-09.md` |
| Stage message + countdown: 120 s set, pause holds 90 s, remote reports 299 994 ms running; split and live-only layouts | `parity/reports/stage-message-timer-2026-11-09.md` |
| Output kinds: preview renders the next slide, confidence the live slide + clock | `parity/reports/output-kinds-2026-11-09.md` |

Pictures and raw artefacts: `EVIDENCE.md`.

## Not using Craft Anything

`docs/decisions.md` D10. FreeShow is readable, and every question so far was
answered faster by reading it. The parity work is behavioural, which Craft
Anything does not produce.

## Known deviations

`docs/deviations.md` — two entries, each with an impact and a way to close it.
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
crates/core     96
crates/compat   39
crates/remote   12
apps/desktop     3
```

## Next, in order

1. **Sections and focus mode** — DEV-009. Sections now import as ordered
   markers; focus mode and section actions (skip, loop, notes) do not exist.
2. **FreeShow metadata** — DEV-005. Categories, tags and media metadata are not
   mapped; `import-store` migrates the content but not the organisation.
3. **Windows runtime verification.** The installer builds but has never run.
   QEMU/KVM covers install/uninstall and the WebView2 bootstrap; H.264 four-output
   playback on WebView2 is also unmeasured.
4. **Second physical display.** Experiment 1's placement and focus criteria are
   the only untested part of the walking skeleton. Needs hardware.
5. **Audio routing and A/V sync.** Audio elements exist; routing, channels and a
   drift measurement do not (Phase 4/5).

## Known gaps and hazards

- **No authentication on the remote**, and it binds `0.0.0.0`. Bind it to
  localhost or add auth before it runs on a shared network.
- **FreeShow's own remote/stage clients cannot connect.** Deliberate (D12): the
  protocol carries their layout/template model. Our clients are the supported
  surface.
- **The engine is linear within a show.** Groups are navigation sections, not
  FreeShow's full layout/section model (DEV-009).
- **Document import needs external tools.** `pdftoppm` and `soffice` must be on
  the machine; they are not bundled, and a machine without them cannot import.
- **The stage message is stage-only.** Routing it to an audience output is not
  implemented and would need an explicit operator choice.
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
