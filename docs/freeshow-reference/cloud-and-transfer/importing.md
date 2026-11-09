# Importing

- **ID:** `import.formats`, `import.pdf`, `import.pptx`
- **Area:** cloud-and-transfer
- **Online docs:** <https://freeshow.app/docs/importing>
- **Pinned code:** ff784eb
- **Confidence:** `code`. No import was executed.

## Summary

File > Import turns another program's songs, or a text/CSV/ChordPro/Word file,
into FreeShow shows. PDF and PowerPoint are special: PDF is always rendered to page
images, and PowerPoint is unzipped and rebuilt as slides with formatting.

## What the user sees

Open with **File > Import** or <kbd>Ctrl/Cmd+I</kbd>; <kbd>Ctrl/Cmd+Alt+I</kbd>
imports the clipboard directly (`src/frontend/utils/shortcuts.ts:45-46`;
`src/frontend/components/context/menuClick.ts:147`). The popup
(`src/frontend/components/main/popups/Import.svelte`) has four groups:

1. **FreeShow** buttons: Song/Presentation File, Project File, and **More options**
   which reveals Template, Overlay, Action, Stage Layout and Theme
   (`Import.svelte:17-28`, `133-154`).
2. **Paste from clipboard** (`Import.svelte:249-260`).
3. **Media import**: Lessons.church, PDF, PowerPoint — PowerPoint has a second
   button opening its four conversion options (`Import.svelte:58-69`, `264-300`).
4. **Text import**: a grid of fifteen buttons (`Import.svelte:304-320`).

When opened from a project, the popup shows only PDF, PowerPoint, TXT, ChordPro
and the clipboard button (`Import.svelte:167-222`).

Screenshot: `../screenshots/cloud-and-transfer-importing.png` — not yet captured.

Shot list (reference at ff784eb, main window, 1280×800):

1. File > Import, default view: two FreeShow buttons, More options, Paste, Media
   import row, and the full Text import grid.
2. The PowerPoint sub-page with its four options.
3. The FreeShow "More options" page.
4. An imported PDF result: a show with image slides and the "Converted" category.

## How it behaves

### The menu, mapped to code

`Import.svelte` is the authoritative list of what a user can pick. Extensions are
from the same file.

| Group | Button | Extensions | Channel | Converter |
| --- | --- | --- | --- | --- |
| FreeShow | Song/Presentation File | `show`, `json` | `freeshow` | `converters/importHelpers.ts:50-100` |
| FreeShow | Project File | `project`, `shows`, `json`, `zip` | `freeshow_project` | `import.ts:171-202` + `converters/project.ts` |
| FreeShow (more) | Template | `fstemplate`, `fst`, `template`, `json`, `zip` | `freeshow_template` | `import.ts:206-231` |
| FreeShow (more) | Overlay | `fsoverlay`, `fso`, `overlay`, `json`, `zip` | `freeshow_overlay` | `import.ts:235-260` |
| FreeShow (more) | Action | `fsaction`, `action`, `json` | `freeshow_action` | `importHelpers.ts:149-177` |
| FreeShow (more) | Stage Layout | `fsstage`, `stage`, `json` | `freeshow_stage` | `importHelpers.ts:179-223` |
| FreeShow (more) | Theme | `fstheme`, `theme`, `json` | `freeshow_theme` | `importHelpers.ts:243-254` |
| Media | Lessons.church | `json`, `olp`, `olf` | `lessons` | `converters/lessonsChurch.ts` |
| Media | PDF | `pdf` | `pdf` | `thumbnails.ts:272-325` + `converters/imageShow.ts` |
| Media | PowerPoint | `ppt`, `pptx` | `powerpoint` | `output/ppt/pptToShow.ts` + `converters/powerpoint/powerpointImporter.ts` |
| Text | Text | `txt` | `txt` | `converters/txt.ts:29-49` |
| Text | CSV | `csv` | `csv` | `converters/csv.ts` |
| Text | ChordPro | `cho`, `crd`, `chopro`, `chordpro`, `chord`, `pro`, `txt`, `onsong` | `chordpro` | `converters/chordpro.ts` |
| Text | Word | `doc`, `docx` | `word` | `word-extractor` then `converters/txt.ts` (`import.ts:31-42`) |
| Text | ProPresenter | `pro4`, `pro5`, `pro6`, `pro`, `json`, `proBundle` | `propresenter` | `converters/propresenter.ts` |
| Text | EasyWorship | `db` | `easyworship` → `sqlite` | `converters/easyworship.ts` |
| Text | VideoPsalm | `json`, `vpc` | `videopsalm` | `converters/videopsalm.ts` |
| Text | OpenLP/OpenLyrics | `xml`, `sqlite` | `openlp` | `converters/openlp.ts` |
| Text | OpenSong | *(none)* | `opensong` | `converters/opensong.ts` |
| Text | MediaShout | `ssc`, `xml`, `mdb` | `mediashout` | `converters/mediashout.ts` |
| Text | Quelea | `xml`, `qsp` | `quelea` | `converters/quelea.ts` |
| Text | SoftProjector | `sps` | `softprojector` → `sqlite` | `converters/softprojector.ts` |
| Text | Songbeamer | `sng` | `songbeamer` | `converters/songbeamer.ts` |
| Text | Easyslides | `xml` | `easyslides` | `converters/easyslides.ts` |
| Text | VerseVIEW | `xml` | `verseview` | `converters/verseview.ts` |

