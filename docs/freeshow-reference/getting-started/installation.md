# Installation

- **ID:** `gs.install.windows`, `gs.install.macos`, `gs.install.linux`
- **Area:** getting-started
- **Online docs:** <https://freeshow.app/docs/windows> (also
  <https://freeshow.app/docs/macos> and <https://freeshow.app/docs/linux>)
- **Pinned code:** ff784eb
- **Confidence:** `code` — installers and first-launch behaviour are read from the
  pinned source; the Windows install scope and the auto-update feed are `unknown`.

## Summary

FreeShow ships as a signed NSIS installer on Windows, a DMG/ZIP on macOS, and
AppImage/deb/rpm plus a snap on Linux. On first launch it creates its data folder,
starts its local servers (which can trigger a firewall or network-permission
prompt), and later checks GitHub releases for updates. This page covers installer
behaviour, the permission prompts, auto-update, and the documented escape hatches.

## What the user sees

- **Windows:** download the `.exe` and double-click it [doc]
  (`source/docs/windows.md:8-10`); WinGet package `ChurchApps.FreeShow` is an
  alternative, described as not regularly updated [doc]
  (`source/docs/windows.md:21-29`). After launch Windows may show a firewall alert
  for the local servers [doc] (`source/docs/windows.md:31-35`).
- **macOS:** open the `.dmg`, drag FreeShow into Applications, then open it [doc]
  (`source/docs/macos.md:10-21`). macOS asks whether to allow incoming network
  connections [doc] (`source/docs/macos.md:23-27`).
- **Linux:** install from the snap store, the AUR, an AppImage, or a deb/rpm
  package [doc] (`source/docs/linux.md:8-60`). The AppImage must first be marked
  executable [doc] (`source/docs/linux.md:35-44`).
- **Updates:** About shows the version and a "Check updates" button [code]
  (`src/frontend/components/main/popups/About.svelte:31-35`); the update manager
  shows alert/auto-update toggles, the latest version, and a download button [code]
  (`src/frontend/components/main/popups/UpdateManager.svelte:67-95`). A newer
  release opens a popup with the changelog and a download button [code]
  (`src/frontend/components/main/popups/NewUpdate.svelte:24-39`).

Screenshot: `../screenshots/getting-started-installation.png` — not yet captured.

Shot list:

1. Windows 11, NSIS installer at its first page, default window size. Controls
   visible: installer title, install button, licence/options as shipped.
2. Windows 11, first launch, Windows Defender Firewall prompt for FreeShow. Controls
   visible: network types and Allow/Cancel.
3. macOS 14, mounted DMG window. Controls visible: FreeShow icon and the
   Applications shortcut.
4. Linux (Fedora/GNOME), Files showing a downloaded FreeShow AppImage with
   "Allow executing file as program" enabled, and the same file launched.
5. Settings > Other, 1440×900, update manager popup open. Controls visible: "Alert
   updates", "Auto updates", version comparison and "Download latest".

## How it behaves

### Packaging per platform

1. Windows target is NSIS [code] (`config/building/electron-builder.yaml:27`).
   Artefacts are named `FreeShow-<version>-<arch>.<ext>` [code]
   (`config/building/electron-builder.yaml:3`). Windows binaries are signed through
   Azure Trusted Signing with publisher name "Live Church Solutions" [code]
   (`config/building/electron-builder.yaml:37-41`).
2. macOS targets are dmg and zip for x64 and arm64 [code]
   (`config/building/electron-builder.yaml:81-89`); the DMG window contains a link
   to `/Applications` [code] (`config/building/electron-builder.yaml:106-115`).
   Hardened runtime is on [code] (`config/building/electron-builder.yaml:91`); the
   app declares microphone, camera and audio-capture usage strings and entitlements
   [code] (`config/building/electron-builder.yaml:96-101`).
3. Linux targets are AppImage, deb and rpm [code]
   (`config/building/electron-builder.yaml:56-59`); the deb depends on
   `libfontconfig1`, `uuid-runtime`, `libltc11`, `libavahi-client3` and
   `avahi-daemon` [code] (`config/building/electron-builder.yaml:62-68`).

### First launch

1. The app creates its data root. The default is `Documents/FreeShow`; if that is
   absent it is created, and if it is not writable the code falls back to the
   Electron app-data directory [code] (`src/electron/utils/files.ts:372-392`). The
   data root contains Shows, Backups, Bibles, Exports, Imports, Media, Recordings,
   Audio and Config [code] (`src/electron/utils/files.ts:356-370`).
2. If no writable data folder can be created, an alert tells the user to check
   permissions or install as administrator [code]
   (`src/electron/data/store.ts:168-170`).
3. The local servers start during app startup [code] (`src/electron/index.ts:163-168`).
   The Windows firewall and macOS incoming-connections prompts therefore appear at
   or shortly after first launch; denying them blocks remote clients and the stage
   display, not the main window [doc] (`source/docs/windows.md:33`,
   `source/docs/macos.md:25`).
