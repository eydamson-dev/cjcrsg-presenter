# Contributing to CJCRSG Presenter

This guide takes a new machine from nothing to a passing `scripts/check.sh`,
then explains how to run the app and how to contribute. Read
[docs/status.md](docs/status.md) before you start on anything; it is the
handover and says what is built, what is in flight, and what is next.

The project is a Rust reimplementation of the CJCRSG Presenter, which is a
[FreeShow](https://github.com/ChurchApps/FreeShow) derivative. The app uses
[Dioxus](https://github.com/DioxusLabs/dioxus) 0.7.10 (pinned) on a system WebView.

## Supported platforms

| Platform | Status |
| --- | --- |
| Fedora 44 (KDE) | Developed and tested. Commands below were run on this platform. |
| Ubuntu 24.04 | Used by CI (self-hosted proxmox runner). Full build and check. |
| Windows 10/11 (MSVC) | Library crates build and test. The desktop app compiles in CI but has **never been run**. See [Windows](#windows). |
| macOS | Not documented yet. The desktop crate should build with Xcode tools, but nothing here has been verified on macOS. |

## Quick start (Linux)

```bash
# 1. Rust (stable), via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# 2. System libraries (Fedora; Ubuntu list in the next section)
sudo dnf install -y webkit2gtk4.1-devel libsoup3-devel libxdo-devel gtk3-devel \
  librsvg2-devel libappindicator-gtk3-devel openssl-devel pkgconf-pkg-config gcc

# 3. Clone and verify
git clone https://github.com/eydamson-dev/cjcrsg-presenter.git
cd cjcrsg-presenter
scripts/check.sh
```

If `scripts/check.sh` ends with `all green`, the workspace is set up.

## 1. Prerequisites

### Rust

- Install with [rustup](https://rustup.rs). Use the **stable** toolchain.
- `Cargo.toml` declares `rust-version = "1.83"` as the minimum. CI builds with the
  latest stable, so use that when in doubt.
- `rustfmt` and `clippy` are required; `scripts/check.sh` runs both:

  ```bash
  rustup component add rustfmt clippy
  ```

- **Do not** run `cargo update -p dioxus` or change the Dioxus version. Dioxus and
  `dioxus-desktop` are pinned to `=0.7.10` on purpose. Commit `Cargo.lock`.

### Linux system libraries

The desktop app renders through WebKitGTK. The library crates do not need these.
Install them before building `cjcrsg-presenter`.

**Fedora 44** (the packages in the quick start; the first five were confirmed on
this machine):

```bash
sudo dnf install -y webkit2gtk4.1-devel libsoup3-devel libxdo-devel gtk3-devel \
  librsvg2-devel libappindicator-gtk3-devel openssl-devel pkgconf-pkg-config gcc
```

**Ubuntu 24.04** (the same set CI installs, plus a compiler):

```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential pkg-config \
  libwebkit2gtk-4.1-dev libsoup-3.0-dev libxdo-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev libssl-dev
```

The library crates need none of these. You can test them on a machine with only
Rust installed.

### Windows

See [Windows](#windows).

### Optional: parity tooling

Needed only if you work on FreeShow parity. See
[Parity harness (optional)](#parity-harness-optional).

- Node.js 20 or newer (the tools were run on Node 24).
- A Chromium build for Playwright, installed once with `npx playwright install chromium`.
- `ffmpeg` with `libvpx-vp9`, to generate test clips.

## 2. Get the code

```bash
git clone https://github.com/eydamson-dev/cjcrsg-presenter.git
cd cjcrsg-presenter
git checkout main
```

Repository layout:

```
apps/desktop/      the Dioxus desktop binary (cjcrsg-presenter)
crates/core/       presenter-core: engine, state, transitions. No UI.
crates/compat/     presenter-compat: FreeShow import, native format, round-trip
crates/remote/     presenter-remote: HTTP remote (axum)
docs/              status, decisions, architecture, plan, deviations, reference
parity/            FreeShow parity harness: fixtures, tools, reports, evidence
scripts/check.sh   the one command CI runs
```

## 3. Verify the setup

Run the full check. It runs formatting, clippy with warnings as errors, the test
suite, and a check that `EVIDENCE.md` declares the right test count.

```bash
scripts/check.sh
```

Do not pipe it to `tail` or `grep`. A pipeline reports the exit code of its last
command, so a failure can look like a pass. Run it bare.

Run the parts separately while you work:

```bash
cargo test -p presenter-core          # headless, no display server needed
cargo test -p presenter-compat -p presenter-remote
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all --check
```

The library crates (`presenter-core`, `presenter-compat`, `presenter-remote`)
must not depend on Dioxus, `tao`, or any WebView crate. Keep it that way: they
must stay testable with `cargo test` and no window.

## 4. Run the app

Desktop app (Linux; needs the WebKitGTK packages from above):

```bash
cargo run -p cjcrsg-presenter                      # starts with the demo project
cargo run -p cjcrsg-presenter -- path/to/file.cjcp # open a project
```

Headless commands, useful for testing without a window:

```bash
# Serve the HTTP remote (no window). Binds 0.0.0.0 on the given port; no authentication.
# The default port is 5520.
cargo run -p cjcrsg-presenter -- serve --port 5521

# Import a FreeShow .show or project into the native format
cargo run -p cjcrsg-presenter -- import <file.show> <out.cjcp>

# Render a project to HTML (uses the real components)
cargo run -p cjcrsg-presenter -- render <file.cjcp> out.html --layout stage

# Report missing and invalid media in a project
cargo run -p cjcrsg-presenter -- inspect <file.cjcp>

# Copy external media into <root>/media and rewrite paths to relative
cargo run -p cjcrsg-presenter -- bundle <file.cjcp>
```

An unknown command prints the full usage text. The source of truth is
`apps/desktop/src/cli.rs`.

Environment variables used by the app:

| Variable | Effect |
| --- | --- |
| `CJCRSG_PROJECT` | Project path to open on start |
| `CJCRSG_REMOTE=0` | Do not start the HTTP remote with the app |
| `CJCRSG_REMOTE_PORT` | Port for the remote when started with the app |
| `CJCRSG_SMOKE=1` | Run Experiment 1 unattended, write a JSON report, and exit. Output path: `CJCRSG_SMOKE_OUT` |
| `CJCRSG_DEMO_OPEN` | Open demo output windows: `audience`, `stage`, `preview`, `confidence`, or `all` |

## 5. Test the remote

With `serve` running, check the state endpoint:

```bash
curl -s http://127.0.0.1:5521/api/state
```

Then send a command. A command that moves the show returns `200`; a no-op
(for example, next at the end) returns `409`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:5521/api/next
```

The routes are in `crates/remote/src/lib.rs`.

## 6. Visual checks

A passing build does not show that a slide looks right. For anything visual:

1. Render with `render`, or use the parity tools below.
2. Open the image and look at it.
3. Record the result in `EVIDENCE.md` (see [Contribution rules](#contribution-rules)).

Do not claim a UI is correct from DOM output or metrics alone.

## 7. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `pkg-config` cannot find `webkit2gtk-4.1` | WebKitGTK dev package missing. Install the Linux packages above. |
| Window opens but is unstyled, with browser default fonts and layout | The stylesheet did not load. The app embeds CSS with `include_str!`; if you changed how CSS is loaded, check that path. `asset!()` needs the Dioxus CLI (`dx`), which this project does not use. |
| `scripts/check.sh` says `EVIDENCE.md declares N tests` | You added or removed tests. Update the `<!-- tests: N -->` marker and the "As of" line in `EVIDENCE.md`. |
| `pkill -f cjcrsg-presenter` kills your own shell | The pattern matches its own command line. Use a PID file or match a more specific path. |
| Video shows a black frame and no error (parity tests) | Playwright's Chromium has no H.264. Use VP9/WebM. See [docs/reference.md](docs/reference.md). |
| Reference FreeShow renders nothing | `npm run build` is required. `vite build` alone leaves the renderer pointing at source. See [docs/reference.md](docs/reference.md). |
| Remote returns 409 | Not an error. The command was a no-op (for example, next at the end). |

## Windows

Status: the library crates build and their tests run on `windows-latest` in CI.
The desktop binary compiles there too. **Nothing has been run on Windows yet.**
No window has opened, and the manual checklist in [docs/windows.md](docs/windows.md) is untouched.

Setup:

1. Install **Visual Studio Build Tools** with the **Desktop development with C++**
   workload. It provides the MSVC linker.
2. Install Rust with rustup. Choose the default `x86_64-pc-windows-msvc` host.
   Do not use the GNU target; it is not supported by wry.
3. Clone the repo and run the library checks, which do not need a WebView:

   ```powershell
   cargo test -p presenter-core -p presenter-compat -p presenter-remote
   cargo clippy -p presenter-core -p presenter-compat -p presenter-remote --all-targets -- -D warnings
   ```

4. To compile the desktop app:

   ```powershell
   cargo build -p cjcrsg-presenter
   ```

The DPI manifest (`installer/app.manifest`) is embedded automatically by
`apps/desktop/build.rs` when the target is Windows. You do not need to do anything
for it. CI checks that the manifest is present in the built `.exe`.

To build the installer locally (optional; CI does this on every push):

```powershell
choco install nsis -y                         # or install NSIS from nsis.sourceforge.io
Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" `
  -OutFile "installer/MicrosoftEdgeWebview2Setup.exe"
cargo build --release -p cjcrsg-presenter
New-Item -ItemType Directory -Force dist | Out-Null   # NSIS will not create it
$version = (Select-String -Path Cargo.toml -Pattern '^version\s*=\s*"([^"]+)"').Matches[0].Groups[1].Value
& "C:\Program Files (x86)\NSIS\makensis.exe" "/DAPP_VERSION=$version" "installer\windows.nsi"
```

The bootstrapper is a download, not a file in the repo; it is ignored by git.
CI builds the installer but does not run it. Installing and uninstalling on a real
machine is the manual checklist in [docs/windows.md](docs/windows.md).

Notes:

- Compiling does **not** need the WebView2 runtime. Running the app does. The
  runtime is preinstalled on current Windows 10 and 11 machines. If it is missing,
  get the Evergreen runtime from Microsoft.
- `scripts/check.sh` is a bash script. Run its steps by hand on Windows, or use
  Git Bash or WSL.
- Windows found a real path bug early (`Path::is_absolute` is false for `/home/...`
  on Windows). Path validation is strict; run the library tests after any path change.
- `scripts/check.sh` and `cargo run` for the desktop app have not been verified on
  Windows. Report what you see if they fail.

## Parity harness (optional)

The parity harness compares our behaviour and rendering with FreeShow. Skip this
section unless you are working on parity. The full recipe is in
[docs/reference.md](docs/reference.md) and [parity/README.md](parity/README.md).

### 1. FreeShow reference

```bash
mkdir -p ~/projects/reference
git clone https://github.com/ChurchApps/FreeShow.git ~/projects/reference/freeshow
cd ~/projects/reference/freeshow
git checkout ff784eb388c7baef60d67e6d4e7c504f4322bca3   # 1.6.8-beta.3, the pinned reference
npm ci --ignore-scripts
npm run build                                           # not `vite build` alone
```

Keep the reference outside this repo. Its servers start only when a scratch
profile sets `disabledServers` to `false` for each server. See
[docs/reference.md](docs/reference.md) for the profile.

### 2. Parity tools

```bash
cd parity/tools
npm install
npx playwright install chromium
```

The tools use their own `node_modules`; they do not reuse the reference's.

### 3. Test clips

Chromium in Playwright cannot play H.264. Generate VP9/WebM clips:

```bash
ffmpeg -f lavfi -i "testsrc2=size=1920x1080:rate=30:duration=15" \
  -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -b:v 0 -crf 32 out.webm
```

## Contribution rules

These come from [AGENTS.md](AGENTS.md), which is the authority. Read it once.

- **One milestone per commit.** The message says what changed *and what was measured*.
- **Evidence ships with the work.** A milestone needs a screenshot or raw artefact
  under `parity/reports/evidence/` and an `EVIDENCE.md` update in the same commit.
  `scripts/check.sh` fails if the declared test count is stale.
- **Run the check before you push.** `scripts/check.sh` must end with `all green`,
  run bare (not piped).
- **Say how you verified.** "It compiles" is not "it works". Say which you ran.
  Use "not measured" for anything unverified.
- **Do not change the decisions silently.** If a decision in `docs/decisions.md`
  (D1–D10) needs revisiting, record why in the same change.
- **Keep the core framework-free.** No Dioxus, `tao`, or WebView crates in
  `crates/core`, `crates/compat`, or `crates/remote`.
- **Preserve unknown data.** Compatibility code must round-trip fields it does not
  model. A format version bump needs a migration and a test.
- **Relative media paths only.** Forward slashes, inside the project root. No
  absolute paths for bundled media.
- **Do not add a crate for a few functions.** Extract one when a boundary hurts.
- **Do not add Tauri, Blitz, or a second UI framework.** Dioxus on a WebView is the decision (D1).
- **Public items get doc comments that explain *why*.** Comments explain constraints;
  do not narrate obvious code.
- **Style:** Rust 2021, `rustfmt`, no `unwrap()`/`expect()` outside tests and `main`,
  `thiserror` in libraries, `anyhow` only at the application edge, `tracing` for logs
  (no `println!` outside the CLI).

Before you open a pull request:

```bash
scripts/check.sh                       # must print: all green
git status                             # no stray files; target/ and node_modules/ are ignored
```

Update [docs/status.md](docs/status.md) at the end of a session if the state of
the project changed.

## Licence

GPL-3.0-only. The project is a FreeShow derivative; see
[docs/provenance.md](docs/provenance.md) for attribution obligations. By
contributing you agree that your contribution is released under the same licence.
