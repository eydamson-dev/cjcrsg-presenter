# Agent instructions — cjcrsg-presenter

Rust reimplementation of the CJCRSG Presenter (a FreeShow derivative).

## Start here

Read in this order, and stop when you have what you need:

1. **`docs/status.md`** — what exists *now*, what is in flight, what is next.
   Update it at the end of every session; it is the handover.
2. **`docs/decisions.md`** — why the expensive choices were made (D1–D9).
3. **`docs/architecture.md`** — the design and the invariants behind it.
4. **`EVIDENCE.md`** — proof per milestone, with pictures and raw artefacts.
5. **`docs/plan.md`** — phases and exit criteria.
6. **`docs/deviations.md`** — what we knowingly do not match, with IDs.
7. **`docs/reference.md`** — how to run FreeShow, its ports, its file format.

`docs/status.md` is the only place that describes current state. Do not restate
it here: this file drifted once already by carrying a "current phase" that was
weeks out of date.

## Invariants — do not break these

1. **No Dioxus in the core.** `crates/core`, `crates/compat` and
   `crates/remote` must not depend on `dioxus`, `dioxus-desktop`, `tao`, or any
   WebView crate. If it cannot be tested with `cargo test` and no window, it
   does not belong there.

2. **The engine owns the show, never a window.** Closing an output window must
   not change the active slide, stop media, or lose state. Reopening must
   reconstruct from the current snapshot — never from replayed events.

3. **One `VirtualDom` per output, one shared state publisher.** Outputs subscribe
   to `SharedEngine`; they do not talk to each other and have no channel of
   their own.

4. **The renderer is a consumer.** It never decides which slide is active. Any
   logic that answers "what is on screen now" lives in the engine.

5. **Dioxus signals are local UI state only.** Never use a signal as a
   cross-window transport.

6. **No 60 Hz traffic from Rust.** Send one transition command and let the
   WebView compositor animate. Never stream frames or per-frame positions.

7. **Preserve unknown data.** The compatibility layer must round-trip fields it
   does not model. A user's project must not lose data because we have not
   implemented a feature yet.

8. **Pin Dioxus.** `dioxus` and `dioxus-desktop` are `=0.7.10`. Commit
   `Cargo.lock`. Keep desktop-specific API use at the edges.

9. **Evidence ships with the work.** Every milestone lands with a screenshot or
   raw artefact under `parity/reports/evidence/` **and** an `EVIDENCE.md` update
   in the same commit. `scripts/check.sh` fails if the page's declared test
   count disagrees with the workspace, so a stale page breaks the build.

## How to verify what you changed

Match the check to the layer. A diff is not a screenshot, and a passing build is
not a working feature.

| Changed | Verify with |
| --- | --- |
| `crates/core`, `compat`, `remote` | `cargo test` — no display server, no window |
| the renderer, CSS, transitions | `render` → `capture_page.mjs` → **open the image and look at it** |
| window lifecycle, recovery | `CJCRSG_SMOKE=1 cargo run -p cjcrsg-presenter` |
| the remote | `serve`, then `curl` the endpoints |
| anything visual | also update `EVIDENCE.md` (invariant 9) |

Never say a UI is correct because the DOM or a metric looks right. Capture it,
look at it, and say what you saw.

## Working agreement

- **One milestone per commit.** The message says what changed *and what was
  measured*. Evidence and its `EVIDENCE.md` update go in the same commit.
- **Two failed attempts at the same technique means change technique**, not end
  the task. This project has been stopped twice by a tooling dead end that a
  different method solved in minutes.
- **Do not report success without having run it in this session.** "It compiles"
  is not "it works"; say which one you did.
- **Do not stop at a milestone boundary.** If the user has asked for the plan to
  be finished, finishing one item is the cue to start the next, not to hand back.
- **Unverified is a state you can report.** Say "not measured" plainly rather
  than implying a pass.
- **Do not quietly change a decision.** If D1–D9 needs revising, record why in
  `docs/decisions.md` in the same change.

## What not to build

- **No Tauri, no Blitz, no second UI framework.** Dioxus on a WebView is the
  decision (D1); it keeps HTML/CSS, which is where the fidelity comes from.
- **No porting Svelte components wholesale.** Port behaviour and the CSS
  contract, not the file structure.
- **No new crate for a few functions.** Extract one when a boundary hurts.
- **No format version bump without a migration and a test.** Unknown fields must
  keep round-tripping (invariant 7).
- **No absolute paths for bundled media.** Relative, forward slashes, inside the
  project root.

## Build and test

```bash
scripts/check.sh                                          # fmt + clippy + tests + evidence count
cargo test -p presenter-core                              # headless, no display needed
cargo run -p cjcrsg-presenter                             # desktop app
cargo run -p cjcrsg-presenter -- render <f.cjcp> out.html # real components to HTML
cargo run -p cjcrsg-presenter -- serve --port 5521        # remote, headless
CJCRSG_SMOKE=1 cargo run -p cjcrsg-presenter              # Experiment 1, automated
```

The desktop app needs `webkit2gtk4.1-devel`, `libsoup3-devel` and
`libxdo-devel` on Linux. `cargo test` must not need a display server.

## Style

- Rust 2021, `rustfmt`, no `unwrap()`/`expect()` outside tests and `main`.
- Typed errors with `thiserror` in libraries; `anyhow` only at the application
  edge.
- Logging with `tracing`; no `println!` outside the CLI.
- Public items get doc comments explaining *why*, not what.
- Comments explain constraints. Do not narrate obvious code.

## Traps

- **`./scripts/check.sh | tail` hides the exit code.** The pipeline's status is
  `tail`'s. A failing fmt check was committed this way. Run it bare.
- **`asset!()` needs the Dioxus CLI.** Without `dx` the stylesheet silently
  fails to load and the window renders as browser defaults, with no error.
  Embed CSS with `include_str!`.
- **`calc()` cannot divide a length by a number inside `scale()`.** Slides use a
  `--slide-scale` variable set by script instead.
- **Wayland refuses focus stealing and offers no capture-by-window-id.** An app
  cannot focus its own window; `spectacle -u` needs a cursor; KWin scripting
  matched the wrong window twice and captured unrelated work. Use
  `dioxus-ssr` + headless Chromium for visual evidence.
- **Playwright's Chromium has no H.264.** Video tests must use VP9/WebM, or they
  pass silently with a dead player.
- **`set_fullscreen()` uses the window's current monitor.** Position first, then
  fullscreen. Monitor indices are not stable identities; never persist one.
- **Last-window-close can exit the app.** Controller and outputs need different
  close policies.
- **WebView window cycles leak.** A `DesktopContext` held strongly inside a
  callback registered on that same window keeps it alive. Use weak references.
- **`pkill -f "cjcrsg-presenter"` kills the invoking shell.** The pattern
  matches its own command line. Use a pid file.
- **The directory was a FreeShow fork.** Git history and provenance matter for
  GPL attribution. See `docs/provenance.md`.