4. Window bounds and the maximized state are restored from `config.json` [code]
   (`src/electron/index.ts:204-250`, `:252-260`).

### Auto-update

Two independent mechanisms run:

1. **Release check in the UI.** With update alerts on, the frontend fetches
   `https://api.github.com/repos/ChurchApps/freeshow/releases`, compares the tag to
   the running version, and opens the new-update popup when they differ [code]
   (`src/frontend/utils/checkForUpdates.ts:10-44`). The check is scheduled when the
   `alertUpdates` setting is applied at startup [code]
   (`src/frontend/utils/updateSettings.ts:322-325`). Beta builds (version contains
   `-beta`) or the beta-alert setting include prereleases [code]
   (`src/frontend/utils/checkForUpdates.ts:31`). The popup's download button opens
   freeshow.app for stable releases and the GitHub releases page for betas [code]
   (`src/frontend/components/main/popups/NewUpdate.svelte:15-21`).
2. **Native updater.** When `special.autoUpdates` is set, the frontend sends
   `Main.AUTO_UPDATE` [code] (`src/frontend/utils/updateSettings.ts:425-427`); the
   main process calls `autoUpdater.checkForUpdatesAndNotify()` [code]
   (`src/electron/IPC/responsesMain.ts:93`, `src/electron/utils/updater.ts:7-14`).
   The toggle is in the update manager [code]
   (`src/frontend/components/main/popups/UpdateManager.svelte:75`).
   The updater is `electron-updater` [code] (`package.json:135`).

The FAQ says auto-updates need write permission to the new files, and on Windows may
require installing/running as administrator [doc] (`source/docs/faq.md:98-100`).

### macOS notarization

