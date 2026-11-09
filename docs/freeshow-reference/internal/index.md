# Internal behaviour

- **Area:** internal
- **Online docs:** none. The published documentation describes what a user can do;
  this area records how the application is put together and what runs underneath.
- **Pinned code:** ff784eb
- **Confidence:** `code` unless a page says otherwise.

## Why this area exists

A port can reproduce every visible control and still behave differently because of
things the user never sees: when a file is written, which output a command
targets, what a server does when two clients connect, or what happens to a
corrupt settings file at startup. These pages record those mechanisms so that
they can be designed rather than guessed.

## Pages

| Page | What it covers | Inventory IDs |
| --- | --- | --- |
| `architecture.md` | Processes, layers, build outputs, how they talk | sys.arch |
| `ipc.md` | Main and renderer channels, request/response | sys.ipc |
| `servers.md` | Remote, stage, controller, stream, API, ports | sys.servers |
| `settings.md` | Settings and synced settings, defaults | sys.settings |
| `persistence.md` | Store files, when they are written, failure handling | sys.persistence |
| `api.md` | HTTP, REST, WebSocket and OSC action interface | sys.api |
| `stores.md` | Renderer state and how clients receive it | sys.stores |
| `media-pipeline.md` | Capture, NDI, OMT, recording, streaming, thumbnails | sys.media |
| `i18n.md` | Language files, fallback, direction | sys.i18n |
| `security.md` | Password, auth key, profiles, key storage, exposure | sys.security |
| `build-release.md` | Build steps and release artefacts | sys.build |

## How the claims were obtained

By reading the pinned source. Nothing in this area was run, so no claim is
`observed`. Where a mechanism depends on Electron behaviour, the page says which
call it relies on and leaves the runtime confirmation open.