Channels are dispatched in `src/frontend/IPC/responsesMain.ts:561-626`; file
reading, sqlite/mdb decoding and zip expansion happen in
`src/electron/data/import.ts:19-149`. Zip inputs (`zip`, `probundle`, `vpc`, `qsp`)
are expanded first (`import.ts:118-130`).

**25 buttons.** The docs list 19 items (`source/docs/importing.md:18-39`), and the
feature inventory calls it "18 programs and file types"
(`feature-inventory.md:257`). The differences are all additions in code: the docs
name "FreeShow" once while the menu has seven FreeShow formats, and the docs do not
list the PowerPoint "Controller" path (below).

### Everything in `src/frontend/converters`

The directory has 30 files; not all are show converters.

| File | Role | In the import menu |
| --- | --- | --- |
| `chordpro.ts` | ChordPro → show | yes |
| `csv.ts` | CSV → show | yes |
| `easyslides.ts` | Easyslides XML | yes |
| `easyworship.ts` | EasyWorship sqlite | yes |
| `imageShow.ts` | list of images → show | PDF only (not a button) |
| `lessonsChurch.ts` | Lessons.church `.olp`/`.olf` | yes |
| `mediashout.ts` | MediaShout sqlite/mdb/xml | yes |
| `openlp.ts` | OpenLP/OpenLyrics | yes |
| `opensong.ts` | OpenSong songs and bibles | yes (bibles elsewhere) |
| `powerpoint/` (4 files) | PPTX shapes, text, colours | yes |
| `project.ts` | `.project` archive in/out | project import/export |
| `propresenter.ts` | ProPresenter 4–7 | yes |
| `quelea.ts` | Quelea | yes |
| `softprojector.ts` | SoftProjector sqlite | yes |
| `songbeamer.ts` | Songbeamer `.sng` | yes |
| `txt.ts`, `txtAutoSections.ts` | text → show, section detection | Text, Word, clipboard |
| `videopsalm.ts` | VideoPsalm | yes |
| `verseview.ts` | VerseVIEW | yes |
| `calendar.ts` | `.ics` → calendar | no (Calendar drawer) |
| `bible.ts`, `bebliaBible.ts`, `osisBible.ts`, `zefaniaBible.ts` | scripture formats → `.fsb` | no (Scripture drawer) |
| `canvaPresentation.ts` | Canva export → show | no (Media/Canva) |
| `xml.ts` | XML helper | no |
| `importHelpers.ts` | shared show/template/overlay/action/stage import | yes |

`calendar`, `BIBLE` and `powerkey` are also valid `IMPORT2` channels
(`responsesMain.ts:617-621`, `579`) even though they are not buttons in this popup.

### PDF (`import.pdf`)

PDF takes the image path, not a text path.

1. The PDF button sends `Main.IMPORT` with `{ channel: "pdf", extensions: ["pdf"] }`
   (`Import.svelte:60`, `278`). The main process opens a file dialog
   (`src/electron/IPC/responsesMain.ts:296-303`) and `specialImports.pdf` passes the
   paths through unchanged (`import.ts:43`).
2. The renderer sees string paths and calls `Main.PDF_TO_IMAGE` for each
   (`responsesMain.ts:566-578`).
