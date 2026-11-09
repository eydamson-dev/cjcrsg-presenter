# Servers and ports

- **Area:** internal
- **Online docs:** [Connecting](https://freeshow.app/docs/connecting),
  [Companion](https://freeshow.app/docs/companion)
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

FreeShow runs up to six network listeners. Four are Socket.IO clients served as
web apps; one is the API (WebSocket, REST and OSC); one is the OAuth callback for
Canva. Every listener is off unless it is explicitly enabled in settings.

## Port map

| Port | Listener | Started by | Notes |
| --- | --- | --- | --- |
| 5505 | API WebSocket + OSC | `startWebSocketAndRest` | Companion uses this port |
| 5506 | API REST | `startWebSocketAndRest` | `port + 1` of the WebSocket port |
| 5510 | Remote client | `startServers` | Management UI: projects, shows, slides |
| 5511 | Stage client | `startServers` | Needs a stage layout |
| 5512 | Controller client | `startServers` | Presentation controls |
| 5513 | Output stream | `startServers` | Frame feed of an output window |
| 5520 | Canva OAuth callback | `CanvaConnect` | Only while connecting |

Code: the four server ports are fixed in `src/electron/servers.ts:26-32`; the API
defaults are in `src/electron/utils/api.ts:13`; the Canva port is
`src/electron/contentProviders/canva/CanvaConnect.ts:11`
(`OAUTH_PORT`). The remote and stage ports can be changed in settings
(`src/electron/data/defaults.ts:43`).

## Enabling and disabling

- The server list is created once at module load
  (`src/electron/servers.ts:42-50`).
- `startServers` recreates each instance and listens only when
  `disabled[id.toLowerCase()] === false` (`src/electron/servers.ts:119`). That is
  why a fresh profile has no servers: the setting is absent, not `false`.
- The API has its own start call and password
  (`src/electron/utils/api.ts:41-48`).
- Changing a connection setting sends `Main.WEBSOCKET_START` with the port and
  password; the OBS/companion path is
  `src/frontend/components/settings/tabs/Connection.svelte:73`.

## Connection limit and lifecycle

- Default maximum is 10 clients per server (`src/electron/servers.ts:83`,
  `src/electron/data/defaults.ts:44`). Overflow receives an `overLimit` error and
  is disconnected (`src/electron/servers.ts:92-96`).
- `closeServers` closes Socket.IO and clears the connection map
  (`src/electron/servers.ts:155-167`).
- A port already in use is caught (`EADDRINUSE`) and the server is closed rather
  than crashing the app (`src/electron/servers.ts:130-135`).
- Each started server publishes itself over Bonjour
  (`src/electron/servers.ts:139`).

## What each client receives

Server clients are not given the whole store. The main window serializes a subset
and pushes it over the matching Socket.IO room
(`src/frontend/utils/remoteTalk.ts`). Media and stream channels are throttled; the
stage's current-output mirror subscribes to frame pushes with a heartbeat
(`src/electron/servers.ts:37-40`, `184-190`).

## Security relevant behaviour

- HTTP servers listen on all interfaces by default: `server.listen(port)` has no
  host argument (`src/electron/servers.ts:129`).
- The remote client has a password stored in `serverData.remote.password`
  (`src/frontend/utils/updateSettings.ts:145-149`).
- The API has an optional password; when it is empty, every request is accepted
  (`src/electron/utils/api.ts:38`).

## Open questions

- The exact socket message schema per client is not documented here; the pages
  under `remote/` cover the visible behaviour.
- Whether Bonjour publishing is conditional on a setting is not traced.
