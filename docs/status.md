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
- Navigate: next, previous, first, last, next/previous **group**, goto by index,
  clear/blank (which keeps the position).
- Four independent output windows; the stage shows live + next + operator notes
  + a clock slot.
- All eight of FreeShow's transitions.
- An HTTP remote that drives all of the above, returning 409 for a no-op.
- Close any output, keep presenting, reopen it and it returns to the live slide
  in ~180 ms.

## Phases

| Phase | State |
| --- | --- |
| 0 — architecture validation | **done.** All three experiments measured |
| 1 — walking skeleton | **done** except the second physical display |
| 2 — presentation engine | mostly: outputs, clear, stage, transitions, remote, groups. Missing per-transition duration/easing, stage timers, output layout options |
| 3 — data | import + native format + media references. Missing persistence, media copy-in, document importers |
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

Pictures and raw artefacts: `EVIDENCE.md`.

## Tests

```
crates/core     39
crates/compat   20
crates/remote    8
```

## Next, in order

1. **Per-transition duration and easing.** FreeShow stores `duration` and
   `easing` per transition; we hardcode 400 ms ease-out. Small, closes a known
   deviation.
2. **Media copy-in.** Turn an `External` asset into a `Bundled` one by copying
   it into the project and rewriting the path. Needed before a project can be
   shared or zipped.
3. **Persistence.** Recent projects, restore-on-start. The format is settled;
   this is UI and storage plumbing.
4. **Second physical display.** Experiment 1's placement and focus criteria are
   the only untested part of the walking skeleton. Needs hardware.
5. **FreeShow remote parity (Socket.IO).** Existing FreeShow remote clients
   cannot talk to us. This is the compatibility risk of Phase 2.
6. **Phase 4 media.** Start with a playback coordinator behind a trait; measure
   CPU inside the app, where the process tree is stable.

## Known gaps and hazards

- **No authentication on the remote**, and it binds `0.0.0.0`. Bind it to
  localhost or add auth before it runs on a shared network.
- **The engine is linear within a show.** Groups are navigation sections, not
  FreeShow's full layout/section model.
- **`nav.bounds.next-at-end` is unverified** against the reference. Ours ignores
  next at the end; FreeShow may wrap or stop.
- **Transition timing is fixed** at 400 ms ease-out for every effect.
- **Experiment 3 measured dropped frames only.** CPU cost per surface is
  unmeasured; the proxy harness could not attribute it. Measure in-app.
- **Desktop automation is unreliable on this machine.** Prefer headless
  renders; capture windows by hand.
- **CI is green but the repo history is short.** The original fork's git history
  was absent when this repository started; see `docs/provenance.md`.
