# AGENTS.md

Fork of [ChurchApps/FreeShow](https://github.com/ChurchApps/FreeShow) — an Electron + Svelte presentation app. When syncing or cross-referencing, upstream is ChurchApps/FreeShow.

## Stack & layout

- **Electron main process** in TypeScript: `src/electron` → compiled with plain `tsc` to `build/`; app entry is `build/electron/index.js` (package.json `main`).
- **Svelte 3 frontend**: `src/frontend`, built by Vite. In dev, Vite's root is `public/` (not the repo root) and Electron loads `http://localhost:3000`. Prod build emits an IIFE `public/build/bundle.js` loaded by `public/index.html`.
- **Embedded server apps**: `src/server` contains 4 standalone web apps (`remote`, `stage`, `controller`, `output_stream`) built separately by `scripts/vite/createServerFiles.js` (loops `vite build` with `VITE_SERVER_ID=<name>` using `config/building/vite.config.servers.mjs`), served by the Electron process.
- **Shared types**: `src/types` (incl. IPC channel enums in `Channels.ts` and typed IPC payloads in `IPC/`). Frontend↔Electron communication goes through `src/electron/IPC/` and `src/frontend/IPC/`.
- **All tool configs live under `config/`** (`typescript/`, `linting/`, `testing/`, `formatting/`, `building/`), not the repo root — commands must pass explicit `--config` paths (see package.json scripts).
- `build/` and `public/build/` are generated and get **wiped by `scripts/preBuild.js`** (which also auto-generates `config/typescript/*.prod.json` and copies the pdf.js worker into `public/assets`).
- Do not use Svelte 4/5 syntax (runes, snippets, etc.) — this is Svelte 3 with TypeScript 4.9.

## Commands

- `npm start` — full dev environment: frees port 3000, runs preBuild, builds server files, starts Vite (strict port 127.0.0.1:3000), watches servers, runs `tsc -w` for Electron, then launches Electron. First build takes ~20–90s.
- `npm run build` — production build: frontend → servers → electron (series).
- `npm test` — series: unit → playwright → format → svelte-check.
- Single unit test: `npx vitest run --config config/testing/vitest.config.ts src/path/to/file.test.ts` (unit tests are colocated as `src/**/*.test.ts`).
- **Playwright e2e requires `npm run build` first** — it launches `electron .` with `NODE_ENV=production` against `build/`. Headless Linux: `xvfb-run --auto-servernum -- npm run test:playwright`. The single e2e test is `config/testing/start.test.ts`; it mocks the GitHub update check and the open dialog via `FS_MOCK_STORE_PATH`.
- Type-check: `npm run test:svelte` (`svelte-check`, reads root `svelte.config.mjs`).
- Format: `npm run format:prettier` / check with `test:format` — only covers `src` and `scripts`.
- `npm run lint` — three separate eslint configs (electron `.ts`, frontend `.ts`, `.svelte`) plus stylelint; eslint runs with `--fix` and will modify files.

## CI expectations (verified in `.github/workflows/`)

- CI and Playwright workflows are **`workflow_dispatch` only** (manual trigger), nothing runs on push/PR.
- In CI, `test:format` and `test:svelte` are **continue-on-error due to a pre-existing backlog** — do not try to fix the whole backlog; just keep changed files clean. `npm run build` is the blocking gate.

## Environment / setup gotchas

- Requires **Node >= 22.12**.
- Several deps are **native modules pinned to git forks** (`grandiose`, `macadam`, `slideshow`, `libltc-wrapper`, `svelte-inspector`) and `postinstall` runs `electron-builder install-app-deps`. Setup needs Python 3 + setuptools; on Linux `sudo apt-get install libfontconfig1-dev` (CI also installs `uuid-dev libltc-dev`); on Windows the VS "Desktop development with C++" workload.
- Electron treats itself as production when `NODE_ENV=production` **or** when the exec path doesn't contain `electron` (see `isProd` in `src/electron/index.ts`) — keep this in mind when testing built output.
- `package-lock.json` is intentionally committed; do not delete it to fix install issues (the note in `.gitignore` is stale).

## Style

Prettier (`config/formatting/.prettierrc.yaml`): no semicolons, double quotes, 4-space indent, `trailingComma: "none"`, `printWidth: 500`.