- The builder's own `notarize` option is off [code]
  (`config/building/electron-builder.yaml:93`), but an `afterSign` hook runs
  `@electron/notarize` using `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and
  `APPLE_TEAM_ID` from the environment [code] (`scripts/macos/notarize.js:6-18`,
  `config/building/electron-builder.yaml:104`). The DMG itself is not signed
  [code] (`config/building/electron-builder.yaml:108`).
- Whether release builds actually notarize depends on those secrets being present in
  the release environment; that is not recorded in this checkout — `unknown`.

### Kiosk escape and recovery files

- The FAQ says macOS kiosk mode turns itself off after five seconds unless
  confirmed, and that a file named `DISABLE_KIOSK_MODE` in `Documents/FreeShow`
  disables kiosk mode at startup [doc] (`source/docs/faq.md:72-74`).
- At the pinned commit there is no kiosk activation: the only live call is
  `window.setKiosk(false)` when an output window is hidden [code]
  (`src/electron/output/helpers/OutputVisibility.ts:150-156`). Other kiosk lines are
  commented out [code] (`src/electron/utils/windowOptions.ts:55-58`,
  `src/frontend/components/settings/Screens.svelte:124`, `:131`).
- The startup fixer recognises only file names containing `OPEN_APPDATA_SETTINGS`
  (opens the settings file location) and `ADMIN_PROFILE` (opens the admin profile)
  [code] (`src/electron/utils/files.ts:1472-1483`). `DISABLE_KIOSK_MODE` is not in
  that list at this commit, so the documented file has no effect here [code].
- The FAQ's admin-profile escape claims the same two routes: the `ADMIN_PROFILE`
  file and a `--profile=admin` / `-p=Editor` argument [doc]
  (`source/docs/faq.md:76-78`). Both exist in the code: the command-line parser
  accepts `--profile=` and `-p=` [code] (`src/electron/utils/init.ts:8-22`).
- The FAQ's macOS right-click caveat (two-finger right-click can behave differently
  from Ctrl+trackpad or an external mouse) is documented behaviour of the OS, with
  no code counterpart [doc] (`source/docs/faq.md:68-70`).

## State and persistence

| What | Where it lives | When it is written | Survives restart |
| --- | --- | --- | --- |
| Electron config: bounds, maximized, data path, hardware-acceleration flag | `config.json` in the Electron user-data directory (`appDataPath` is the directory containing `config.json`) [code] (`src/electron/data/store.ts:55`, `src/electron/data/defaults.ts:3`) | on window move/resize/maximize [code] (`src/electron/index.ts:302-337`); setting changes | yes |
| Show/project data root | `Documents/FreeShow` by default; `config.dataPath` overrides it [code] (`src/electron/utils/files.ts:372-395`) | created at startup | yes |
| App settings | `settings.json` in the portable-store directory [code] (`src/electron/data/store.ts:32`) | on save | yes |
| Exports | `<data root>/Exports` [code] (`src/electron/data/export.ts:305`) | on export | yes |
| Imported project media | `<data root>/Imports/Projects` [code] (`src/electron/data/import.ts:188-192`) | on project import | yes |
| Downloaded update | Managed by `electron-updater`, outside this repository — `unknown` | — | — |

## Settings

| Setting | Key and location | Default | Effect |
| --- | --- | --- | --- |
| Alert for updates | `alertUpdates`, update manager (About or Settings > Other) [code] (`src/frontend/components/main/popups/UpdateManager.svelte:69`) | on [code] (`src/frontend/utils/updateSettings.ts:322-323`) | startup GitHub release check and new-update popup |
| Auto updates | `special.autoUpdates`, same popup [code] (`UpdateManager.svelte:75`) | off | enables the native updater check |
| Beta alerts | `special.betaVersionAlert`, same popup [code] (`UpdateManager.svelte:71`) | off; beta builds include prereleases automatically [code] (`src/frontend/utils/checkForUpdates.ts:31`) | whether prereleases are offered |
| Disable hardware acceleration | `disableHardwareAcceleration`, Settings > Other [code] (`src/frontend/components/settings/tabs/Other.svelte:80`, `:16-17`) | off (acceleration on) [code] (`src/frontend/components/settings/tabs/Other.svelte:49`) | calls `app.disableHardwareAcceleration()` at startup [code] (`src/electron/index.ts:91-98`) |

## Code

- `config/building/electron-builder.yaml:1-3` — identity and artefact names.
- `config/building/electron-builder.yaml:26-41` — Windows NSIS and signing.
- `config/building/electron-builder.yaml:45-68` — Linux targets and deb dependencies.
- `config/building/electron-builder.yaml:72-115` — macOS targets, entitlements, DMG.
- `config/building/snapcraft.yaml:1-65` — snap definition (version 1.4.9, strict
  confinement, plugs).
- `scripts/macos/notarize.js:6-18` — notarization hook.
- `src/electron/utils/files.ts:356-395` — data folders and default root.
- `src/electron/data/store.ts:168-170` — "install as administrator" alert.
- `src/electron/IPC/responsesMain.ts:93` and `src/electron/utils/updater.ts:7-14` —
  native update check.
- `src/frontend/utils/checkForUpdates.ts:10-44` — GitHub release check.
- `src/frontend/components/main/popups/UpdateManager.svelte:67-95` — update UI.
- `src/electron/utils/files.ts:1472-1483` — recovery-file fixer.
- `src/electron/utils/init.ts:8-22` — `--profile=` / `-p=` parsing.

## Online docs

- <https://freeshow.app/docs/windows> — `.exe`, WinGet, firewall prompt, data path,
  older-Windows versions.
- <https://freeshow.app/docs/macos> — DMG steps, network permission, data path,
  older-macOS versions.
- <https://freeshow.app/docs/linux> — snap, AUR, AppImage, arm64, deb/rpm,
  Chromebook/Android notes, data path.
- <https://freeshow.app/docs/faq> — administrator rights for updates, kiosk escape,
  admin-profile escape, macOS right-click caveat.

## Doc vs code

- `doc` says a `DISABLE_KIOSK_MODE` file turns kiosk mode off at startup
  (`source/docs/faq.md:74`); the pinned fixer has no such key
  (`src/electron/utils/files.ts:1475-1483`), and kiosk mode itself is not reachable
  in the code (`src/electron/output/helpers/OutputVisibility.ts:155`,
  `src/electron/utils/windowOptions.ts:58`, `src/frontend/components/settings/Screens.svelte:124`).
- `doc` gives the per-platform "application data path" (`source/docs/windows.md:37-43`,
  `source/docs/macos.md:29-35`, `source/docs/linux.md:62-68`). The code uses that
  directory for `config.json` (`src/electron/data/store.ts:55`), while the show and
  project data root is `Documents/FreeShow` (`src/electron/utils/files.ts:372-392`).
  The install pages do not mention the second location; `data.md` does.
- `doc` says auto-updates may need administrator rights (`source/docs/faq.md:100`);
  the builder config sets no NSIS `perMachine`/`oneClick`/`allowElevation` options
  (`config/building/electron-builder.yaml:26-41`), so the actual install scope is
  electron-builder's default and was not established. The code's own alert also
  suggests installing as administrator when the data folder is not writable
  (`src/electron/data/store.ts:168-170`).
- `doc` for macOS still describes the old right-click-to-open workaround only in the
  FAQ's trackpad note (`source/docs/faq.md:68-70`); the older right-click-to-open
  DMG instruction is commented out in the macOS page (`source/docs/macos.md:8`).

## Open questions

- **Windows install scope:** per-user or per-machine, and whether elevation is
  requested. Establish by running the NSIS installer and checking the install path
  and UAC prompt.
- **Auto-update feed:** no `publish` block exists in the builder config
  (`config/building/electron-builder.yaml`), while the release script passes
  `--publish always` (`package.json:41`). Establish from a packaged app's
  `app-update.yml` or the release CI.
- **Notarization in practice:** establish whether the release environment defines
  `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`.
- **Whether the published snap is built from `config/building/snapcraft.yaml`:** that
  file still pins version `1.4.9` (`config/building/snapcraft.yaml:2`). Establish
  from the Snap Store or the release pipeline.
- **Kiosk mode removal:** at the pin, the feature is absent and the documented escape
  file is not handled. Establish when it was removed and whether the latest
  published release still has it.
