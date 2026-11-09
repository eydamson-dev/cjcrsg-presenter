# CCLI reporting

- **ID:** `ccli.logging`, `ccli.export`
- **Area:** advanced
- **Online docs:** <https://freeshow.app/docs/advanced/ccli-reporting>
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

FreeShow can keep a local list of every song it presented, so the operator can
produce a CCLI usage report by hand. Logging is opt-in, off by default, capped,
and written to a JSON file under the data folder's `Exports/Usage` directory.
There is no submission to CCLI; the docs say CCLI has no public API for it.

## What the user sees

The toggle is **Log song usage to a file**, in the shows drawer's options panel
(the round options button at the bottom right of the drawer info area). When
logging is on and at least one entry exists, an **Export usage log** button
appears under it; after an export the same button becomes **Reset usage log**.
Actions can toggle the same setting: the action is named `Log song usage to a file`,
has a toggle input and sits under the **Other** section of the action picker.

Screenshot: `../screenshots/advanced-ccli-options.png` — not yet captured.
Shot list:

1. Shows drawer with the options popover open, logging off, 1440×900.
2. Same, logging on with entries and the **Export usage log** button.
3. Same, after export, showing the **Reset usage log** state.
4. The action editor with the **Other → Log song usage to a file** action added,
   toggle visible.

## `ccli.logging`

How it behaves:

- The setting is `special.logSongUsage`; `special` defaults to `{}`, so logging
  is **off** by default. `code` — `src/frontend/stores.ts:360`,
  `src/electron/data/defaults.ts:77`;
  `src/frontend/components/drawer/info/ShowInfo.svelte:113`.
- The toggle lives in the shows drawer options panel, next to
  **Transparent slides**; the options button is rendered for the shows tab and
  hidden in focus mode. `code` — `src/frontend/components/drawer/info/Info.svelte:48-54`,
  `ShowInfo.svelte:106-120`.
- An entry is appended when a slide is output for a show that is not already the
  outputted show: `appendShowUsage(showId)` is called only when
  `currentOutSlideId !== data.id`. `code` —
  `src/frontend/components/helpers/output.ts:212-215,422-452`.
- One entry is `{ name: <show name>, time: Date.now(), metadata: <show.meta> }`;
  empty metadata values are removed first. The removal mutates the live
  `showsCache` object, because `metadata` is a reference to `show.meta`.
  `code` — `src/frontend/components/helpers/output.ts:432-444`.
- Consecutive plays of the same show name are logged once (`justLogged`).
  `code` — `src/frontend/components/helpers/output.ts:428-430`.
- The log is capped at the last 1500 entries.
  `code` — `src/frontend/components/helpers/output.ts:421,446-448`.
- The action `toggle_log_song_usage` accepts on / off / toggle; the API wrapper
  `toggleLogSongUsage` treats the string `"false"` as false (for Companion).
  `code` — `src/frontend/components/actions/actionData.ts:135`;
  `src/frontend/components/actions/apiHelper.ts:959-967`;
  `src/frontend/components/actions/api.ts:384`.
- The docs require the `Song ID (CCLI)` metadata field; the code does not
  enforce it — it logs whatever `meta` holds, so the report can contain entries
  with no CCLI number. `doc` — `source/docs/advanced/ccli-reporting.md:18`;
  `code` — `output.ts:432-444`.

State and persistence:

| What | Where it lives | When it is written | Survives restart |
| --- | --- | --- | --- |
| `logSongUsage` | `settings.json` → `special.logSongUsage` | On save | Yes, machine-local |
| Usage log | `usage.json` → `{ all: [...] }` (USAGE store, not portable) | On save (`USAGE: get(usageLog)`) | Yes |

## `ccli.export`

How it behaves:

- **Export usage log** sends `EXPORT ["USAGE"]` with the whole log object; the
  main process writes it to `<data root>/Exports/Usage/<YYYY-MM-DD_HH-MM>.json`.
  `code` — `src/frontend/components/drawer/info/ShowInfo.svelte:84-91`;
  `src/electron/data/export.ts:64-68,188-190`;
  `src/electron/utils/files.ts:428-435`.
