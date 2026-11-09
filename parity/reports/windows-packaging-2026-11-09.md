# Windows packaging — 2026-11-09

`docs/windows.md` listed packaging as a next action. The app now has an
application manifest with per-monitor DPI awareness, and CI builds a per-user
NSIS installer. **Neither the installer nor the app has been run on Windows** —
this report says exactly what was built and checked, and nothing more.

## The manifest

`installer/app.manifest`, embedded into the executable by
`apps/desktop/build.rs` (only when the target is Windows, so Linux builds are
untouched):

| Setting | Why |
| --- | --- |
| `dpiAwareness` = `PerMonitorV2` | Outputs live on their own monitors; the slide surface is a fixed 1920×1080 scaled once. Without this Windows virtualises the window and the scale is applied twice on mixed-DPI setups |
| `longPathAware` | Media can live on deep network shares; validation does not rely on it, but the machine may |
| `dpiAware` = `true/pm` | Older Windows versions read the pre-2016 element |
| `asInvoker` | A presentation app has no reason to elevate |

DPI awareness has to be decided before `main()` runs, which is why it is in the
manifest rather than in Rust code.

## The installer

`installer/windows.nsi`:

- **Per-user**: `%LOCALAPPDATA%\Programs\CJCRSG Presenter`, `RequestExecutionLevel
  user` — a volunteer should not need an administrator password.
- **Shortcuts**: Start menu folder and desktop.
- **Uninstall**: `Uninstall.exe` plus an HKCU `Add or Remove Programs` entry.
- **WebView2**: reads the Evergreen runtime's registry key; if absent, runs the
  bundled ~2 MB bootstrapper with `/silent /install`, then verifies. If it is
  still absent the install aborts with a message pointing at the download,
  rather than installing an app that opens a blank window.
- **App data survives uninstall**: recent projects stay in `%APPDATA%`, so a
  reinstall remembers them.

The bootstrapper is downloaded in CI and is not committed.

## What CI proved

Run `42549750166`, all four jobs green:

| Step | Result |
| --- | --- |
| `cargo build --release --target x86_64-pc-windows-msvc` | passed |
| Manifest embedded (search the exe for `PerMonitorV2` and `longPathAware`) | passed |
| WebView2 bootstrapper downloaded | passed |
| NSIS installed (`choco install nsis`) | passed |
| `makensis` | passed |

Artifacts from that run:

```text
cjcrsg-presenter-windows-x64              2,512,133 bytes
cjcrsg-presenter-windows-x64-installer    3,582,951 bytes
```

The first attempt failed honestly: `Can't open output file`, because NSIS does
not create the output directory. `dist/` is now created before `makensis`.

## What is still unverified

Everything that needs a Windows session:

- the installer running, and the app launching from it;
- the WebView2 branch on a machine that has never had the runtime;
- uninstall and reinstall, and whether app data survives;
- per-monitor DPI, mixed-DPI setups, fullscreen on a chosen display;
- code signing (none configured; the artifact is unsigned).

`docs/windows.md` keeps the manual checklist for these. A QEMU/KVM Windows 11 VM
is enough for install/uninstall and DPI at a single scale; multi-monitor and GPU
composition still need hardware.

## Files

| File | Purpose |
| --- | --- |
| `installer/app.manifest` | DPI + long paths + supported OS |
| `installer/app.rc` | manifest as resource 24 |
| `apps/desktop/build.rs` | embeds it, Windows targets only |
| `installer/windows.nsi` | the installer |
| `.github/workflows/check.yml` | build, manifest assertion, installer, artifacts |