3. `pdfToImage` asks the renderer to render the pages (`get_pdf_thumbnails`), then
   writes one JPG per page to `<data>/Imports/PDF/<name>/<n>.jpg`
   (`src/electron/data/thumbnails.ts:272-317`). A name collision gets a timestamp
   suffix (`thumbnails.ts:279-281`).
4. `IMAGES_TO_SHOW` creates a new show in a hidden **Converted** category: one
   parent slide, one child per page, each page as a background image
   (`converters/imageShow.ts:8-55`; category created at `imageShow.ts:11`).
5. A PDF that is a project item is different: it is displayed live by
   `src/frontend/components/show/pdf/PdfPreview.svelte` (pdfjs canvases, one per
   page), and a **Convert to images** button on that item triggers the same
   `PDF_TO_IMAGE` path (`PdfPreview.svelte:183-190`, `231-234`).
6. Progress is reported through the `pdfImports` store and the progress panel
   (`responsesMain.ts:266-291`; `src/frontend/components/main/ProgressPanel.svelte`).

### PowerPoint (`import.pptx`)

1. The PowerPoint button imports as text-and-formatting in one step
   (`Import.svelte:271-276` calls `pptText()` at `71-74`).
2. The main process unzips the `.pptx` to `<data>/Imports/PowerPoint/<name>/`,
   streaming `ppt/media/*` and `ppt/fonts/*` to disk and parsing the XML to JSON
   (`src/electron/output/ppt/pptToShow.ts:10-77`). Only a zip can be read; a legacy
   binary `.ppt` reaches the "Invalid format" alert (`pptToShow.ts:19`, `77-84`).
3. The renderer rebuilds the presentation: shapes, text runs, colours, notes, hidden
   slides marked disabled, core properties into title/artist
   (`converters/powerpoint/powerpointImporter.ts:43-93`). It lands in the selected
   category, or a default `presentation` category (`powerpointImporter.ts:19-21`).
4. The second PowerPoint button opens four alternatives
   (`Import.svelte:64-69`, `116-132`):
   - **Slides** — the same one-step import; the UI warns "Imperfect formatting."
   - **PDF** — converts with LibreOffice, else PowerPoint on Windows/macOS, then
     feeds the resulting PDF back into the PDF import (`src/electron/output/ppt/pptToPdf.ts:11-46`,
     `63-88`).
   - **PDF (Online)** — opens `https://www.ilovepdf.com/powerpoint_to_pdf` in the
     browser (`Import.svelte:78-82`).
   - **Controller (Deprecated)** — sends `powerkey`, which adds the presentation to
     the project as a `ppt` item (`Import.svelte:83-85`; `responsesMain.ts:579`).

### Other channels reachable from elsewhere

- **Calendar `.ics`**: `convertCalendar` adds events and overwrites events from the
  same calendar, so a re-import updates rather than duplicates
  (`converters/calendar.ts:103-131`, `327-339`). The docs describe this on the
  Importing page (`source/docs/importing.md:59-61`) but it is not in the Import
  popup; the Calendar drawer owns the entry point.
- **Bibles**: `BIBLE` auto-detects Zefania, OSIS, Beblia or OpenSong
  (`import.ts:143-146`; `converters/bible.ts:12-15`) and is triggered from the
  Scripture import popup (`ImportScripture.svelte:101-112`).
- **Canva**: `canvaPresentation.ts` turns a Canva export into a show; it is
  reachable from Canva media, not from File > Import.

### Edge cases

- Importing a show file with the same name creates a renamed show through
  `checkName` (`importHelpers.ts:95-96`); broken JSON is truncated at `}}]` and
  retried (`importHelpers.ts:67-84`).
- A show's category is kept only if it exists locally, otherwise the currently
  selected category is used (`importHelpers.ts:90-93`).
- Imported project/template/overlay zips are extracted to `<data>/Imports/<type>`
  and their hashed media paths are rewritten (`import.ts:188-201`, `264-290`).
- OpenSong has no extension filter (`Import.svelte:49`), so the dialog offers every
  file; the converter then decides (`code`, not run).

## State and persistence

