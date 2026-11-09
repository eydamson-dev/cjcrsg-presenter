# Testing on Windows

Status: **partly verified.** The desktop crate compiles on `windows-latest`
(3m51s, run `42543078950`) and the library tests execute there. Nothing has been
*run* on Windows yet — no window has opened — and the manual checklist at the
end is untouched.

The first Windows test run immediately found a real bug: `Path::is_absolute`
returns false for `/home/user/x.mp4` on Windows, so a Linux-authored absolute
media path passed validation. The validator now rejects rooted, drive and UNC
paths explicitly.

## The three testing targets

They need different environments, and conflating them is how "it passes CI"
becomes a false claim.

| Target | What it covers | Where it runs |
| --- | --- | --- |
| **Logic** | `presenter-core`, `presenter-compat`, `presenter-remote` | Any OS, no display, no WebView |
| **Native integration** | Dioxus desktop, wry, WebView2, tao windows, menus, tray | Windows CI can compile it; only a real session can drive it |
| **Presentation output** | Actual WebView2 rendering, monitors, DPI, fullscreen, media | A real Windows machine |

Our 67 tests cover the first category. The SSR + Playwright screenshots cover
part of the third. Neither says anything about the native Windows application.

## Building: what WebView2 actually requires

| Component | Needed to compile | Needed to run |
| --- | --- | --- |
| MSVC toolchain | yes | no |
| WebView2 loader library (`webview2-com-sys`) | yes, supplied through the crate graph | no |
| WebView2 Evergreen Runtime | **no** | **yes** |

So `cargo build` on Windows does not need the WebView2 runtime installed; a
machine running the app does. Do not install the runtime just to compile.

Use the **`x86_64-pc-windows-msvc`** target. The GNU Windows target is not a
supported combination for wry.

No workspace redesign is needed. Keep `apps/desktop` in the workspace and select
the three library packages explicitly in the portable CI job, so that job never
compiles the GUI:

```bash
cargo clippy -p presenter-core -p presenter-compat -p presenter-remote --all-targets -- -D warnings
cargo test   -p presenter-core -p presenter-compat -p presenter-remote
```

## CI layout

`.github/workflows/check.yml` runs three jobs:

| Job | Runner | Purpose |
| --- | --- | --- |
| `library` | ubuntu-24.04 **and** windows-latest | fmt, clippy, tests of the three library crates. No system libraries needed |
| `desktop-linux` | ubuntu-24.04 | full workspace, incl. the desktop crate, plus the `EVIDENCE.md` count check |
| `desktop-windows` | windows-latest | compiles the desktop binary for MSVC and uploads it |

The Linux desktop job installs `libwebkit2gtk-4.1-dev`, `libsoup-3.0-dev`,
`libxdo-dev` and friends; the library matrix needs none of that, which is why it
is fast and worth running on every OS.

## Visual testing: two layers, never cross-compared

**Layer 1 — component regression (exists today).** Dioxus components → HTML via
`dioxus-ssr` → headless Playwright Chromium → screenshot. Deterministic, no
window, works on any OS.

**Layer 2 — real WebView2.** The actual application on Windows, screenshotted
from a real session.

What layer 1 cannot catch, and therefore what layer 2 exists for:

- Windows font fallback and metrics (a slide can wrap differently);
- WebView2 initialisation and version behaviour;
- native window composition, transparency, GPU acceleration;
- per-monitor DPI scaling;
- video hardware decoding;
- multi-window rendering.

**Do not compare a Linux Chromium baseline against a Windows WebView2 screenshot
with strict pixel equality.** Generate each baseline on its own OS and compare
like with like.

For automating the real app, WebView2 exposes the Chrome DevTools Protocol.
Enable remote debugging only in test builds and never by default.

## Windows-specific traps

### Monitors

- Enumeration order is not stable. Identify a display by its device path, never
  by index.
- Persist: device identity, previous bounds, preferred resolution, whether it
  was primary. Restore only if that display still exists, otherwise fall back to
  the primary.
- Validate a saved rectangle against current display bounds before restoring it.

### Fullscreen

- Use **borderless fullscreen on an explicit monitor handle**
  (`Fullscreen::Borderless(Some(monitor))`), not maximise.
- Maximising uses the *work area*, which excludes the taskbar; a presentation
  output needs the whole monitor rectangle.
- Do not use exclusive fullscreen.

### DPI

- Declare **PerMonitorV2** in the application manifest, at process start.
- Handle `WM_DPICHANGED` when a window moves between displays.
- The slide surface stays **1920×1080** and is scaled once by
  `min(clientW/1920, clientH/1080)`, letterboxing the rest.
- **Do not apply DPI scaling twice** — do not multiply the 1920×1080 surface by
  `devicePixelRatio` *and* apply the monitor scale.

### Paths

Keep forward slashes in project files; they are not OS paths. At runtime,
`project_root.join(relative)` — never string concatenation. The validation layer
must handle:

