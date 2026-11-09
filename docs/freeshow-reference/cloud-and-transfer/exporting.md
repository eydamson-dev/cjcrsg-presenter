# Exporting

- **ID:** `export.formats`
- **Area:** cloud-and-transfer
- **Online docs:** <https://freeshow.app/docs/exporting>
- **Pinned code:** ff784eb
- **Confidence:** `code`. No export was run; PDF output is produced by an Electron
  print window and was not printed.

## Summary

File > Export writes a `.project`, one `.show` per show, a `.txt` per show, a PDF,
or a folder of slide images. The docs describe four; the code has five.

## What the user sees

**File > Export** or <kbd>Ctrl/Cmd+E</kbd> (`src/frontend/utils/shortcuts.ts:45`;
`src/frontend/components/context/menuClick.ts:148`) opens the export popup
(`src/frontend/components/main/popups/export/Export.svelte`). The user first picks
**what** to export, then **which format**:

- What (`exportHelper.ts:17-22`): **Current project**, **Selected shows**,
  **All shows**.
- Format (`exportHelper.ts:7-15`): **Project**, **Show**, **Text**, **PDF**,
  **Image**.

The format list is filtered by the choice (`Export.svelte:35-47`):

| What | Formats offered |
| --- | --- |
| Current project | Project, PDF |
| Selected shows | all five |
| All shows | Show, Text |

PDF opens a second panel of options with a live preview
(`Export.svelte:124-145`; `src/frontend/components/main/popups/export/PdfExport.svelte`).
Project export has an **Include media** toggle, on by default
(`Export.svelte:196`).

Screenshot: `../screenshots/cloud-and-transfer-exporting.png` — not yet captured.

Shot list (reference at ff784eb, main window, 1280×800):

1. File > Export with "Selected shows" chosen — all five formats visible.
2. File > Export with "Current project" — only Project and PDF.
3. PDF options panel: type dropdown (Default/Text/Slides/Media/Chord Sheet) and
   the checkboxes.
4. The Exports folder after an export, showing the written files.

## How it behaves

### Common flow

1. The popup loads the selected shows into `showsCache` for the preview
   (`Export.svelte:62-78`).
2. On export, it saves the workspace and waits 500 ms before exporting, because the
   `.show`/`.txt` paths re-read files from the Shows folder
   (`Export.svelte:88-90`; `src/electron/data/export.ts:267-279`).
3. "All shows" is a separate branch that exports every show into a timestamped
   subfolder of Exports (`Export.svelte:92-96`; `export.ts:281-299`).
4. Everything else sends `EXPORT: GENERATE` with the show ids and names
   (`Export.svelte:146-148`).
5. When a file finishes, the Exports folder is opened in the file manager once per
   session (`export.ts:93-105`).

### Project

- Builds `{ project, parentFolder, shows, overlays?, effects?, actions?, variables?, categories?, files?, media? }`
  in the renderer (`src/frontend/components/export/project.ts:19-172`).
- Project name, parent folder reset to `/`, and `sourcePath` removed
  (`project.ts:29-33`).
- Media referenced by backgrounds, audio, media items, overlays and project items is
  collected (`project.ts:36-96`, `185-201`); HTTP and data URLs are skipped
  (`project.ts:67`).
- **Include media** is on by default (`special.projectIncludeMedia ?? true`,
  `project.ts:149`); when on, each file path is resolved to its real path and the
  media metadata is embedded (`project.ts:150-169`).
- With no files it writes plain JSON; with files it writes a zip whose media names
  are `<name>__<hash><ext>` (`export.ts:303-329`).
- The archive is written to Exports, or beside the original when re-saving a project
  with a known path (`export.ts:305-317`).

### Show

- Writes one `<name>.show` per show, each containing the JSON array `[id, show]`
  (`export.ts:194-201`).
- Media is not embedded, only referenced by path; the `.show` format itself is
  covered in `advanced/formats.md`.

### Text

- Writes one `<name>.txt` per show (`export.ts:205-209`).
- The text walker follows the active layout, inserts `[Group]` lines, writes each
  text line and re-inserts chords as `[chord]` at their positions
  (`export.ts:212-263`).
- "All shows" with Text writes into a timestamped subfolder (`export.ts:287-295`).

### PDF

- Types: **Default**, **Text**, **Slides**, **Media**, plus **Chord Sheet** only
  when the preview show contains chords (`PdfExport.svelte:54-60`).
- Options (`PdfExport.svelte:19-47`, `78-108`):
  metadata, page numbers, groups, numbers, notes, invert, original text size and
  text size, rows and columns; chord sheet adds font size, margin, line spacing,
  columns per page, chord font size and chord colour.
