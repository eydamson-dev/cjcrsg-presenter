# Status

What exists, what does not, and what to do next. Update this at the end of every
working session; it is the handover.

Last updated: 2026-11-09.

## Where the project stands

**Phase 0 — architecture validation.** Experiment 1 passed. Experiment 2 has a
first measurement (glyph metrics exact; a true 16:9 reference is still needed).
Experiment 3 ran: four surfaces, zero dropped frames; CPU cost still unmeasured in-app.

**Phase 1 — walking skeleton.** Except the second physical display, done:
a project loads, a show advances, outputs render, a remote can drive it, and a
closed output recovers. The remote protocol is ours (JSON over HTTP), not
FreeShow's Socket.IO.

**Phase 2 — presentation engine.** Partly done: output manager with four
independent windows, clear/blank, stage display with the next slide, fade
transition, remote commands. Missing: layout options, transition parity with
FreeShow, group semantics beyond linear order.

**Phase 3 — data.** Import and native format done; persistence, media and
document importers are not started.

**Phases 4–6.** Not started. Media, professional AV, release.

## Verified, with evidence

| Claim | Evidence |
| --- | --- |
| Four output windows share one publisher and recover in 205 ms | `parity/reports/experiment-1-2026-11-09.md` |
| Chromium renders the same slide bit-identically across runs | `parity/reports/calibration-2026-11-09.md` |
| FreeShow's web clients can be driven; navigation is on 5512 | `parity/reports/preflight-2026-11-09.md` |
| FreeShow `.show` imports; `.cjcp` preserves unknown fields | `parity/reports/data-layer-2026-11-09.md` |
| The remote drives the engine and reports no-ops as 409 | `parity/reports/remote-2026-11-09.md` |
| Stage state carries the next slide | `parity/reports/stage-2026-11-09.md` (no screenshot) |

## Test counts

```
crates/core     39
crates/compat   20
crates/remote    8
```

Run everything with `scripts/check.sh`.

## Decisions

`docs/decisions.md` records why the expensive choices were made: Dioxus on a
WebView, fixed-resolution rendering, one VirtualDom per output, snapshots over
events, JSON-first format, relative media paths, GPL, and headless visual
evidence.

## Next, in order

1. **Experiment 2 — renderer parity.** Needs one full-size capture of a FreeShow
   slide and our renderer at the same viewport. This is the highest-risk unknown
   and it gates renderer work.
2. **Stage screenshot.** `CJCRSG_DEMO_OPEN=stage cargo run -p cjcrsg-presenter -- <file.cjcp>`
   then capture the "CJCRSG — Stage" window. The only milestone without visual
   evidence.
3. **Experiment 3 — video.** Same clip in 2 and 4 windows; measures whether the
   WebView decodes it once or four times.
4. **Second display.** Experiment 1's placement and focus criteria.
5. **Transition parity.** FreeShow's transition set, not just a fade.

## Known gaps and hazards

- **CI does not run yet.** `.github/workflows/check.yml` is committed and pins
  `ubuntu-24.04`, but GitHub refuses to start the job: "recent account payments
  have failed or your spending limit needs to be increased". That is an account
  setting, not a workflow problem. Until it is resolved, run `scripts/check.sh`
  locally.

- **No authentication on the remote**, and it binds `0.0.0.0`. Bound it to
  localhost or add auth before it runs on a shared network.
- **Monitor placement is untested.** `set_fullscreen` uses the window's current
  monitor; positioning first is unproven.
- **Desktop automation is unreliable here.** KWin scripting raised the wrong
  window twice and captured unrelated work. Prefer headless captures; when a
  window is required, do it by hand.
- **The engine is linear.** FreeShow has group-level semantics (groups, layout
  sections) that we have not modelled; `next` walks a flattened list.
- **`nav.bounds.next-at-end` is unverified** against the reference. Our engine
  ignores next at the end; FreeShow may wrap or stop.
