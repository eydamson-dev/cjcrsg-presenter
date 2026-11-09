<!-- Intended path: docs/freeshow-reference/remote/companion.md -->

# Bitfocus Companion module

- **ID:** `companion.module`
- **Area:** remote
- **Online docs:** <https://freeshow.app/docs/companion>
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

The Companion module does not talk to a FreeShow-specific protocol: it drives the
WebSocket/REST/OSC API that FreeShow starts when the `API` row in Settings >
Connection is switched on. The module lives in its own repository; FreeShow only
supplies the endpoint and the action vocabulary.

## What the user sees

- Settings > Connection has an `API` row labelled
  "WebSocket/REST/OSC/Companion", off by default
  (`src/frontend/components/settings/tabs/Connection.svelte:104`, `:241-243`,
  `:256-260`).
- Its connect popup has no URL/QR, only links to the API docs and the Companion
  tutorial, a port field, and an optional password
  (`src/frontend/components/main/popups/Connect.svelte:68`, `:170-178`,
  `:149-150`).
- The default port shown is 5505
  (`src/frontend/components/main/popups/Connect.svelte:51`).

Screenshot: `../screenshots/remote-api-row.png` — not yet captured. Shot: Settings
> Connection with the API row enabled and its popup open, 1440x900.

## How it behaves

1. Toggling the API row writes `serverData.companion.enabled` and then sends
   `Main.WEBSOCKET_START` with `{ port, password }`, or `Main.WEBSOCKET_STOP`
   (`Connection.svelte:63-75`). The main process routes these to
   `startWebSocketAndRest` / `stopApiListener`
   (`src/electron/IPC/responsesMain.ts:151-152`).
2. `startWebSocketAndRest` stops any previous listener, stores the password, and
   starts three listeners (`src/electron/utils/api.ts:41-48`):
   - REST on `port + 1` (default 5506),
   - WebSocket (Socket.IO) on `port` (default 5505),
   - OSC over UDP on the same `port`.
3. Auth: `checkAuth` returns true when no password is configured; otherwise the
   token must equal the configured password. Tokens are accepted from the
   Socket.IO handshake `auth`, an `Authorization` header (`Bearer ` is stripped),
   the query string, or the JSON body
   (`api.ts:20-38`, `:82-86`, `:135-137`, `:178-181`). A failure answers
   `401 Unauthorized` over REST, `{ status: 401 }` over the socket, and an OSC
   message with the same JSON (`api.ts:83-86`, `:136-137`, `:179-180`).
4. HTTP shape: `GET http://<ip>:5506/?action=<id>&data=<json>&auth=<key>`
   (`src/frontend/components/actions/api.ts` documents the same shape in
   `source/docs/api.svelte:220-222`; the handler is `api.ts:134-159`).
5. REST shape: `POST http://<ip>:5506/` with
   `Authorization: Bearer <key>` and `{ action, ...data }`
   (`source/docs/api.svelte:225-232`).
6. WebSocket shape: Socket.IO to `http://<ip>:5505`, then
   `emit("data", JSON.stringify({ action, ... }))`; the answer arrives on the
   `data` event (`source/docs/api.svelte:234-238`; `api.ts:73-97`).
7. OSC shape: UDP to port 5505, address `/freeshow/<action>`, first argument a
   JSON string including `auth` (`source/docs/api.svelte:240-245`;
   `api.ts:164-199`).
8. Every form funnels into one action table, `API_ACTIONS`
   (`src/frontend/components/actions/api.ts:214-443`), whose sections are
   PROJECT, SHOWS, PRESENTATION, CLEAR, MEDIA (backgrounds), OVERLAYS, SCRIPTURE,
   OUTPUT, STAGE, AUDIO, TIMERS, TIMELINE, FUNCTIONS, DRAW, CONNECTION, EMIT,
   Interactions, OBS Studio, Spotify, Smart, OTHER, ACTION, ADD, CREATE, DELETE,
   EDIT and GET. Actions marked `// BC` in that file are the ones the Companion
   module exposes (`api.ts:213`).
