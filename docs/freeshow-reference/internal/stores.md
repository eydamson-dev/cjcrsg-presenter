# Renderer state

- **Area:** internal
- **Online docs:** none
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

The renderer keeps the presentation state in Svelte writable stores. Outputs,
servers and the API read that state; they do not own it. The store module is
`src/frontend/stores.ts` (536 lines), and it is the closest thing FreeShow has to
an application state model.

## Store groups

| Group | Examples | Line |
| --- | --- | --- |
| Environment | `os`, `deviceId`, `version`, `isDev`, `dataPath` | `src/frontend/stores.ts:34-46` |
| UI | `activePage`, `activeDrawerTab`, `focusMode`, `activePopup`, `settingsTab` | `:50-68` |
| Selection | `selected` (show/slide), `clipboard`, `activeShow`, `activeEdit`, `activeStage` | `:48-60` |
| Content | `projects`, `shows`, `showsCache`, `overlays`, `templates`, `categories` | later in the module |
| Playback | `outputs`, `outLocked`, `runningActions`, `audioChannelsData` | later in the module |
| Clients | `connections`, `serverData` | `:50`, later |
| Persistence | `saved`, `loaded`, `loadedState` | `:40-42` |

The exact set is large; the table names the groups a port must account for, not
every store.

## How clients see it

Server clients receive a serialized subset, not the stores themselves:

- `src/frontend/utils/remoteTalk.ts` builds the payload.
- Language and strings are sent as `["LANGUAGE"]` (`:60`).
- The remote receives projects, shows, slides and playback state through the
  same module.

The stage's current-output mirror is a frame subscription, not store data
(`src/electron/servers.ts:37-40,184-190`).

## State ownership

FreeShow splits ownership:

- **Renderer** decides what is playing, what is selected, and what an output
  shows.
- **Main process** owns files, windows, capture and servers.
- **Output windows** render state pushed to them; they do not decide.

For the port, this is the same boundary as `crates/core` (authoritative state)
versus the Dioxus windows (consumers). The important finding is that FreeShow's
equivalent of the engine lives in the renderer store layer, not in the Electron
main process.

## Open questions

- The precise store-to-client payload per tab is defined in `remoteTalk.ts` and
  was not transcribed.
- Store reset behaviour on profile switch is not traced.
