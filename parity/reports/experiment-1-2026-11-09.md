# Experiment 1 — multi-window Dioxus and state recovery

**Status:** buildable; not yet run. Waiting on a human to execute the procedure.

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

| Criterion | Target | Measured | Pass |
| --- | --- | --- | --- |
| State propagation, 4 outputs | < 50 ms | — | — |
| Reopen → correct slide | < 1 s | — | — |
| Reopen → applied == engine revision | 100% of 20 | — | — |
| Closing one output changes engine state | never | — | — |
| Closing last output exits app | never | — | — |
| Output steals focus on creation | never | — | — |
| 4 windows, static slide | 60 fps | — | — |
| 4 windows, 10 min idle | stable RSS, CPU < 5% | — | — |

## Decision

Pending. Do not start renderer work until this report has numbers.
