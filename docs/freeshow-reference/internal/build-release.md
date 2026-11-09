# Build and release

- **Area:** internal
- **Online docs:** [Windows](https://freeshow.app/docs/windows),
  [macOS](https://freeshow.app/docs/macos), [Linux](https://freeshow.app/docs/linux)
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

The app builds in three stages and is packaged with electron-builder. Releases are
attached to GitHub releases by CI; the same workflow file defines targets per
platform.

## Requirements

- Node `>=22.12.0` (`package.json:10-11`).
- Platform build libraries for native modules; CI installs `libfontconfig1-dev`,
  `uuid-dev` and `libltc-dev` (`.github/workflows/ci.yml`).

## Build

`npm run build` (`package.json:33`) runs, in order:

| Step | Script | Output |
| --- | --- | --- |
| 1 | `vite build` (`:35`) | Renderer bundle |
| 2 | `createServerFiles.js` (`:36`) | One bundle per server client |
| 3 | `tsc` with the production config (`:38`) | Electron main and preload |

Packaging: `electron-builder --config config/building/electron-builder.yaml`
(`package.json:41`).

## Release artefacts

From `config/building/electron-builder.yaml`:

| Platform | Target | Line |
| --- | --- | --- |
| Windows | NSIS installer | `:27` |
| Linux | AppImage and deb | `:56-58` |
| macOS | dmg and zip | `:81-86` |

Identity: `appId: app.freeshow`, `productName: FreeShow`, artefact name
`FreeShow-${version}-${arch}.${ext}` (`:1-3`).

## CI

Workflows in `.github/workflows/`:

| File | Purpose |
| --- | --- |
| `ci.yml` | Format and type-check; currently `workflow_dispatch` only |
| `build.yml` | Build |
| `release.yml` | Release packaging |
| `winget.yml` | WinGet manifest |
| `playwright.yml` | Browser tests |
| `polinrider-scan.yml` | Dependency scan |

## Consequences for a port

- Reproducing behaviour does not require reproducing the build system, but the
  release artefacts are observable: a Windows user installs an NSIS package, a
  Linux user gets an AppImage or a deb.
- The pinned FreeShow version is 1.6.8-beta.3; a parity claim should name the
  artefact it was compared against, not just the source commit.

## Open questions

- Code signing and notarization status is not recorded in the builder config lines
  inspected.
- Auto-update behaviour is described in the FAQ but its update feed was not traced.
