# Agent instructions — cjcrsg-presenter

Rust reimplementation of the CJCRSG Presenter (a FreeShow derivative).
Read `PROJECT.md`, `docs/architecture.md` and `docs/experiments.md` before
changing code.

## Current phase

**Architecture validation.** Do not add product features, and do not port
Svelte components or device integrations, until the three experiments in
`docs/experiments.md` pass with recorded results. The experiments exist to fail
cheaply; skipping them converts a one-day risk into a one-quarter one.

## Invariants — do not break these

1. **No Dioxus in the core.** `crates/core` (and later `crates/compat`,
   `crates/persistence`) must not depend on `dioxus`, `dioxus-desktop`, `tao`,
   or any WebView crate. If it cannot be tested with `cargo test` and no window,
   it does not belong in the core.

2. **The engine owns the show, never a window.** Closing an output window must
   not change the active slide, stop media, or lose state. Reopening must
   reconstruct from the current snapshot — never from replayed events.

3. **One VirtualDom per output, one shared state publisher.** Outputs subscribe
   to `RenderHub`; they do not talk to each other and have no channel of their
   own.

4. **The renderer is a consumer.** It never decides which slide is active. Any
   logic that answers "what is on screen now" lives in the engine.

5. **Dioxus signals are local UI state only.** Never use a signal as a
   cross-window transport.

6. **No 60 Hz traffic from Rust.** Send one transition command and let the
   WebView compositor animate. Never stream frames or per-frame positions.

7. **Preserve unknown data.** The compatibility layer must round-trip fields it
   does not model (`#[serde(flatten)]` extension maps). A user's project must
   not lose data because we have not implemented a feature yet.

8. **Pin Dioxus.** `dioxus` and `dioxus-desktop` are `=0.7.10`. Commit
   `Cargo.lock`. Isolate desktop-specific API use behind one adapter module so a
   0.x upgrade is a contained change.

## Build and test

```bash
cargo test                 # headless; must pass without a display server
cargo test -p presenter-core
cargo run -p cjcrsg-presenter
cargo clippy --workspace --all-targets -- -D warnings
```

The desktop app needs `webkit2gtk4.1-devel` on Linux. `cargo test` must not.

## Style

- Rust 2021, `rustfmt`, no `unwrap()`/`expect()` outside tests and `main`.
- Typed errors with `thiserror` in libraries; `anyhow` only at the application
  edge.
- Logging with `tracing`; no `println!` outside examples.
- Public items get doc comments explaining *why*, not what.
- Comments explain constraints. Do not narrate obvious code.

## Traps

- **The directory was a FreeShow fork.** Git history and provenance matter for
  GPL attribution. Do not rewrite or re-init history to "clean it up" —
  see `docs/provenance.md`.
- **`set_fullscreen()` uses the window's current monitor**, not a chosen one.
  Position the window on the target monitor first, then fullscreen.
- **Monitor indices are not stable identities.** Enumerate and match on
  geometry/name; never persist a raw index.
- **Last-window-close can exit the app.** Give the controller and the output
  windows different close policies.
- **WebView window cycles leak.** A `DesktopContext` held strongly inside a
  callback registered on that same window keeps it alive. Use weak references.
- **Experiment results are data.** Record measurements in `parity/reports/`,
  not in chat. A conclusion without a number is an opinion.
