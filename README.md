# CJCRSG Presenter

Rust reimplementation of the CJCRSG Presenter presentation application
(a [FreeShow](https://github.com/ChurchApps/FreeShow) derivative).

**Status: pre-alpha, architecture validation.** Nothing here is production
software yet.

- [PROJECT.md](PROJECT.md) — what this is, why, and the stack
- [docs/architecture.md](docs/architecture.md) — the design and its invariants
- [docs/plan.md](docs/plan.md) — phases and exit criteria
- [docs/experiments.md](docs/experiments.md) — the three measurements that gate development
- [docs/provenance.md](docs/provenance.md) — GPL-3.0 obligations

```bash
cargo test -p presenter-core    # headless; no display server needed
cargo run -p cjcrsg-presenter   # desktop app; needs webkit2gtk-4.1
```
