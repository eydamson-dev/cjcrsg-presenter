# Security model

- **Area:** internal
- **Online docs:** [Connecting](https://freeshow.app/docs/connecting),
  [Remote](https://freeshow.app/docs/remote), [FAQ](https://freeshow.app/docs/faq)
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

FreeShow is built for a trusted local network. The remote clients and the API have
optional passwords, the servers listen on every interface, and there is no TLS.
The bundled third-party keys are obfuscated, not secret.

## Passwords

| Surface | Stored at | Enforced at |
| --- | --- | --- |
| Remote / stage / controller / stream | `serverData.<server>.password` | server client handshake |
| API | passed to `startWebSocketAndRest` | `checkAuth` (`src/electron/utils/api.ts:38`) |

- The remote password is merged into `serverData` on settings update
  (`src/frontend/utils/updateSettings.ts:145-149`).
- An empty API password disables the check
  (`src/electron/utils/api.ts:17-18,38`).
- The API accepts a token from headers, query, body or socket handshake, including
  a Bearer header (`src/electron/utils/api.ts:20-36`).
- A wrong token gets `401` (`src/electron/utils/api.ts:82-86,140-144`).

## Network exposure

- The four client servers call `server.listen(port)` with no host, so they bind
  all interfaces (`src/electron/servers.ts:129`).
- There is no TLS listener. Traffic is plain HTTP and WebSocket.
- Bonjour advertises the running servers (`src/electron/servers.ts:139`).

## Key storage

`src/electron/utils/keys.ts:1-20` states the position plainly: the app is open
source, so bundled provider keys are XOR-obfuscated to deter scrapers, not to
protect them. They are not a security boundary.

## Provider media cache

Downloaded provider media is stored encrypted with AES-256-CBC
(`src/electron/data/protected.ts:53,78,120`) and expires after 30 days
(`:18`). This protects cached third-party media at rest; it does not authenticate
the user.

## Profiles

The FAQ describes profiles, an admin profile and a `-p=` argument. The launch
argument handling was not traced in `src/electron/index.ts`, so the profile
mechanism is `doc` only here.

## Consequences for a port

- Binding to all interfaces by default is a real behaviour and a real exposure. A
  port should decide deliberately whether to match it.
- "Optional password" means an unset password is accepted, not rejected. Matching
  the default matters for anyone who expects the UI prompt.
- A port that encrypts keys differently is not a parity difference; a port that
  silently drops the password is.

## Open questions

- How server-client handshakes check the remote password is not traced here.
- Profile switching and storage are `doc` only.
