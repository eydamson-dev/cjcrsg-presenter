# Styling and FAQ

- **ID:** `tips.styling`, `tips.faq`
- **Area:** advanced
- **Online docs:** <https://freeshow.app/docs/styling>, <https://freeshow.app/docs/faq>
- **Pinned code:** ff784eb
- **Confidence:** `doc` for the advice; `code` for the FAQ answers that assert a
  default (hardware acceleration, media mute/loop, bundled font).

## Summary

`styling.md` is advice, not a feature: nothing in it maps to a code path. The
FAQ is mostly operational, but a handful of its answers state a *default* that
the code either confirms or contradicts. Those are the parts a parity contract
can test, and they are recorded here.

## What the user sees

No single screen. Styling is the sum of the edit tools (font, size, line count,
background) and the output style settings; the FAQ answers point at Settings
tabs, the File menu and the data folder.

Screenshot: `../screenshots/advanced-styling.png` — not yet captured. Shot list:

1. Edit view with a text item selected, style tools open, 1440×900.
2. The font dropdown showing `CMGSans` as the default family.
3. Settings → Other, with **Disable hardware acceleration** off.
4. Settings → Files → **Bundle all media files** row, for the FAQ's media advice.

## `tips.styling`

The published page is guidance only. `doc` — `source/docs/styling.md`. Its
claims, and whether anything in code enforces them:

| Advice | Enforced in code? |
| --- | --- |
| Centre the text, remove stray punctuation | No; authoring guidance (`styling.md:14`) |
| Keep a maximum of 5 lines | Not enforced by default. A template can set `maxLinesPerSlide` and `breakLongLines`, but that is opt-in (`src/types/Show.ts:566-577`) |
| Line breaks should match the melody | No (`styling.md:14`) |
| Use backgrounds that do not distract | No (`styling.md:16-18`) |
| High contrast for older audiences; a black box behind text | No; the box is a normal item set by the author (`styling.md:20-22`) |
| Bold text, a font like CMG Sans or Tahoma | CMG Sans is bundled and is the default font family for text items (`public/global.css:1-17`; `src/frontend/components/edit/values/boxes.ts:131`; `src/frontend/components/helpers/fonts.ts:122`) |
| Avoid "(x4)" and repeat the slide instead | No (`styling.md:28-30`) |
| Change slides early | No (`styling.md:32-34`) |
| Use blank slides or cleared text for breaks | Supported by the machinery (blank slides, slide notes), not a setting (`styling.md:36-38`) |

So `tips.styling` is `doc` with one code anchor (the bundled font / default
family). It should not become a functional contract; at most, a visual check that
new text defaults to CMGSans.

## `tips.faq`

The answers that assert behaviour, checked against code:

### Videos dropped into a show are muted and looping

- `doc` says one video dropped into a show is treated as a background, muted and
  looping; dropping more than one, or dropping into a project, leaves it
  unmuted and not looping (`source/docs/faq.md:28-30`).
- Code: a single drop on a slide gets `{ muted: true, loop: true }`; a bulk drop
  that is not centred on one slide gets `foreground` with
  `{ muted: false, loop: false }`. `code` —
  `src/frontend/components/helpers/dropActions.ts:700-724`.
- Code: a video dropped into a **project** is stored as
  `{ name, id, type: "video" }` with no mute/loop flag
  (`dropActions.ts:185-186`); when played, the project item's `muted`/`loop`
  win if present, otherwise the value follows the media's layer type
  (`src/frontend/utils/shortcuts.ts:531-542`). A path outside every configured
  media folder has no layer type, so it plays unmuted and unlooping
  (`src/frontend/components/helpers/media.ts:428-450`).
- `doc` matches for the single-slide and bulk cases. The project case matches
  only while the file is not inside a media folder whose folder type is
  `background`; that exception is not in the docs.

### Hardware acceleration is off by default

- `doc` says enabling the toggle gives better performance but "By default it's
  disabled" (`source/docs/faq.md:88`).
- Code: `disableHardwareAcceleration` defaults to `null`, and only `=== true`
  disables it, so acceleration is **on** by default.
  `code` — `src/electron/data/defaults.ts:3`;
  `src/electron/index.ts:91-98`.
- This is a contradiction (see Doc vs code).

### The log file is under Settings → Other

- `doc` says Settings → Other → "Open log file" (`source/docs/faq.md:92`).
- Code: the button exists and is labelled **Open error log**
  (`src/frontend/components/settings/SettingsTools.svelte:18-20,66-70`;
  `public/lang/en.json:834`). It reveals `error_log.json` in the app data
  directory, not the data folder (`src/electron/IPC/responsesMain.ts:103`).

