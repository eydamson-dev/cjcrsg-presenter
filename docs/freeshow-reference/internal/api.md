# API actions

- **Area:** internal
- **Online docs:** [API documentation](https://freeshow.app/api),
  [Companion](https://freeshow.app/docs/companion)
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

One action registry is reachable over four transports: HTTP query, REST, a
Socket.IO WebSocket, and OSC. The same action IDs are also what slide actions and
the Companion module use. Actions are executed by the renderer, not the main
process: the listener forwards the action and waits for a reply.

## Transports

| Transport | Endpoint | Shape |
| --- | --- | --- |
| HTTP | `http://localhost:5506?action=ID&data={...}&auth=KEY` | Query; works with GET |
| REST | `POST http://localhost:5506` | JSON body `{ "action": ID, ... }`; `Authorization: Bearer KEY` |
| WebSocket | `http://localhost:5505`, Socket.IO | `socket.emit("data", JSON.stringify({ action: ID, ... }))`, token in `auth` |
| OSC | UDP, address `/freeshow/ID` | JSON argument, `auth` included |

Ports: `src/electron/utils/api.ts:13` and `41-48`. The REST listener is always
WebSocket port + 1. The API page at freeshow.app describes the same four
transports.

## Enabling and authentication

- The listener starts from `startWebSocketAndRest({ port, password })`
  (`src/electron/utils/api.ts:41-48`).
- The password is trimmed; an empty password disables the check entirely
  (`src/electron/utils/api.ts:17-18,38`).
- The token is accepted from `auth`, `password`, `token`, `key`, `apiKey`,
  `authKey`, `authorization` or `x-api-key`, or as a Bearer header
  (`src/electron/utils/api.ts:20-36`).
- Unauthorized requests get `401` and an error body; the REST route returns
  `401` JSON and the WebSocket emits a `401` message
  (`src/electron/utils/api.ts:82-86,140-144`).
- A successful action with no return value returns `204 No Content`
  (`src/electron/utils/api.ts:151-155`).

## Dispatch

```
transport → receivedData()
          → sendToMain(ToMain.API_TRIGGER2)
          → renderer runs the handler
          → get_* actions wait up to 10 s for returnDataObj[id]
```

- `receivedData` (`src/electron/utils/api.ts:256-270`).
- Actions whose ID starts with `get_` get a `returnId` and wait up to 10 000 ms,
  polling every 50 ms.
- The reply is stored by `apiReturnData` and removed when read
  (`src/electron/utils/api.ts:273-280`).

## Registry size

| Registry | Count | File |
| --- | --- | --- |
| API handlers | 164 | `src/frontend/components/actions/api.ts` |
| Named actions with metadata (name, icon, input) | 93 | `src/frontend/components/actions/actionData.ts` |

The 164 includes API-only entries and aliases; the 93 is the set offered in the
Actions UI. A port needs both lists, and they will not be the same length.

Action families, from the section headings in `api.ts`: project, shows,
presentation, clear, media, overlays, visual, stage, audio, timers, functions,
other, action, edit, get.

Examples, verified in place:

| Action | Handler |
| --- | --- |
| `next_slide` | `OutputHelper.advanceOutputs("next")` (`src/frontend/components/actions/api.ts:242`) |
| `previous_slide` | `OutputHelper.advanceOutputs("previous")` (`:243`) |
| `clear_all` | `clearAll(true)` (`:252`) |
| `index_select_slide` | `selectSlideByIndex(data)` (`:245`) |
| `id_select_group` | `gotoGroup(data.id)` (`:247`) |

Slide actions execute through the same registry:
`runActionId(id, source)` in `src/frontend/components/actions/actions.ts:30`.

## Get actions

The published API lists read actions including `get_shows`, `get_show`,
`get_show_layout`, `get_projects`, `get_project`, `get_output`,
`get_output_slide_text`, `get_playing_video_time`, `get_variables`, `get_timers`,
`get_slide` and `get_cleared`. These are the useful state oracle for parity work:
they return data without a screenshot.

## Open questions

- Per-action payload and return types are defined in `api.ts`; they were not
  transcribed here.
- Whether every `get_*` action is implemented was not checked one by one.
- The OSC patch (`src/electron/utils/oscPatch.ts`) was not traced.
