# Experiment 1 — multi-window Dioxus and state recovery

**Status:** **automated run passed.** Seven checks green; recovery 205 ms.
Second physical display and focus behaviour still unmeasured (see *Not measured*).

**Date:** 2026-11-09
**Commit:** uncommitted working tree (no git history in this directory yet)

## Machine

| | |
| --- | --- |
| CPU | AMD Ryzen 5 5600X |
| GPU | NVIDIA RTX 5060 Ti 16 GB |
| OS | Fedora 44, KDE |
| Session | to be recorded (X11 / Wayland) |
| Displays | to be recorded (count, resolution, refresh rate) |

## Build

System packages required on Fedora:

```bash
sudo dnf install webkit2gtk4.1-devel libsoup3-devel libxdo-devel
```

`libxdo-devel` is needed only at link time: `muda`, pulled in by
`dioxus-desktop`, links `-lxdo` on Linux. Without it the link fails with
`rust-lld: error: unable to find library -lxdo` even though `libxdo.so.3` is
present at runtime.

Build and checks, 2026-11-09:

| Command | Result |
| --- | --- |
| `cargo test -p presenter-core` | 15 passed |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --all --check` | clean |
| `cargo build -p cjcrsg-presenter` | links and builds |

## What is built

| Piece | State |
| --- | --- |
| `presenter-core`: domain, show engine, `RenderHub` | done, tested |
| Controller window with NEXT / PREVIOUS / FIRST | written, uncompiled |
| Output registry (weak window handles, close/reopen) | written, uncompiled |
| Four output windows, one `VirtualDom` each | written, uncompiled |
| Per-output applied-revision readout | written, uncompiled |
| Slide renderer + CSS fade transition | written, uncompiled |
| Fade suppressed on window mount | written, uncompiled |

## Procedure (to run)

1. Open all four outputs; confirm every row reads `rev 0 ✓`.
2. Press NEXT ten times at ~2/second; every output must track the revision.
3. Close Stage; press NEXT five times.
4. Reopen Stage: it must show the **live** slide, not the one it left.
5. Confirm Stage reaches the engine revision within 1 s.
6. Repeat with a window closed across a transition.
7. Leave all four open 10 minutes; record RSS and CPU.
8. Verify isolation: a style or eval in one window cannot affect another.

## Results

Automated run, `CJCRSG_SMOKE=1`, single display, 2026-11-09.
Raw output: `evidence/experiment-1-smoke.json`.

| Criterion | Target | Measured | Pass |
| --- | --- | --- | --- |
| Four outputs open | 4 | 4 | yes |
| State propagation after 10 advances | all at engine revision | all four at rev 10 | yes |
| Closing an output changes engine state | never | engine 10 → 11 after 5 advances with Stage closed | yes |
| Reopen → correct slide | < 1 s | **205 ms** | yes |
| Reopen → applied == engine revision | yes | `Some(11)` vs target 11 | yes |
| Other outputs undisturbed by a reopen | yes | Audience/Preview/Confidence at 11 | yes |
| Process exit code | 0 | 0 | yes |

Raw checks:

```
four outputs open                               open=4
all outputs reach revision after 10 advances    engine=10 applied=[(Audience,10),(Stage,10),(Preview,10),(Confidence,10)]
stage closes                                    close_requested=true now_open=false
engine keeps running with an output closed      10 -> 11
reopened output reaches the live revision       target=11 applied=Some(11) in 205ms
recovery under 1 s                              205ms
other outputs unaffected                        Some(11)
```

## Not measured

These criteria from the procedure have no number yet, and the experiment is not
fully closed without them:

- **Second physical display.** All windows opened on one screen. Monitor
  placement and fullscreen-on-target are untested.
- **Focus stealing.** Not asserted; the automated run cannot detect it.
- **60 fps with four windows.** Not measured. The slides are static, so this
  needs a frame counter, and says more about WebKit than about our code.
- **10-minute idle memory.** Not run.
- **WebView isolation.** Stylesheet and `eval` isolation between windows is
  implied by separate documents but not asserted.

None of these block the architecture question. The first two should be closed
before the outputs area is implemented.

## Decision

**Proceed.** The central claim holds: one engine, independent `VirtualDom`s, and
a closed output that recovers the live slide from a snapshot rather than a
replay. Recovery at 205 ms is far inside the one-second budget.

The renderer work (Experiment 2) is unblocked. Display placement and focus must
be closed before the multi-output features in Phase 2.
