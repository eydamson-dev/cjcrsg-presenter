# Formats: `.show`, `.project`, `.fsb`

- **ID:** `fmt.show`, `fmt.project`, `fmt.bible`
- **Area:** advanced
- **Online docs:** <https://freeshow.app/docs/format-show> · <https://freeshow.app/docs/format-project> · <https://freeshow.app/docs/format-bible>
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

All three formats are JSON. FreeShow writes each show and each Bible as a
two-element array `[id, value]`; the published `.show` and `.fsb` pages describe
the *value* only, and the importer accepts both the array and a bare object. A
project is a single JSON object, optionally zipped with media, in which case the
JSON must be named `data.json`. There is no schema validation: the object is
stored and re-serialised as-is, with a small normalisation pass on import.

## What the user sees

File → **Import** lists the accepted extensions: `show, json` for a FreeShow
song/presentation, `project, shows, json, zip` for a project. Export writes into
the data folder's `Exports` directory. A Bible is imported from the Scripture
drawer, which accepts `xml, xmm, json, fsb`.

Screenshot: `../screenshots/advanced-format-import.png` — not yet captured.
Shot list:

1. File → Import with the seven FreeShow formats visible, 1440×900.
2. The Bible import dialog with its extension list.
3. Export popup for a project, **Include media** on.
4. The `Exports` folder with a `.show`, a `.project` and a `.fsb` visible.

## `fmtshow`

On-disk shape:

```json
["<id>", { "name": "…", "category": null, "settings": { "activeLayout": "<id>", "template": null }, "timestamps": {…}, "meta": {…}, "slides": {…}, "layouts": {…}, "media": {…} }]
```

`code` — `src/electron/data/save.ts:83-87` (`JSON.stringify([id, value])`),
`src/electron/data/export.ts:194-200` (same, after moving `id` out of the
object), `src/electron/utils/files.ts:1361-1363` (`parseShow` casts to
`[string, Show]`).

Required / optional, from the `Show` interface (`src/types/Show.ts:18-64`):

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes in practice | `fixShowIssues` rewrites a non-string to `""` (`src/frontend/converters/importHelpers.ts:259`) |
| `category` | no | `null` = unsorted; a missing value is set to `null` (`:260`) |
| `settings.activeLayout` | yes for a usable show | If `settings` is missing entirely, it is created with the first layout id or `""` (`:263`) |
| `settings.template` | no | `null` when unused |
| `timestamps.created/modified/used` | no | Created as `{0,0,0}` when missing (`:264`) |
| `meta` | no | Created as `{}` when missing (`:265`); keys are all optional |
| `slides` | yes for content | Created as `{}` when missing (`:261`) |
| `layouts` | yes for content | Created as `{}` when missing (`:262`) |
| `media` | no | Created as `{}` when missing (`:266`) |
| `id` | not in the object | It is the first element of the array; export deletes it from the object (`export.ts:196-199`) |

Fields the published docs omit (from `src/types/Show.ts`):

- Show level: `origin`, `private`, `locked`, `quickAccess`, `reference`,
  `settings.customAction`, `settings.customFonts`, `metadata.tags`, `midi`.
- `Slide`: `id`, `globalGroup`, `locked`, `settings.template`,
  `settings.background`, `settings.backgroundImage`, `timeline`,
  `customDynamicValues` (`:89-108`). The docs show only `settings.color` and
  `settings.resolution`.
- `Item`: the type union has 19 values
  (`text, media, camera, timer, clock, button, events, weather, variable, web,
  qr_code, icon, slide_tracker, visualizer, captions, metronome, current_output,
  chart, table` — `:681`), and `Item` carries ~45 optional fields (`:110-178`).
  The docs show only `type`, `lines`, `style`, `align`, `language`.
- `Layout`: `id`, `timeline`, `recording` (deprecated) (`:320-327`), and each
  layout slide cue has `disabled`, `parent`, `children`, `color`, `nextTimer`,
  `transition`, `filter`, `end`, `timer`, `background`, `overlays`, `effects`,
  `audio`, `mics`, `mediaTransition`, `actions`, `bindings`, `breakDuration`
  (`:372-414`). The docs show `id` and `background` only.
- `Media`: `id`, `cameraGroup`, `type`, `videoType`, `muted`, `loop`, `filters`,
  `base64`, `cloud` (`:453-466`). The docs show `path` and `name` only.

Round trip:

- Import accepts **an array** `[id, show]` or **a bare show object**; a bare
  object gets a new `uid()`. `code` — `src/frontend/converters/importHelpers.ts:59-66`.
- A broken file is retried by truncating at the first `}}]`, in both the importer
  and the main-process parser. `code` — `importHelpers.ts:67-84`;
  `src/electron/utils/files.ts:1367-1385`.
