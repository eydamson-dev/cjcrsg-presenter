# CJCRSG Presenter

Rust reimplementation of the presentation engine and control surface behind the
CJCRSG Presenter — the church/venue presentation application used in services.

- **Upstream product:** [ChurchApps/FreeShow](https://github.com/ChurchApps/FreeShow)
- **Current application:** the `cjcrsg-presenter` fork (Electron 45 + Svelte 3), rebranded upstream
- **This repository:** the Rust successor

## Status

**Pre-alpha — architecture validation.** No feature work begins until the three
experiments in [`docs/experiments.md`](docs/experiments.md) pass. Nothing here
is production software yet.

## What this is, and is not

This is **not** a line-by-line port. It is a reimplementation that keeps three
things so existing users do not notice a migration:

| Kept | Why |
| --- | --- |
| Data formats (`.show`, project JSON, SQLite schema) | Existing projects must open unmodified |
| The visual contract (HTML/CSS) | A lyric slide must look identical, not similar |
| External protocols (remote/stage clients, OSC, MIDI, LTC, NDI) | Existing hardware and phones must keep working |

Everything else is replaced:

| Replaced | With |
| --- | --- |
| Electron main process | Dioxus 0.7 desktop (wry/WebView) |
| Svelte components | Dioxus RSX, reusing the original CSS |
| Four embedded Express/Socket.IO servers | Rust `axum` services |
| Native Node modules (`better-sqlite3`, `sharp`, `macadam`, …) | Rust crates and isolated sidecars |

## Why the rewrite is scoped this way

FreeShow is ~222k LOC (550 `.svelte`, 489 `.ts`) and is **not primarily a UI
application**. It is a real-time, multi-output media engine with a UI attached.
The rewrite therefore separates three concerns that the original intertwines:

1. **Presentation engine** — what is on which output, and when.
2. **Renderers** — how a slide is painted. Stays HTML/CSS in a WebView.
3. **Media and devices** — audio, video, capture, professional AV. Rust, with
   sidecars for vendor SDKs.

The engine never belongs to a window. Outputs are replaceable consumers of
authoritative state. See [`docs/architecture.md`](docs/architecture.md).

## Stack

| Layer | Choice | Version |
| --- | --- | --- |
| UI framework | Dioxus desktop (wry/WebView) | `=0.7.10` |
| Async runtime | Tokio (single application runtime) | `1.x` |
| Remote/stage server | axum + WebSocket | `0.8.x` |
| Persistence | rusqlite (existing schema) | `0.41.x` |
| Media pipeline | HTML `<video>` first, GStreamer later | `0.25.x` |
| MIDI / OSC / LTC | `midir`, `rosc`, `ltc` | — |
| Device I/O (NDI, DeckLink, OMT) | Isolated sidecars behind a C ABI | vendor SDKs |

## Layout

```
crates/core        domain, show engine, render model, RenderHub  (no dioxus)
crates/compat      .show / project JSON / SQLite compatibility layer
apps/desktop       Dioxus application: controller + output windows
apps/remote-web    browser remote / stage client (later)
services/          sidecars: ndi, decklink, omt
parity/            fixtures, golden files, screenshots, scenarios
docs/              architecture, plan, experiments, provenance
```

Crates are deliberately few. Extract a new crate when a boundary hurts, not in
anticipation.

## Commands

```bash
cargo test                      # headless: domain, engine, render model
cargo test -p presenter-core    # the engine alone
cargo run -p cjcrsg-presenter   # the desktop app (needs webkit2gtk-4.1)
```

Linux build dependencies (Fedora):

```bash
sudo dnf install webkit2gtk4.1-devel libsoup3-devel libxdo-devel
```

`libxdo-devel` is needed because `muda` (menu/tray support, pulled in by
`dioxus-desktop`) links `-lxdo` on Linux.

## Licence and provenance

GPL-3.0-only, inherited from FreeShow. Read
[`docs/provenance.md`](docs/provenance.md) before adding code or changing the
licence. This repository must not claim to be an independent clean-room
implementation.