9. Index arguments are 1-based at the API boundary: the dispatcher decrements
   `data.index` before calling the action (`api.ts:453-454`).
10. `get_*` actions are request/response: the listener adds a `returnId`, forwards
    the call to the renderer, and waits up to 10 s for a value
    (`src/electron/utils/api.ts:256-271`, poll interval 50 ms); actions without a
    return value answer `204 No Content` over REST (`:151-156`).
11. Port change and password change on the API row restart the listener
    immediately (`Connect.svelte:88-94`, `:121`).
12. FreeShow contains no Companion-specific code beyond the toggle, the port and
    the password — the module is an ordinary API client.

## State and persistence

| What | Where it lives | When it is written | Survives restart |
| --- | --- | --- | --- |
| API enabled | `serverData.companion.enabled` → `settings.json` | on toggle | yes |
| API password | `serverData.companion.password` | on edit | yes |
| API port | `ports.companion` | on edit | yes |
| Active listeners | main-process `servers` map | on start/stop | no |

## Settings

| Setting | Key and location | Default | Effect |
| --- | --- | --- | --- |
| Enabled | `serverData.companion.enabled` | absent = off (`Connection.svelte:224`) | starts/stops the socket API |
| Port | `ports.companion` | 5505 (`Connect.svelte:51`; `api.ts:13`, `:46`) | WebSocket and OSC port; REST uses port + 1 |
| Password | `serverData.companion.password` | empty — `defaultSettings.serverData` is `{}` (`src/electron/data/defaults.ts:40`), and `createData` seeds only the remote password (`src/frontend/utils/createData.ts:69-70`) | required when non-empty; `401` otherwise |

## Code

- `src/frontend/components/settings/tabs/Connection.svelte:63-75`, `:224`,
  `:256-260` — the API row.
- `src/frontend/components/main/popups/Connect.svelte:51`, `:149-150`,
  `:170-178` — port, password, doc links.
- `src/frontend/utils/updateSettings.ts:331-339` — auto-start after settings load.
- `src/electron/utils/api.ts:13`, `:20-48` — ports, auth, start.
- `…/api.ts:53-115` — WebSocket listener.
- `…/api.ts:120-160` — REST listener.
- `…/api.ts:164-199` — OSC listener.
- `…/api.ts:256-280` — request/response plumbing.
- `src/frontend/components/actions/api.ts:214-443` — the action table and the `BC`
  marks.

## Online docs

- <https://freeshow.app/docs/companion> — install Companion, add the
  "ChurchApps: FreeShow" module, set "Destination IP" to the FreeShow machine and
  the port to 5505, then enable "Bitfocus Companion" in FreeShow's Connection tab.
- <https://freeshow.app/api> — the generated action reference (rendered from the
  same action table) and the four call shapes.
- <https://github.com/bitfocus/companion-module-churchapps-freeshow> — the module
  itself, which is not part of this checkout.

## Doc vs code

- `doc` names the toggle "Bitfocus Companion" and says the port "should be 5505";
  code labels the row `API` with the subtitle "WebSocket/REST/OSC/Companion", and
  the port defaults to 5505 but is user-editable
  (`Connection.svelte:104`, `Connect.svelte:51`, `:144`).
- `doc` links the API docs to `src/frontend/components/actions/api.ts`; that file
  is indeed the action table, but the published page also renders it through the
  `freeshow-api` package (`source/docs/api.svelte:5`, `:10-17`).

## Open questions

- What the Companion module sends exactly (action ids, argument shapes, whether it
  uses WebSocket or REST). The module repository is not in this checkout; only the
  FreeShow side was read.
- Whether the module has a preset/feedback that depends on a `get_*` response
  timeout; the 10 s wait is the FreeShow side only
  (`src/electron/utils/api.ts:267`).
- Whether the API is intended to be reachable from outside the LAN. It calls
  `server.listen(PORT)` with no host argument (`api.ts:57`), which Node binds to
  all interfaces, and sets `cors: { origin: "*" }` (`:65`); any intended
  restriction was not found in the code or docs.
