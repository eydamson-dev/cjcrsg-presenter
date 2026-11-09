# Linux packaging — 2026-11-09

The Windows installer existed; Linux had nothing. There is now a per-user
tarball: binary, desktop entry, icon and an install script that needs no root.

## What ships

```text
./cjcrsg-presenter
./cjcrsg-presenter.desktop
./cjcrsg-presenter.svg
./install.sh
./README.md
./LICENSE
```

`install.sh` copies into `~/.local` by default:

```text
~/.local/bin/cjcrsg-presenter
~/.local/share/applications/cjcrsg-presenter.desktop
~/.local/share/icons/hicolor/scalable/apps/cjcrsg-presenter.svg
```

It accepts `PREFIX=` and `BINARY=` overrides, and in the repository it finds the
binary under `target/release`. No `sudo`, no system directories.

## Verified

| Check | Result |
| --- | --- |
| `desktop-file-validate` | valid, no hints (`Categories=Office;Presentation;`) |
| Install into a scratch prefix | binary, desktop file and icon land, executable bit set |
| Packaged binary runs | `inspect /nonexistent` → `cannot read …: No such file`, exit 2 |
| Icon | renders as intended (below) |

![Application icon](evidence/linux-package/icon.png)

Raw: `evidence/linux-package/` (`tarball.txt`, `desktop-validate.txt`,
`binary-run.txt`, `icon.png`).

## CI

The `desktop-linux` job now builds the release binary after `scripts/check.sh`,
assembles the tarball and uploads `cjcrsg-presenter-linux-x64`. The tarball is
3.4 MB.

## Not done

- **No AppImage or Flatpak.** A tarball plus a per-user script is the smallest
  thing that works; AppImage adds a runtime and a build tool, Flatpak adds a
  manifest and a sandbox policy for media access.
- **No MIME registration.** Double-clicking a `.cjcp` does not open the app;
  that needs a shared-mime-info file and `update-mime-database`.
- **No uninstall script.** Removing three paths by hand is the current answer.
- **No signing or repository.** The tarball is unsigned.