| Problem | Handling |
| --- | --- |
| Case-insensitive filesystems | Detect `Image.jpg` / `image.jpg` collisions during import |
| Drive-relative (`C:foo`) | Reject as ambiguous |
| UNC (`\\server\share`) | Accept for external media |
| Long paths (>260) | `longPathAware` manifest; verify dependencies too |
| Reserved names (`CON`, `NUL`, `COM1`) | Reject |
| Trailing dots/spaces | Reject or normalise on import |
| `\\?\` verbatim prefix | Never persist it as a canonical reference |
| `..` escaping the root | Reject |

Distinguish **missing** media (recoverable, user problem) from **invalid** media
(a validation error).

## Packaging

| Tool | Licence | Verdict |
| --- | --- | --- |
| NSIS | zlib/libpng | **Start here** |
| Inno Setup | permissive | Good alternative |
| WiX | MS-RL | Only if MSI is required |
| `dx bundle` | Dioxus CLI | Worth evaluating for resource integration |

Per-user install into `%LOCALAPPDATA%\Programs\…`, no admin prompt. Application
data stays in `%APPDATA%` / `%LOCALAPPDATA%` and is **not** deleted on uninstall.

**WebView2 Evergreen:** check whether the runtime is present; if not, run the
~2 MB bootstrapper (`/silent /install`) and verify the result. Do not copy the
runtime into the install directory.

**Code signing:** a self-signed certificate is enough to exercise the signing
path for internal builds; it does not establish public trust. Never commit the
PFX or its password.

## What CI cannot test

| Test | Windows CI | Real machine |
| --- | --- | --- |
| Library tests, path handling, import | yes | unnecessary |
| Desktop compilation, installer build | yes | unnecessary |
| App launch, WebView2 page load | yes | recommended |
| Multi-monitor placement | limited | **required** |
| Per-monitor DPI | limited | **required** |
| Fullscreen on a chosen display | limited | **required** |
| Audio devices, NDI, SDI | no | **required** |
| GPU / video decoding | limited | **required** |

Do not let CI pretend a virtual display is a presentation environment.

### Release acceptance checklist (manual)

- Controller launches; all four outputs can be created.
- Outputs target different monitors; fullscreen covers the whole monitor.
- Controller stays usable while outputs are fullscreen.
- Text is correct at 100 %, 125 %, 150 % and 200 % DPI.
- Mixed-DPI monitors work simultaneously.
- Disconnecting and reconnecting an output monitor is handled.
- Restart restores only display assignments that still exist.
- Images, video and audio resolve.
- A machine without WebView2 gets a useful install path.
- Installer and uninstaller both work.

## Getting a real Windows environment

**QEMU/KVM Windows 11 on the Fedora desktop.** 4–6 vCPU, 8 GB RAM, 80–100 GB
disk, virtio storage and network, SPICE or RDP for interaction.

Good enough for: MSVC builds, WebView2 install and launch, native menus, tray,
basic fullscreen, filesystem behaviour, installer testing, font rendering
against Windows fonts, CDP automation.

Not good enough for: hardware video decode, GPU composition, frame pacing,
reliable multi-monitor or EDID changes. A virtual GPU is not a physical one.

`dockur/windows` (MIT) runs the same thing inside Docker if that is preferable;
it is a VM, not a container.

## Open-source tools, and whether they earn a place

| Tool | Licence | Use | Verdict |
| --- | --- | --- | --- |
| [NSIS](https://github.com/NSIS-Dev/nsis) | zlib/libpng | Installer | **Adopt** |
| [Inno Setup](https://github.com/jrsoftware/issrc) | permissive | Installer | Alternative |
| [WiX](https://github.com/wixtoolset/wix) | MS-RL | MSI | Later, if needed |
| [FlaUI](https://github.com/FlaUI/FlaUI) | MIT | Native UIA automation | Useful for native chrome |
| [Appium WinCore Driver](https://github.com/appium/appium-wincore-driver) | MIT | Native **and** WebView2 via CDP | **Investigate first** |
| [Appium Windows Driver](https://github.com/appium/appium-windows-driver) | Apache-2.0 | wraps WinAppDriver | Avoid — depends on an unmaintained driver |
| WinAppDriver | MIT | — | Avoid for new work |
| [pywinauto](https://github.com/pywinauto/pywinauto) | BSD-3 | Scripted native UI | Only if scripting in Python |
| [dockur/windows](https://github.com/dockur/windows) | MIT | Windows VM in Docker | Convenient alternative to QEMU by hand |

The one that matters: our automation must reach **inside the WebView2 control**,
not just the native window chrome. WinCore Driver documents WebView2 + CDP
support and context switching, which is exactly the shape of this app.

## Next actions

1. Split CI into the three jobs above. **Done in the same change as this doc.**
2. Watch the first `windows-latest` run: it is the first time this code compiles
   outside Linux.
3. Write `installer/windows.nsi` and an installer job once the binary builds.
4. Add the DPI manifest and `longPathAware` before any Windows release.
5. Set up the QEMU/KVM VM for the manual checklist.