### Moving data between computers

- `doc` describes both an Export everything/Import pair and a
  Backup everything/Restore pair (`source/docs/faq.md:42-46,62-66`).
- Code has **Backup everything** and **Restore**
  (`src/frontend/components/settings/tabs/FilesButtons.svelte:14-23`), and the
  backup excludes media (`src/electron/data/backup.ts:59-88`), which matches the
  FAQ's "media files are linked to the system and must be moved separately".

### Auto updates need write permission

- `doc` says updates need permission to write new files, and on Windows often
  admin (`source/docs/faq.md:98-100`).
- Code delegates to `electron-updater`'s
  `checkForUpdatesAndNotify()` and only reports errors to the console
  (`src/electron/utils/updater.ts:7-14`). The permission model is the installer's,
  not visible here. `unknown` beyond that.

### Multilingual songs / translate button

- `doc` says a globe button at the bottom of a show translates it into 240+
  languages (`source/docs/faq.md:24-26`).
- Not traced in this pass. `unknown`.

### CCLI/SongSelect

- `doc` says CCLI has no API and SongSelect lyrics are pasted into Quick Lyrics
  (`source/docs/faq.md:36-40`). Matches `ccli.md` (no submission path in code).

## State and persistence

The FAQ asserts defaults rather than state. The defaults it touches:

| What | Where | Default | Citation |
| --- | --- | --- | --- |
| Hardware acceleration | `config.json` → `disableHardwareAcceleration` | `null` (acceleration enabled) | `src/electron/data/defaults.ts:3`; `src/electron/index.ts:91` |
| Video on a slide | slide/layout data | muted + looping | `dropActions.ts:711` |
| Video in a project | project item data | no flags; layer-type default | `dropActions.ts:186`; `shortcuts.ts:533-534` |
| Text font family | item style | `CMGSans` | `boxes.ts:131`; `public/global.css:1-17` |

## Settings

| Setting | Key and location | Default | Effect |
| --- | --- | --- | --- |
| Disable hardware acceleration | `config.disableHardwareAcceleration` | `null` (off) | Disables GPU compositing after restart |
| Bundle all media files | Files settings action | — | Copies used media into the Media folder (`source/docs/faq.md:66`) |
| Max lines per slide | template `settings.maxLinesPerSlide` | unset | Only if a template sets it (`src/types/Show.ts:574`) |

## Code

- `public/global.css:1-17` — bundled CMG Sans faces.
- `src/frontend/components/edit/values/boxes.ts:131` — default font family.
- `src/electron/data/defaults.ts:3` — hardware-acceleration default.
- `src/electron/index.ts:88-98` — acceleration decision at startup.
- `src/frontend/components/helpers/dropActions.ts:700-724` — drop mute/loop defaults.
- `src/frontend/utils/shortcuts.ts:531-542` — project item mute/loop resolution.
- `src/frontend/components/settings/SettingsTools.svelte:66-70` — error-log button.
- `src/types/Show.ts:566-577` — template line limits.

## Online docs

- [Styling](https://freeshow.app/docs/styling) — advice only.
- [FAQ](https://freeshow.app/docs/faq) — operational answers; the ones with
  defaults are listed above.

## Doc vs code

- `doc` says hardware acceleration is disabled by default
  (`source/docs/faq.md:88`) / code leaves it enabled unless the user turns on
  **Disable hardware acceleration** (`src/electron/data/defaults.ts:3`,
  `src/electron/index.ts:91-98`).
- `doc` calls the button "Open log file" / the UI says "Open error log"
  (`SettingsTools.svelte:68-70`, `public/lang/en.json:834`).
- `doc` gives two different names for the same backup/restore flow
  (`source/docs/faq.md:44` vs `:64`) / code implements **Backup everything** and
  **Restore** (`FilesButtons.svelte:14-23`).
- `doc` says a video dropped into a project is always unmuted and not looping
  (`source/docs/faq.md:30`) / code has an exception when the file is inside a
  media folder typed `background`
  (`src/frontend/components/helpers/media.ts:447-450`);
  this is `inferred`, not run.

## Open questions

- Whether the FAQ's "translate button" exists in the pinned build, and what it
  calls, was not traced. `unknown`; would need a read of the show toolbar and
  the translation helper.
- Whether `checkForUpdatesAndNotify()` actually installs on Windows without
  elevation is an installer question, not visible in this source. `unknown`.
- Whether dropping a folder of videos into a project ends up muted depends on
  the media-folder types configured on that machine. `unknown` for any specific
  install.