- A second export in the same minute gets a `_1` suffix: the writer probes for a
  free name rather than overwriting. `code` — `src/electron/data/export.ts:389-404`.
- JSON is pretty-printed with 4 spaces (`JSON.stringify(content, null, 4)`).
  `code` — `src/electron/data/export.ts:188-190`.
- Exporting does **not** clear the log. The button changes to **Reset usage log**
  after an export, and only a second click clears `usageLog` to `{ all: [] }`.
  `code` — `src/frontend/components/drawer/info/ShowInfo.svelte:84-95,114-120`.
- The export opens the `Exports` folder in the file manager, once per session.
  `code` — `src/electron/data/export.ts:94-105`.

Exported JSON shape (top level is the usage store, not a bare array):

```json
{
  "all": [
    {
      "name": "We Are His People",
      "time": 1762981107864,
      "metadata": {
        "number": "251",
        "title": "We Are His People",
        "author": "Philip Percival",
        "copyright": "2002 Emu Music",
        "CCLI": "3687233"
      }
    }
  ]
}
```

`code` — `src/frontend/stores.ts:234` (`{ all: [] }`),
`src/frontend/utils/save.ts:239` (`USAGE: get(usageLog)`),
`src/frontend/components/helpers/output.ts:440-444` (entry fields).
The docs' snippet shows one entry object, without the `"all"` wrapper
(`source/docs/advanced/ccli-reporting.md:52-64`).

Settings:

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Log song usage to a file | `special.logSongUsage` | off (absent) | Enables appending |
| Action `toggle_log_song_usage` | action data | — | on / off / toggle |

## Code

- `src/frontend/components/drawer/info/Info.svelte:48-54` — the options button.
- `src/frontend/components/drawer/info/ShowInfo.svelte:80-120` — toggle, export, reset.
- `src/frontend/components/helpers/output.ts:212-215,419-452` — logging trigger and record.
- `src/frontend/stores.ts:234` — `usageLog` shape.
- `src/frontend/utils/save.ts:239` — persistence into `usage.json`.
- `src/electron/data/export.ts:64-68` — export channel.
- `src/electron/data/export.ts:188-190` — JSON writer.
- `src/electron/utils/files.ts:428-435` — timestamp filename.
- `src/frontend/components/actions/apiHelper.ts:959-967` — toggle helper.

## Online docs

- [CCLI Reporting](https://freeshow.app/docs/advanced/ccli-reporting) — the
  opt-in steps, the toggle action, the export path
  `<freeshow root folder>\Exports\Usage`, and the sample entry. It adds the
  "since your last export" phrasing, which the button flow contradicts (see
  below).

## Doc vs code

- `doc` says the file is in `<freeshow root folder>\Exports\Usage`
  (`ccli-reporting.md:48`) / code uses the **data root** (`Documents/FreeShow` by
  default), not the install folder (`src/electron/data/export.ts:65`).
- `doc` says the report contains usage "since your last export"
  (`ccli-reporting.md:48`) / code clears only when the second **Reset usage log**
  click happens; an export leaves the log intact, so a second export repeats the
  same entries (`ShowInfo.svelte:84-95,114-118`).
- `doc` shows a bare entry object (`ccli-reporting.md:52-64`) / the file's top
  level is `{ "all": [...] }` (`src/frontend/stores.ts:234`).
- `doc` says the toggle is under the shows drawer options icon
  (`ccli-reporting.md:24-27`) / matches code (`Info.svelte:48-54`,
  `ShowInfo.svelte:113`).
- `doc` says the export button is "only visible if the logging is active"
  (`ccli-reporting.md:46`) / code also requires at least one entry
  (`ShowInfo.svelte:114`).

## Open questions

- Whether the usage log is written immediately when logging starts, or only on
  the next save/autosave, was not traced (`save.ts` passes it in the SETTINGS
  payload; the trigger is not established). `unknown`.
- Whether logging continues while an output is locked or while the show is
  playing from a project item (the trigger is in `setOutput("slide")`) is not
  established for the lock case. `unknown`.
- Whether a show's `meta` being mutated by the empty-value cleanup
  (`output.ts:433-437`) is observable in the UI (an emptied field disappearing
  from the metadata editor) was not read. `unknown`.
