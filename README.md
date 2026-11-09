# CJCRSG Presenter

Rust reimplementation of the CJCRSG Presenter presentation application
(a [FreeShow](https://github.com/ChurchApps/FreeShow) derivative).

**Status: pre-alpha, architecture validation.** Nothing here is production
software yet.

Built on [DioxusLabs/dioxus](https://github.com/DioxusLabs/dioxus) 0.7.10,
desktop target. Dioxus is the framework; under it, `dioxus-desktop` drives a
system WebView through wry (WebKitGTK on Linux, WebView2 on Windows, WKWebView
on macOS) — that WebView is what renders the slides, and it is a dependency of
Dioxus, not an alternative to it.

- [CONTRIBUTING.md](CONTRIBUTING.md) — **developer setup**, Windows notes, contribution rules
- [docs/status.md](docs/status.md) — **start here**: what works now and what is next
- [PROJECT.md](PROJECT.md) — what this is, why, and the stack
- [docs/architecture.md](docs/architecture.md) — the design and its invariants
- [docs/plan.md](docs/plan.md) — phases and exit criteria
- [docs/experiments.md](docs/experiments.md) — the three measurements that gate development
- [docs/decisions.md](docs/decisions.md) — why the expensive choices were made
- [EVIDENCE.md](EVIDENCE.md) — screenshots and raw results per milestone
- [docs/provenance.md](docs/provenance.md) — GPL-3.0 obligations

```bash
cargo test -p presenter-core    # headless; no display server needed
cargo run -p cjcrsg-presenter   # desktop app; needs webkit2gtk-4.1
```
