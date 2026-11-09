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
| 2 — presentation engine | mostly: outputs, clear, stage, transitions with project timing, remote, groups. Missing stage timers, output layout options, style-level transitions, `custom.direction` |
| 3 — data | import + native format + media references + copy-in. Missing persistence, document importers |
| 4 — media engine | not started |
| 5 — professional AV | not started (needs hardware) |
| 6 — release/packaging | not started |

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
| Stage | `parity/reports/stage-2026-11-09.md` |
| Transitions | `parity/reports/transitions-2026-11-09.md` |
| Transition timing: 1200 ms imported timing honoured; sine/linear ratio 0.571 vs 0.586 | `parity/reports/transition-timing-2026-11-09.md` |
| Media copy-in: copied bytes identical, project portable after the originals are deleted | `parity/reports/media-copy-in-2026-11-09.md` |

Pictures and raw artefacts: `EVIDENCE.md`.

## Not using Craft Anything

`docs/decisions.md` D10. FreeShow is readable, and every question so far was
answered faster by reading it. The parity work is behavioural, which Craft
Anything does not produce.

## Known deviations

`docs/deviations.md` — ten entries, each with an impact and a way to close it.
Read it before claiming parity on anything.

## Windows

Never *run* on Windows. But it now compiles and its library tests execute there:
the first Windows run built the desktop binary in 3m51s and caught a real path
bug (`Path::is_absolute` is false for `/home/...` on Windows); after the fix all
four CI jobs are green. See
`docs/windows.md`; monitors, DPI, fullscreen and audio still need a real machine.

## Tests

```
crates/core     60
crates/compat   23
crates/remote    8
```

## Next, in order

1. **Persistence.** Recent projects, restore-on-start. The format is settled;
   this is UI and storage plumbing.
2. **Second physical display.** Experiment 1's placement and focus criteria are
   the only untested part of the walking skeleton. Needs hardware.
3. **FreeShow remote parity (Socket.IO).** Existing FreeShow remote clients
   cannot talk to us. This is the compatibility risk of Phase 2.
4. **Phase 4 media.** Start with a playback coordinator behind a trait; measure
   CPU inside the app, where the process tree is stable.

## Known gaps and hazards

- **No authentication on the remote**, and it binds `0.0.0.0`. Bind it to
  localhost or add auth before it runs on a shared network.
- **The engine is linear within a show.** Groups are navigation sections, not
  FreeShow's full layout/section model.
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