- `fixShowIssues` fills the missing top-level keys, drops child slides that no
  parent references, and clears pathological repeated items. `code` —
  `importHelpers.ts:256-324`.
- `convertOldShowValues` rewrites pre-1.5.7 `layout.recording` into
  `layout.timeline` and deletes `recording` and the start-recording action.
  `code` — `src/frontend/components/helpers/setShow.ts:103-170`.
- Otherwise fields are preserved: saving writes the in-memory object verbatim
  (`save.ts:83-87`), so unknown keys survive.
- Export is lossy in one way: the object's `id` is moved into the tuple, and the
  file name is the show name or the id (`export.ts:196-199`).

## `fmtproject`

Shape (`src/types/Projects.ts:6-46` plus the importer):

| Key | Required | Notes |
| --- | --- | --- |
| `project` | yes | Importer returns early if absent (`src/frontend/converters/project.ts:19-20`) |
| `project.name`, `created`, `parent`, `shows` | expected | `parent` is forced to `"/"` on export (`src/frontend/components/export/project.ts:32`) |
| `shows` (map) | yes | Iterated directly; a missing key would throw (`project.ts:93`) |
| `overlays`, `effects`, `actions`, `variables`, `categories`, `media` | optional | Each merged into the matching store if present (`project.ts:29-89`) |
| `files` | optional | Media references; used only for zip projects |
| `parentFolder` | optional | Name of the folder the project came from; matched by name on import (`project.ts:23`) |

`code` — writer `src/frontend/components/export/project.ts:19-172`; reader
`src/frontend/converters/project.ts:17-110`.

Fields the docs omit, or describe differently:

- Project object: `id`, `deleted`, `notes`, `used`, `timeline`, `archived`,
  `sectionsCollapsed`, `sectionsLocked`, `sourcePath`, `origin`
  (`src/types/Projects.ts:7-22`). The writer deletes `sourcePath` and resets
  `parent` (`export/project.ts:32-33`).
- Top level also accepts `parentFolder`, `effects`, `actions`, `media`,
  `categories`, `variables` (`export/project.ts:111-146`); the docs list only
  `project`, `shows`, `overlays`, `files`.
- Project item types in code are the `ShowType` union
  (`src/types/Show.ts:682`); the exporter handles show, video, image, audio,
  ppt, pdf, overlay, effects, player and section, and logs "Missing project
  type" for anything else (`export/project.ts:36-96,176-180`).
- `played` is stripped from every project item on export
  (`export/project.ts:99`), and `creationTime` is stripped from media data
  (`:162`).

Zip layout and round trip:

- Plain JSON: written as `<name>.project` with `.project` appended by the writer
  (`src/electron/data/export.ts:303-313`).
- With media: a zip whose JSON entry is **`data.json`** and whose media entries
  are renamed `<basename>__<hash><extension>`
  (`export.ts:318-328,367-385`). The `files` array inside `data.json` still
  holds the **original absolute paths**.
- On import the zip's `data.json` is found by name; each path in `files` that
  does not exist on this machine is mapped to
  `<data root>/Imports/Projects/<basename>_<hash><ext>` and every occurrence of
  the old path in the JSON text is replaced before the JSON is parsed.
  `code` — `src/electron/data/import.ts:264-326,188`.
- Import dialog accepts `project`, `shows`, `json`, `zip`
  (`src/frontend/components/main/popups/Import.svelte:19`).

## `fmtbible`

- The published page defers the schema to the `json-bible` package README
  (`source/docs/format-bible.md:12-14`); the repository depends on
  `json-bible@^1.1.9` (`package.json:141`).
- The shape FreeShow stores is `Bible` (`src/types/Bible.ts:1-20`): `id?`,
  `name`, `metadata?`, `copyright?`, `books[]` each with `number`,
  `customName?`, `name`, `abbreviation?`, `chapters[]` each with `number`,
  `verses[]` each with `number`, `value?`, `text`.
- On disk it is `[id, bible]`, filename `<bible.name>.fsb`
  (`src/electron/data/save.ts:65-72`), in the `Bibles` folder.
- Import accepts `[id, bible]` or a bare bible; a missing id is generated, the
  name is sanitised for the file system, and the entry is registered in the
  `scriptures` synced setting as `{ name, id }`.
  `code` — `src/frontend/converters/bible.ts:68-95`.
- The import dialog also accepts Zefania XML, OSIS, Beblia and OpenSong and
  converts them (`bible.ts:10-16`; `src/frontend/components/main/popups/ImportScripture.svelte:184`).
- Extensions: `.fsb` and `.json` per the docs; the dialog offers `xml, xmm,
  json, fsb` because it covers all Bible sources.

## State and persistence

