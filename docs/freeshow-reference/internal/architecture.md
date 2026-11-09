# Process architecture

- **Area:** internal
- **Online docs:** none
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

FreeShow is an Electron application with a Svelte renderer. The Electron main
process owns data, servers, capture and output windows; the renderer owns the
user interface and the presentation state that the interface manipulates. Four
small web clients (remote, stage, controller, output stream) are served from
separate bundles by the same main process.

## Processes and layers

| Layer | Location | Runs in | Responsibility |
| --- | --- | --- | --- |
| Main | `src/electron` | Node, Electron main | Data stores, servers, API, capture, NDI, streaming, output windows, backups |
| Preload | `src/electron/preload.ts` | Renderer, isolated | Bridge for the main window |
| Renderer | `src/frontend` | Chromium | Svelte UI, presentation state, output rendering in the main window |
| Server clients | `src/server/remote`, `stage`, `controller`, `output_stream` | Chromium, separately served | Phone/tablet/stage/browser clients |
| Shared types | `src/types` | Both | Data model and IPC channel definitions |

The main window is created at `src/electron/index.ts:227`, after a loading window
at `src/electron/index.ts:194`. Both are `BrowserWindow`s; the loading window
exists so the renderer can initialize stores before the main UI appears.

## What talks to what

```
renderer (Svelte stores)
   │  sendMain(Main.*) / requestToMain(ToMain.*)
   ▼
preload ── IPC ──► Electron main
                     ├─ data stores (JSON files)
                     ├─ servers.ts ──► remote 5510, stage 5511,
                     │                 controller 5512, output stream 5513
                     ├─ utils/api.ts ──► WebSocket 5505, REST 5506, OSC
                     ├─ output windows
                     └─ capture / NDI / OMT / streaming
```

- Renderer to main: `src/frontend/IPC/main.ts:68` (`sendMain`) and
  `requestToMain` in the same module for calls that wait for an answer.
- Main to renderer: `src/electron/IPC/main.ts:16` (`sendMain`), which targets a
  window or broadcasts.
- Server clients do not use IPC. The main process bridges IPC messages to a
  Socket.IO room: `src/electron/servers.ts:102-110`.
- The API is a fourth ingress. It turns an action into `ToMain.API_TRIGGER2`,
  and the renderer executes it (`src/electron/utils/api.ts:256-270`).

## The state model

The renderer holds the authoritative presentation state in Svelte stores
(`src/frontend/stores.ts`). The main process holds the persisted data and the OS
resources. This split matters for a port: the same JSON store can be read by the
main process while the renderer decides what is on screen.

- Output windows are separate `BrowserWindow`s created by the main process; they
  render the same output component against state pushed from the main window.
- Server clients receive a serialized subset of the stores through
  `src/frontend/utils/remoteTalk.ts`.

## Build outputs

`npm run build` is three steps (`package.json:33`):

1. `vite build` — the renderer bundle (`package.json:35`).
2. `createServerFiles.js` — one HTML/JS bundle per server client
   (`package.json:36`).
3. `tsc` — the Electron main and preload code (`package.json:38`).

The packaged app is assembled by electron-builder from
`config/building/electron-builder.yaml` (`package.json:41`).

## Consequences for a Rust port

- A single authoritative engine can replace the renderer's store ownership, but it
  must still expose the same four client surfaces and the same API actions.
- Output windows are consumers in FreeShow. The port keeps that rule (invariant 2
  in the repository's `AGENTS.md`).
- The main-process responsibilities (stores, servers, capture) map to host-side
  services, not to the presentation domain.

## Open questions

- Which store writes happen on which thread at shutdown is not established here;
  see `persistence.md`.
- The loading window's initialization sequence is not traced beyond window
  creation.