| What | Where it lives | When it is written | Survives restart |
| --- | --- | --- | --- |
| Imported shows | normal show files in `<data>/Shows` | on the next save | yes |
| PDF page images | `<data>/Imports/PDF/<name>/` | during the import | yes |
| Unpacked PowerPoint and converted PDFs | `<data>/Imports/PowerPoint/` | during the import | yes |
| Project/template/overlay media | `<data>/Imports/Projects` etc. | during the import | yes |
| Created categories | `categories` in `SYNCED_SETTINGS` | during the import | yes, and cloud-synced |
| PDF progress | `pdfImports` store (memory) | during the import | no |

## Settings

No import-specific settings were found. The clipboard import uses `noFormatting: true`
(`importHelpers.ts:234`), and text import formatting follows the "format new show"
setting (`converters/txt.ts:445`, `formatNewShow` from settings).

## Code

- `src/frontend/components/main/popups/Import.svelte:17-321` — the menu and every extension list.
- `src/frontend/IPC/responsesMain.ts:561-626` — channel dispatch.
- `src/electron/data/import.ts:19-149` — file reading, sqlite/mdb, zip, Word.
- `src/electron/data/thumbnails.ts:272-325` — PDF to JPG.
- `src/frontend/converters/imageShow.ts` — PDF images to a show.
- `src/electron/output/ppt/pptToShow.ts` and `src/frontend/converters/powerpoint/` — PowerPoint.
- `src/electron/output/ppt/pptToPdf.ts` — PowerPoint→PDF alternatives.

## Online docs

- <https://freeshow.app/docs/importing> — the only place the program list is
  published (`source/docs/importing.md:16-39`); it is a subset of the menu.
- The docs' EasyWorship FAQ (`source/docs/importing.md:63-67`) matches the in-app
  tutorial string asking for `SongsWords.db`/`SongWords.db` and optionally
  `Songs.db` (`Import.svelte:36-41`).

## Doc vs code

- `doc` lists 19 import items (`source/docs/importing.md:18-39`); `feature-inventory.md:257`
  says "18 programs and file types". Code has **25** buttons
  (`Import.svelte:17-62`) — the extra ones are the six additional FreeShow formats,
  plus the PowerPoint alternatives, calendar and Bible living outside the popup.
- `doc` says PowerPoint imports "just the text"
  (`source/docs/importing.md:47`). Code imports shapes, text styling, colours,
  notes and hidden-slide state (`powerpointImporter.ts:43-93`); the in-app label is
  "Imperfect formatting" (`Import.svelte:65`).
- `doc` says a PDF import has "an option to convert the PDF pages to images"
  (`source/docs/importing.md:53`). Code does: the Import menu always converts pages
  to images (`responsesMain.ts:566-578`); the optional button exists on a PDF
  **project item** (`PdfPreview.svelte:185-190`).
- `doc` has a **Project** section (`source/docs/importing.md:55-57`) but no
  template/overlay/action/stage/theme sections, all of which are menu entries
  (`Import.svelte:20-24`).
- `doc` lists "FreeShow" as one format (`source/docs/importing.md:18`). Code splits
  it into show, project, template, overlay, action, stage layout and theme
  (`Import.svelte:17-25`).
- `doc` lists Calendar on this page (`source/docs/importing.md:59-61`); it is not in
  the Import popup, only in the Calendar drawer (`responsesMain.ts:619`).
- `doc` says ProPresenter "4-7+" (`source/docs/importing.md:19`); the file dialog
  accepts `pro4`, `pro5`, `pro6`, `pro`, `json`, `proBundle`
  (`Import.svelte:35`) — consistent.

## Open questions

- Whether a legacy binary `.ppt` imports at all: the code only unzips, and a
  non-zip triggers "Invalid format" (`pptToShow.ts:19`, `77-84`) — needs a run with
  both `.ppt` and `.pptx` (`unknown`).
- The actual fidelity of the PowerPoint converter (positions, fonts, images) is not
  established; the source comments list known gaps: missing charts/SmartArt,
  some item/line backgrounds and text colours, embedded audio/video
  (`powerpointImporter.ts:11-13`) — `unknown` how visible these are.
- Whether `Main.PDF_TO_IMAGE` for a very large PDF hits the 5-minute render timeout
  (`thumbnails.ts:298`) — `unknown`.
- What the FreeShow `freeshow_theme` channel expects: `importSpecific` stores the
  parsed JSON under a new uid directly into `themes` without validation
  (`importHelpers.ts:243-254`) — the file shape is `unknown`.