- The renderer draws the pages (`src/frontend/components/export/Pdf.svelte`), an
  offscreen `BrowserWindow` loads them and `printToPDF` writes the file
  (`export.ts:154-180`, `117-144`).
- Page size is A4 portrait, except type **Media**, which uses a 16:9 page
  (`export.ts:117-131`).
- One file per show, unless the export is a project, in which case `oneFile` is
  forced (`Export.svelte:130-132`; `PdfExport.svelte:50-51`).
- A project PDF includes show, section, image, video and audio project items as
  pages (`Export.svelte:133-143`).

### Image

- Only the first selected show is used (`Export.svelte:114-123`).
- Each slide is rendered to a thumbnail (background plus overlays) and saved as
  `<Exports>/Images/<show>/<n>.jpg` (`exportHelper.ts:49-78`;
  `Export.svelte:118-122`; `src/electron/data/thumbnails.ts:237-254`).
- Disabled slides are skipped (`exportHelper.ts:63`).

### Edge cases

- No format or nothing to export returns without writing
  (`Export.svelte:80-86`).
- "All shows" only supports Show and Text; the main process ignores other types
  (`export.ts:281-285`).
- If the folder cannot be written, the error is shown as an alert
  (`export.ts:95-104`).

## State and persistence

| What | Where it lives | When it is written | Survives restart |
| --- | --- | --- | --- |
| Exported files | `<data>/Exports` (`export.ts:32`, `85`) | on export | yes |
| All-shows batch folder | `<data>/Exports/<timestamp>/` (`export.ts:289-292`) | on export | yes |
| Image export | `<data>/Exports/Images/<show>/` (`thumbnails.ts:247-252`) | on export | yes |
| `projectIncludeMedia` | `special` in `settings.json` (`project.ts:149`) | when toggled | yes |
| PDF options | local popup state, defaults rebuilt each open (`PdfExport.svelte:19-48`) | not persisted | no |

## Settings

| Setting | Key and location | Default | Effect |
| --- | --- | --- | --- |
| Include media | `special.projectIncludeMedia` | `true` (`project.ts:149`) | bundle media in `.project` |
| PDF options | popup state | see above | page layout and content |

## Code

- `src/frontend/components/main/popups/export/exportHelper.ts:7-78` — formats, types, selection, image rendering.
- `src/frontend/components/main/popups/export/Export.svelte:35-152` — filtering and dispatch.
- `src/frontend/components/main/popups/export/PdfExport.svelte:19-108` — PDF options.
- `src/electron/data/export.ts:29-329` — JSON, show, TXT, PDF window, project.
- `src/frontend/components/export/project.ts:19-172` — project payload and media collection.
- `src/electron/data/thumbnails.ts:237-254` — image export write.

## Online docs

- <https://freeshow.app/docs/exporting> — describes Project, SHOW, TXT and PDF
  (`source/docs/exporting.md:16-30`); the Image format is not mentioned, and the
  project-media statement is out of date (below).

## Doc vs code

- `doc` lists four formats (`source/docs/exporting.md:16-30`). Code has five,
  including **Image** (`exportHelper.ts:12`; `Export.svelte:114-123`).
- `doc` says project media "have to be transported manually right now"
  (`source/docs/exporting.md:18`). Code does: media is bundled by default into the
  `.project` zip, with an **Include media** toggle on by default
  (`project.ts:149-169`; `export.ts:303-329`).
- `doc` says PDF creates "a PDF for each of the selected shows"
  (`source/docs/exporting.md:30`). Code does: one file per show except when the
  export is a project, which is forced to a single file (`Export.svelte:130-132`).
- `doc` says TXT is "a text file from all the selected shows"
  (`source/docs/exporting.md:24-26`). Code does: one `.txt` per show, and for "All
  shows" a timestamped subfolder (`export.ts:205-209`, `287-295`).
- `doc` says SHOW is exported "with all the formatting included"
  (`source/docs/exporting.md:22`). Code does: the show's JSON with all style data,
  but media files are only referenced by path, not embedded (`export.ts:194-201`).

## Open questions

- PDF fidelity: the file is produced by Chromium's `printToPDF` on a rendered page
  (`export.ts:133`), so fonts and transitions depend on the export window, not on
  the output window. A printed sample would establish it (`unknown`).
- Whether the **Image** export includes text and items or only the background: the
  code calls `getSlideThumbnail` with background and overlays
  (`exportHelper.ts:70-72`), which implies full slide rendering, but the thumbnail
  path was not inspected end-to-end (`unknown`).
- Whether a `.project` with hashed media names re-imports cleanly on another
  machine: the import side rewrites hashed names (`import.ts:272-290`), but the
  round trip was not run (`unknown`).
