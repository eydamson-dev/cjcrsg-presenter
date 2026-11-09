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
- Remember work: recent projects in a JSON session file; the last project opens
  on start, and the controller has an Open button per entry.
- Drive it from the keyboard with FreeShow's bindings (`Space`/arrows/`PageUp`/
  `PageDown`, `Esc` to blank); any navigation restores a blanked output.
- Navigate: next, previous, first, last, next/previous **group**, goto by index,
  clear/blank (which keeps the position).
- Four independent output windows; the stage shows live + next + operator notes
  + a clock slot.
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
| 2 — presentation engine | mostly: outputs, clear with restore, keyboard, stage, transitions with project timing, remote, groups. Missing stage timers, output layout options, style-level transitions, `custom.direction` |
| 3 — data | import + native format + media references + copy-in + recent/restore. Missing document importers and FreeShow DB import |
| 4 — media engine | **started.** Items render, video plays in the app (loopback media server), timeline resumes mid-clip, four outputs decode 1080p with 0 dropped frames over 30 s. No continuous sync, audio routing, CPU figures or 10-minute run |
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
| Windows: exe 2.5 MB, installer 3.6 MB built by CI; manifest asserted in the exe | `parity/reports/windows-packaging-2026-11-09.md` |
| Media: VP9 advances 2.04 s over a 2 s wait, 54,205/921,600 pixels differ; reopening 2.5 s in resumes at 3.468 s | `parity/reports/media-playback-2026-11-09.md` |
| Four outputs, 1080p VP9: 841–843 frames each, 0 dropped over 30 s | `parity/reports/media-four-outputs-2026-11-09.md` |

Pictures and raw artefacts: `EVIDENCE.md`.

## Not using Craft Anything

`docs/decisions.md` D10. FreeShow is readable, and every question so far was
answered faster by reading it. The parity work is behavioural, which Craft
Anything does not produce.

## Known deviations

`docs/deviations.md` — nine entries, each with an impact and a way to close it.
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
crates/core     88
crates/compat   25
crates/remote    9
apps/desktop     3
```

## Next, in order

1. **Second physical display.** Experiment 1's placement and focus criteria are
   the only untested part of the walking skeleton. Needs hardware.
2. **FreeShow remote parity (Socket.IO).** Existing FreeShow remote clients
   cannot talk to us. This is the compatibility risk of Phase 2.
3. **Install and run the installer on Windows.** The build is green; nothing has
   been executed. QEMU/KVM is enough for install, uninstall and the WebView2
   bootstrap; monitors still need hardware.
4. **Phase 4 media.** Items render and video plays. Next: a playback coordinator
   behind a trait (pause/resume per slide, position), then four videos at once,
   measured inside the app where the process tree is stable.

## Known gaps and hazards

- **No authentication on the remote**, and it binds `0.0.0.0`. Bind it to
  localhost or add auth before it runs on a shared network.
- **The engine is linear within a show.** Groups are navigation sections, not
  FreeShow's full layout/section model.
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
- **Experiment 3 measured dropped frames only.** CPU cost per surface is
  unmeasured; the proxy harness could not attribute it. Measure in-app.
- **Desktop automation is unreliable on this machine.** Prefer headless
  renders; capture windows by hand.
- **CI is green but the repo history is short.** The original fork's git history
  was absent when this repository started; see `docs/provenance.md`.
