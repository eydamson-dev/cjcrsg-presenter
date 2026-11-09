# IPC channels

- **Area:** internal
- **Online docs:** none
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

The renderer and the Electron main process share one IPC transport channel,
`"MAIN"`, and two request/response namespaces:

| Namespace | Request goes | Handled by | Answered on |
| --- | --- | --- | --- |
| `Main.*` | renderer → main | `mainResponses` in `src/electron/IPC/responsesMain.ts` | the same `Main` id |
| `ToMain.*` | main → renderer | `mainResponses` in `src/frontend/IPC/responsesMain.ts` | the same `ToMain` id |

Both directions use `{ channel, data }` envelopes and an optional `listenerId` to
match a reply to its request.

## Channel counts

| Namespace | Members | Definition |
| --- | --- | --- |
| `Main` | 153 | `src/types/IPC/Main.ts:26` |
| `ToMain` | 33 | `src/types/IPC/ToMain.ts:6` |

The counts are enum members, not calls. A port does not need the same names, but
it does need the same request/response pairs; the names below show the families.

## Representative channels

| Channel | Direction | Payload | Purpose |
| --- | --- | --- | --- |
| `VERSION` | renderer → main | none | App version |
| `GET_OS` | renderer → main | none | Platform and architecture |
| `SETTINGS` | renderer → main | settings object | Persist settings |
| `SYNCED_SETTINGS` | renderer → main | synced settings | Persist portable settings |
| `SERVER_DATA` | renderer → main | ports, max, disabled, data | Start/update the four clients |
| `WEBSOCKET_START` | renderer → main | port, password | Start the API listener |
| `API_TRIGGER2` | main → renderer | action object | Execute an API action |
| `SAVE2` | main → renderer | save payload | Ask the renderer to save |
| `WEBSOCKET` | main → renderer | connection string | Report API client state |
| `GET_DYNAMIC_VALUES` | main → renderer | keys | Resolve dynamic values for the API |

Line references: `src/types/IPC/Main.ts:30,39-40,118-119` and
`src/types/IPC/ToMain.ts:39`.

## Request and reply

- Renderer sends: `src/frontend/IPC/main.ts:68-73`.
- Main receives and answers: `src/electron/IPC/main.ts:23-38`.
- Main sends: `src/electron/IPC/main.ts:9-14` (`sendToMain`) and `16-21`
  (`sendMain`).
- Main waits for a renderer answer with `requestToMain`, default timeout 15 s
  (`src/electron/IPC/main.ts:55-75`).
- Replies are matched with a `listenerId`, generated as channel + 5 random
  characters (`src/electron/IPC/main.ts:56`).

## Server bridge

The four Socket.IO clients do not get IPC channels of their own. One listener per
server name forwards messages into the matching room:

- `ipcMain.on(id, ...)` for `REMOTE`, `STAGE`, `CONTROLLER`, `OUTPUT_STREAM`
  (`src/electron/servers.ts:102-110`).
- A message with `msg.id` goes to one socket; without it, it is broadcast to the
  room.

## Consequences for a port

- The two namespaces are an implementation detail, but the asynchronous
  request/reply pattern is not: a command can be answered later, and the caller
  waits up to 15 s. Blocking the caller forever on a missing answer is a
  behavioural difference.
- The single `"MAIN"` transport means channel validation is explicit
  (`Object.values(...).includes`), which is how an unknown channel becomes a
  thrown error rather than a silent no-op (`src/frontend/IPC/main.ts:69`).

## Open questions

- The full payload type for every channel is in `src/types/IPC/Main.ts`; this page
  lists families rather than reproducing 153 signatures.
- Whether any renderer handler can answer twice is not established.