| Format | Written by | Location | Named |
| --- | --- | --- | --- |
| `.show` | `saveShow` | `<data root>/Shows` | `<show.name or id>.show` |
| `.project` | `exportProject` | `<data root>/Exports` or a chosen path | `<project name>.project` |
| `.fsb` | `saveScripture` | `<data root>/Bibles` | `<bible.name>.fsb` |
| Project media (zip) | `extractZipDataAndMedia` | `<data root>/Imports/Projects` | `<basename>_<hash><ext>` on import; `<basename>__<hash><ext>` inside the zip |

`code` — `src/electron/data/save.ts:65-87`,
`src/electron/data/export.ts:303-328`,
`src/electron/data/import.ts:188,264-326`.

## Settings

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Include media in project export | `special.projectIncludeMedia` | `true` | Chooses plain JSON vs zip (`src/frontend/components/export/project.ts:149-169`) |

## Code

- `src/types/Show.ts` — `Show`, `Slide`, `Item`, `Layout`, `Media`, unions.
- `src/types/Projects.ts` — `Project`, `ProjectShowRef`.
- `src/types/Bible.ts` — `Bible`.
- `src/electron/data/save.ts:65-99` — on-disk wrappers and file names.
- `src/electron/data/export.ts:194-200,303-328,367-385` — export.
- `src/electron/data/import.ts:171-201,264-326` — project import and zip extraction.
- `src/frontend/converters/importHelpers.ts:50-100,256-324` — show import and repair.
- `src/frontend/converters/project.ts` — project import.
- `src/frontend/converters/bible.ts:68-95` — `.fsb` import.
- `src/frontend/components/export/project.ts` — project writer.
- `src/frontend/components/helpers/setShow.ts:103-170` — old-show migration.
- `src/frontend/components/main/popups/Import.svelte:17-25` — accepted extensions.

## Online docs

- [.show](https://freeshow.app/docs/format-show) — describes the show object,
  not the array wrapper; the animated comment markers (`// …`) are not valid
  JSON, so the page is illustrative rather than parseable.
- [.project](https://freeshow.app/docs/format-project) — JSON vs zip, `data.json`
  rename, `files` array.
- [.fsb](https://freeshow.app/docs/format-bible) — a link to `json-bible`.

## Doc vs code

- `doc` shows a bare show object (`source/docs/format-show.md:17-107`) / on disk
  it is `[id, show]` (`src/electron/data/save.ts:86`), and the importer accepts
  both (`importHelpers.ts:59-66`).
- `doc` shows a bare Bible link only (`source/docs/format-bible.md:12-14`) / the
  stored shape is `[id, bible]` with FreeShow's `Bible` interface
  (`src/types/Bible.ts:1-20`, `save.ts:71`).
- `doc` lists the slide `settings` as `color` and `resolution`
  (`format-show.md:47-51`) / code also has `template`, `background`,
  `backgroundImage` (`src/types/Show.ts:95-101`).
- `doc` says the default item type is a textbox
  (`format-show.md:56`) / the `ItemType` union has 19 members and no explicit
  default in the type; the default is applied by the creation code, not the
  format (`src/types/Show.ts:681`).
- `doc` lists project item types
  show/section/image/video/audio/overlay/pdf/ppt
  (`format-project.md:27`) / code's type union adds player, effect, screen, ndi,
  camera, folder and show_placeholder, and the exporter only handles a subset
  (`src/types/Show.ts:682`; `export/project.ts:36-96`).
- `doc` says a project zip's `files` names must match the entries in the archive
  (`format-project.md:58-60`) / the exporter keeps original absolute paths in
  `files` and renames the archive entries with a hash suffix; the importer
  reconstructs the mapping from the hash (`export.ts:325`;
  `import.ts:282-298`).
- `doc` says `.project`/`.json` (and `.shows`) are accepted
  (`format-project.md:12`) / matches the import dialog
  (`Import.svelte:19`).

## Open questions

- Whether the importer tolerates a missing `shows` map in a project (the code
  iterates `Object.entries(shows)` with no guard, `project.ts:93`) is an error
  path, not verified. `unknown`.
- `json-bible`'s exact field set was not read (no `node_modules` in the
  checkout); the `Bible` interface is the only in-repo statement. Whether a
  third-party `.fsb` that follows the package README but not `Bible` imports
  cleanly is `unknown`; a fixture would establish it.
- Whether the `[id, show]` wrapper is accepted by other FreeShow versions (the
  docs describe the bare object) was not checked against older releases.
  `unknown`.
- Folder project items (`type: "folder"`) are not handled by the exporter's
  handler map; whether they survive an export/import round trip was not traced
  past the "Missing project type" log line (`export/project.ts:176-180`).
  `unknown`.
