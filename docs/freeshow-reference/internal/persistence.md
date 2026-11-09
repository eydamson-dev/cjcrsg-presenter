# Persistence

- **Area:** internal
- **Online docs:** [Data storage](https://freeshow.app/docs/data)
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

Most state is JSON in a per-user data folder, with shows stored one file each.
Saving is a single guarded pass over the stores, skipping values that did not
change. Startup is deliberately forgiving: unreadable JSON is deleted, and an
oversized history file is dropped.

## Store files

| Store | File | Portable | Notes |
| --- | --- | --- | --- |
| Shows cache | `shows.json` | no | Minified cache; the `.show` files are authoritative |
| Settings | `settings.json` | no | Local settings |
| Synced settings | `settings_synced.json` | yes | Travels with backup/cloud |
| Themes | `themes.json` | yes | |
| Projects | `projects.json` | yes | `projects`, `folders`, `projectTemplates` |
| Stage | `stage.json` | yes | Stage layouts |
| Overlays | `overlays.json` | yes | |
| Templates | `templates.json` | yes | |
| Events | `events.json` | yes | Calendar |
| History | `history.json` | no | Undo/redo; dropped above 30 MB |
| Media | `media.json` | no | Media index |
| Cache | `cache.json` | no | |
| Synced cache | `cache_sync.json` | no | |
| Usage | `usage.json` | no | CCLI usage log |
| Error log | `error_log.json` | no | |
| Drive key | `DRIVE_API_KEY.json` | no | |
| Access | `ACCESS.json` | no | Content provider tokens and secrets |

Definition: `src/electron/data/store.ts:30-53`.

## Where the folder is

- `appDataPath` is the directory containing `config.json`
  (`src/electron/data/store.ts:55`).
- `config.json` is an `electron-store` with defaults
  (`src/electron/data/defaults.ts:3`): bounds, data path, hardware acceleration,
  graphics device.
- Changing the data path creates the stores at the new location
  (`createStores`, `src/electron/data/store.ts:111`).

## When a save writes

`save(data)` (`src/electron/data/save.ts:21`):

1. Returns immediately if a save is already running (`:22-24`).
2. For each store, skips it when the new data matches the current data
   (`:57`).
3. Writes shows one file per show, named `<show name>.show`
   (`src/electron/data/save.ts:85`) and scriptures as `<name>.fsb` (`:70`).
4. Renames and deletes show files when the renderer reports renamed/deleted shows
   (`:74-78`).

Autosave intervals are `2min` through `120min`, with `15min` as the default
(`src/frontend/values/autosave.ts:1-9`, `src/electron/data/defaults.ts:36`).

## Startup behaviour

`checkStores` (`src/electron/data/store.ts:68-107`):

- Deletes leftover `*.json.tmp-*` files (`:70-78`).
- Parses every store file; **if parsing fails, the file is deleted**
  (`:99-105`). There is no quarantine copy in this path.
- Deletes `history.json` if it exceeds 30 MB (`:88-94`).

This is a data-loss behaviour, not a repair. A port should decide deliberately
whether to match it.

## Write failure handling

`safeStoreSet` retries up to three times, backing off on Windows `EPERM`, and
alerts the user if it still fails (`src/electron/data/store.ts:188-208`).

Backups write the portable stores (`src/electron/data/backup.ts:197-198`).

## Open questions

- Whether the underlying store writes atomically (temp file plus rename) is not
  established here; `safeStoreSet` only retries.
- The shutdown save sequence is not traced.
- Which changes mark a show modified, and therefore trigger a `.show` write, is
  not traced.
