# FreeShow feature inventory

The base list: every feature the published documentation describes, with a stable
ID. Detail pages under this directory take one area and record how the feature
behaves, with code references.

This page is built from `source/docs/*.md` (the upstream Markdown, mirrored at
`8d875b5`). It is a list, not evidence: a row says the docs describe the feature,
not that the behaviour has been confirmed in the code.

## How to use it

- An ID never changes. Pages, scenarios and contracts cite the ID.
- `code entry` names the module or directory where the behaviour starts. Exact
  `path:line` citations belong on the detail page.
- `detail` is the page that describes the behaviour. `planned` means the page does
  not exist yet; the row still stands as a feature claim from the docs.
- A row with `doc only` has no code entry because the behaviour is configuration
  or documentation, not a code path (styling advice, for example).

## Coverage

| Area | Rows | Detail page |
| --- | --- | --- |
| Getting started | 8 | `getting-started/index.md` |
| Projects | 13 | `getting-started/projects.md` |
| Shows and slides | 60 | `show/index.md` |
| Drawer | 58 | `drawer/index.md` |
| Outputs | 24 | `outputs/index.md` |
| Remote and clients | 12 | `remote/index.md` |
| Cloud and transfer | 17 | `cloud-and-transfer/index.md` |
| Advanced, tips and formats | 21 | `advanced/index.md` |
| Internal | 12 | `internal/index.md` |
| **Total** | **225** | |

## Getting started

| ID | Feature | What it is | Docs | Code entry | Detail |
| --- | --- | --- | --- | --- | --- |
| gs.intro | Product scope | Show slides and lyrics on a screen; Windows, macOS, Linux | `introduction.md` | — | planned |
| gs.install.windows | Windows install | Installer, auto-update, admin rights | `windows.md` | `src/electron` | planned |
| gs.install.macos | macOS install | Install, kiosk mode, right-click caveat | `macos.md` | `src/electron` | planned |
| gs.install.linux | Linux install | Packages and permissions | `linux.md` | `src/electron` | planned |
| gs.languages | Languages | 20 UI languages | `features.md` | `src/frontend/values`, i18n | planned |
| gs.font | CMG Sans | Bundled font | `features.md` | assets | planned |
| gs.requirements | System requirements | Chromium 138, modern browser hardware | `features.md` | `package.json` | planned |
| gs.features | Feature summary | The published feature list, used as the coverage checklist | `features.md` | — | planned |

## Projects

| ID | Feature | What it is | Docs | Code entry | Detail |
| --- | --- | --- | --- | --- | --- |
| proj.model | Project model | A playlist of songs, videos, presentations and other elements | `projects.md`, `project-list.md` | `src/types/Projects.ts` | planned |
| proj.list | Project list | All projects in one place; folder icon in Show mode | `projects.md` | `src/frontend/components/show/Projects.svelte` | planned |
| proj.folders | Folders | Nested folders; New folder; drag projects in | `projects.md` | `src/frontend/components/show/folder` | planned |
| proj.create | Create project | New project button | `projects.md` | `src/frontend/components/show/Projects.svelte` | planned |
| proj.template | Project templates | Right click, Create template; reuse the structure | `projects.md` | project menu | planned |
| proj.items | Project items | Shows, sections, images, videos, audio, overlays, pdf, ppt | `project-list.md` | `src/types/Projects.ts` | planned |
| proj.reorder | Reorder items | Drag inside the project | `project-list.md` | `src/frontend/components/show/ProjectList.svelte` | planned |
| proj.navigate | Navigate items | Click or arrow up/down | `project-list.md` | `src/frontend/components/helpers/OutputHelper.ts` | planned |
| proj.private | Private shows | Lock icon; hidden from the shows list; shared everywhere | `project-list.md` | `src/frontend/components/show` | planned |
| proj.sections | Sections | Titles, notes, color; settings per section | `project-list.md` | `src/frontend/components/show/Section.svelte` | planned |
| proj.search-add | Quick add | Ctrl/Cmd+F search, Enter adds the first result | `project-list.md` | `src/frontend/components/quicksearch` | planned |
| proj.export | Export project | File > Export > Project; `.project` zip or json | `project-list.md`, `exporting.md` | `src/frontend/components/export` | planned |
| proj.import | Import project | File > Import > Project | `project-list.md`, `importing.md` | `src/frontend/converters` | planned |

## Shows and slides

| ID | Feature | What it is | Docs | Code entry | Detail |
| --- | --- | --- | --- | --- | --- |
| show.model | Show model | A slideshow: lyrics, events, presentations, images, verses | `show-type.md` | `src/types/Show.ts` | planned |
| show.create | Create show | Drawer > Shows > New show; name, category | `show-type.md` | `src/frontend/components/drawer/pages/Shows.svelte` | planned |
| show.quicklyrics | Quick Lyrics | Paste text, auto groups, create slides | `show-type.md` | show creation popup | planned |
| show.quicklyrics.syntax | Quick Lyrics syntax | `[Group]` parts; blank line splits a part into slides | `show-type.md` | text parser | planned |
| show.quicklyrics.metadata | Metadata import | `Title=`, `CCLI=`, custom fields | `show-type.md` | text parser | planned |
| show.quicklyrics.options | Quick Lyrics options | Auto assign groups, format text, max lines; remembered | `show-type.md` | popup options | planned |
| show.quicklyrics.shortcut | Clipboard import | Ctrl/Cmd+Alt/Option+I creates a show from the clipboard | `show-type.md`, `shortcuts.md` | `src/frontend/values/keys.ts` | planned |
| show.categories | Show categories | Organise shows; category changes the project icon | `show-type.md` | `src/frontend/components/drawer` | planned |
| show.search | Search shows | Search bar; title and cached content | `show-type.md` | `src/frontend/components/drawer` | planned |
| show.archive | Archive category | Right click a category to hide it from All and searches | `drawer.md` | `src/frontend/components/drawer/pages/Shows.svelte` | planned |
| show.views.grid | Grid view | WYSIWYG slides in a grid | `views.md` | `src/frontend/components/show/Slides.svelte` | planned |
| show.views.simple | Simple view | Icons, labels and disabled slides hidden | `views.md` | same | planned |
| show.views.list | List view | Slides left, text editing right | `views.md` | same | planned |
| show.views.lyrics | Lyrics view | Plain text list for singing along | `views.md` | same | planned |
| show.present | Presenting | Click or arrows/space; space at the end goes to the next show | `show-type.md`, `shortcuts.md` | `src/frontend/components/helpers/OutputHelper.ts` | planned |
| show.present.active | Active vs outputted show | Arrows change the outputted show; space plays the active show | `show-type.md` | `OutputHelper.ts` | planned |
| nav.bounds.next-at-end | Next at a show end | Selects the next project item, then plays it; the setting can stop it; no wrap | `show-type.md` | `src/frontend/components/helpers/OutputHelper.ts` | `show/presenting.md` |
| show.slides | Slides | One group can have many slides | `show-type.md` | `src/types/Show.ts` | planned |
| show.slides.disabled | Disabled slides | Skipped by navigation and timers; still clickable | `show-type.md` | layout data | planned |
| show.backgrounds | Backgrounds | Drag media onto a slide; ghost backgrounds across slides | `show-type.md` | `src/frontend/components/show/media` | planned |
| show.backgrounds.missing | Missing media | Auto-search by filename in media folders | `show-type.md`, `media.md` | media finder | planned |
| show.edit | Edit view | Select slide, edit text/items, tools on the right | `editing.md` | `src/frontend/components/edit/Editor.svelte` | planned |
| show.edit.tabs | Edit tool tabs | Content, style, items, filters, slide | `editing.md` | `src/frontend/components/edit/tools` | planned |
| show.edit.autosize | Auto size | Shrink to fit (default) or grow to fit | `editing.md` | item style | planned |
| show.edit.scrolling | Text scrolling | Animated overflow behaviour | `editing.md` | item style | planned |
| show.edit.css | Custom CSS | CSS boxes for items and styles | `editing.md` | item style | planned |
| show.edit.textedit | Text edit mode | Textarea edits slides/groups; updates on blur | `editing.md` | `src/frontend/components/show/TextEditor.svelte` | planned |
| show.edit.vb | Virtual breaks | `[_VB]` breaks some outputs only; Skip virtual break per style | `editing.md`, `styles.md` | style options | planned |
| show.items | Items | 14 item types | `items.md` | `src/frontend/components/edit/ItemAddMenu.svelte` | planned |
| show.items.text | Text item | Text or a shape | `items.md` | item renderer | planned |
| show.items.media | Media item | Image or video on a slide | `items.md` | item renderer | planned |
| show.items.website | Website item | URL or local HTML; navigable in the output | `items.md` | item renderer | planned |
| show.items.timer | Timer item | Countdown/up, line or circle | `items.md` | item renderer | planned |
| show.items.clock | Clock item | Analog or digital system time | `items.md` | item renderer | planned |
| show.items.list | List item | Items shown as a list, optionally timed | `items.md` | item renderer | planned |
| show.items.camera | Camera item | Camera input feed | `items.md` | item renderer | planned |
| show.items.variable | Variable item | Text or number variable | `items.md`, `functions.md` | item renderer | planned |
| show.items.progress | Progress item | Slide number, bar, or groups with current highlighted | `items.md` | item renderer | planned |
| show.items.events | Events item | Upcoming calendar events | `items.md` | item renderer | planned |
| show.items.weather | Weather item | Forecast by latitude/longitude | `items.md` | item renderer | planned |
| show.items.visualizer | Visualizer item | Audio frequency lines | `items.md` | item renderer | planned |
| show.items.captions | Captions item | Live speech to text | `items.md` | item renderer | planned |
| show.items.icon | Icon item | SVG icon | `items.md` | item renderer | planned |
| show.dynamic | Dynamic values | Date, names, metadata, variables; `\|` fallback | `items.md` | dynamic value resolver | planned |
| show.itemactions | Item actions | Line-by-line reveal; click reveal | `items.md` | item actions | planned |
| show.chords | Chords | Chord mode, add/remove, existing chords | `chords.md` | `src/frontend/components/edit` | planned |
| show.chords.display | Chords in outputs | Enable per textbox for main and stage | `chords.md` | item settings | planned |
| show.chords.transpose | Transpose | Global (show file) and local (stage browser cache) | `chords.md` | stage client | planned |
| show.groups | Groups | Group list, click/drag into arrangement, synced edits | `groups.md` | `src/frontend/components/show/ShowTools.svelte` | planned |
| show.groups.none | None group | `.` hides a group from the group list | `groups.md` | group handling | planned |
| show.groups.global | Global groups | Shared name/color, keyboard shortcut | `groups.md` | settings, `defaults.ts` | planned |
| show.groups.numbers | Group numbers | Automatic numbering of repeated groups | `groups.md` | show settings | planned |
| show.arrangements | Arrangements | Multiple orders of the same slides | `arrangements.md` | `src/types/Show.ts` layouts | planned |
| show.arrangements.create | Create arrangement | New arrangement, rename | `arrangements.md` | show view | planned |
| show.layers | Show layers | Background, slide, overlays, audio, slide timer | `arrangements.md`, `output.md` | `src/frontend/components/output/layers` | planned |
| show.tools.groups | Groups tool | Groups and global groups | `tools.md` | `ShowTools.svelte` | planned |
| show.tools.media | Media tool | Backgrounds, audio, microphones, actions in arrangements | `tools.md` | `ShowTools.svelte` | planned |
| show.tools.metadata | Metadata tool | Title, artist, CCLI; message; display rules | `tools.md` | `ShowTools.svelte` | planned |
| show.tools.notes | Show notes | Toggle notes; timeline recording | `tools.md` | `src/frontend/components/show/ShowNotes.svelte` | planned |
| show.actions | Show action button | Flag button runs a custom action for the show | `actions.md` | `src/frontend/components/output/ShowActions.svelte` | planned |

## Drawer

| ID | Feature | What it is | Docs | Code entry | Detail |
| --- | --- | --- | --- | --- | --- |
| drawer.shell | Drawer shell | Bottom drawer, resizable, nav/content/right panels | `drawer.md` | `src/frontend/components/drawer/Drawer.svelte` | planned |
| drawer.search | Drawer search | Search all tabs; Ctrl/Cmd+F; Enter adds result | `drawer.md` | `src/frontend/components/quicksearch` | planned |
| drawer.shortcuts | Drawer shortcuts | Ctrl/Cmd+D toggle; Ctrl/Cmd+arrows navigate | `drawer.md`, `shortcuts.md` | `src/frontend/values/keys.ts` | planned |
| drawer.tabs | Drawer tabs | Shows, Media, Audio, Overlays, Templates, Scripture, Calendar, Functions | `drawer.md` | `src/frontend/values/tabs.ts` | planned |
| media.folders | Media folders | Add folders; favourites; files listed | `media.md` | `src/frontend/components/drawer/media` | planned |
| media.play | Play media | Click to play; double click in drawer; drag to slide | `media.md` | `src/frontend/components/media` | planned |
| media.online | Online media | YouTube, Vimeo, Pixabay, Unsplash, Canva | `media.md` | `src/frontend/components/drawer/player` | planned |
| media.canva | Canva | Personal API key and OAuth callback on 5520 | `media.md` | `src/electron/contentProviders/canva` | planned |
| media.screens | Screens | Capture and show a screen or window | `media.md` | `src/electron/capture` | planned |
| media.cameras | Cameras | Camera previews and output | `media.md` | `src/server/cam` | planned |
| media.recording | Screen recording | Record a screen/window; files in Recordings | `media.md`, `data.md` | `src/electron/capture` | planned |
| media.background | Media as background | Drag onto a slide; muted and looping by default | `media.md` | show media layers | planned |
| media.controls | Video controls | Seek, mute, loop, speed | `media.md` | `src/frontend/components/output/VideoSlider.svelte` | planned |
| media.next-finished | Next on media finished | Slide action; fires even when looping | `media.md`, `actions.md` | slide actions | planned |
| media.markers | Time markers | Add markers in the media preview | `media.md` | media preview | planned |
| media.filters | Media filters | Filters, speed, foreground type; copy/paste style | `media.md` | `src/frontend/components/media` | planned |
| audio.play | Audio playback | Play files, multiple at once with Alt | `audio.md` | `src/frontend/audio` | planned |
| audio.effects | Audio effects | Clips under 30 s; concurrent; effects board | `audio.md` | `src/frontend/audio/effects` | planned |
| audio.metronome | Metronome | Settings, draggable play button onto slides | `audio.md`, `functions.md` | metronome | planned |
| audio.mic | Microphones | Incoming audio channels | `audio.md` | `src/frontend/audio` | planned |
| audio.stream | Audio streams | HTTP audio stream | `audio.md` | `src/frontend/audio` | planned |
| audio.nowplaying | NowPlaying files | `NowPlaying.txt` and cover art in Audio folder | `audio.md` | audio writer | planned |
| audio.routing | Audio routing | Output channels and devices | `data.md` | `src/frontend/audio/routing` | planned |
| overlay.create | Overlays | Slide-like content over the output | `overlays.md` | `src/frontend/components/drawer/pages/Overlays.svelte` | planned |
| overlay.display | Display overlay | Click to show; multiple at once | `overlays.md` | output layers | planned |
| overlay.edit | Edit overlay | Right click > Edit; refresh output after edits | `overlays.md` | edit view | planned |
| overlay.lock | Lock to output | Survives Clear all and restart; toggle per overlay | `overlays.md`, `output.md` | output layers | planned |
| overlay.drag | Overlay on a slide | Dragged overlays play with the slide | `overlays.md` | arrangement data | planned |
| template.create | Templates | Slide-like style applied to a show | `templates.md` | `src/frontend/components/drawer/pages/Templates.svelte` | planned |
| template.apply | Apply template | Click a show; drag to a single slide; remembered | `templates.md` | template application | planned |
| template.detach | Detach on edit | Editing items stops template updates; text only keeps it | `templates.md` | template application | planned |
| template.shift | Shift swap | Shift+click swaps text between items | `templates.md` | template application | planned |
| template.overwrites | Style overwrites | Plain text or `/regex/` styling on top of a template | `templates.md` | template styles | planned |
| template.first-slide | First-slide template | Custom template for the first slide | `templates.md` | template settings | planned |
| scripture.sources | Scripture sources | API.Bible and local XML (Zefania, OSIS, Beblia, OpenSong) | `scripture.md` | `src/frontend/components/drawer/bible` | planned |
| scripture.search | Scripture search | Reference search and full-text search | `scripture.md` | bible drawer | planned |
| scripture.select | Select verses | Ctrl/Cmd click, double click, Enter, arrow selection | `scripture.md` | bible drawer | planned |
| scripture.collections | Collections | Multiple translations side by side | `scripture.md` | bible drawer | planned |
| scripture.template | Scripture template | Dynamic values; `scripture_name`; numbered collections | `scripture.md` | template system | planned |
| scripture.show | Scripture to show | Max verses per slide; creates a normal show | `scripture.md` | bible drawer | planned |
| calendar.events | Calendar events | Create, edit, repeat, `.ics` import | `calendar.md` | `src/frontend/components/drawer/calendar` | planned |
| calendar.show | Events to show | Select events; include slides from a show; timers | `calendar.md` | calendar drawer | planned |
| calendar.schedule | Schedule actions | Run an action at a time; one-minute warning | `calendar.md` | calendar drawer | planned |
| functions.actions | Actions | Automate tasks; triggers | `actions.md`, `functions.md` | `src/frontend/components/drawer/pages/Actions.svelte` | planned |
| functions.timers | Timers | Count from/to, until event, overflow | `functions.md` | `src/frontend/components/drawer/timers` | planned |
| functions.variables | Variables | Text and number variables | `functions.md` | `src/frontend/components/drawer/pages/Variables.svelte` | planned |
| functions.interactions | Interactions | Slide interactions and answers | `functions.md` | `src/frontend/components/drawer/pages/interactions.ts` | planned |
| functions.obs | OBS | Control OBS over its WebSocket | `livestreaming.md`, `functions.md` | `src/frontend/components/drawer/pages/OBS.svelte` | planned |
| functions.scenes | Scenes | Scene previews and actions | `functions.md` | `src/frontend/components/drawer/pages/Scenes.svelte` | planned |
| actions.slide | Slide actions | Right click or drag; icon on the slide | `actions.md` | slide data | planned |
| actions.category | Category actions | Run when a show in the category is triggered | `actions.md` | category data | planned |
| actions.section | Section actions | Run when entering a section from the previous slide | `actions.md` | section data | planned |
| actions.show | Show actions | Flag button runs a custom action | `actions.md` | `ShowActions.svelte` | planned |
| actions.types | Action catalogue | Start show, timer, style, MIDI, clear, next timer, go to start, media finished | `actions.md` | `src/frontend/components/actions` | planned |
| actions.trigger | Triggers | Click, shortcut, scenario, slide activation, MIDI | `actions.md`, `midi.md` | actions system | planned |
| actions.emitters | Emitters | OSC/HTTP message templates | `actions.md` | actions system | planned |
| actions.override | Override category | Ctrl/Cmd drag or the Run action option | `actions.md` | actions system | planned |
| actions.ccli-toggle | CCLI logging action | Turn usage logging on/off/toggle | `advanced/ccli-reporting.md` | actions system | planned |

## Outputs

| ID | Feature | What it is | Docs | Code entry | Detail |
| --- | --- | --- | --- | --- | --- |
| out.window | Output window | One or more windows on screens or NDI | `output.md` | `src/frontend/components/output/Window.svelte` | planned |
| out.layers | Output layers | Background, slide, overlays, audio, slide timer | `output.md` | `src/frontend/components/output/layers` | planned |
| out.enable | Present / stop | Present button, Ctrl/Cmd+O, confirm twice to stop | `output.md`, `shortcuts.md` | output helpers | planned |
| out.preview | Output previews | Mirrors of each output; audio meter | `output.md` | `src/frontend/components/output/preview` | planned |
| out.controls | Output controls | Previous, next, start/update, lock, transition | `output.md` | `OutputHelper.ts` | planned |
| out.lock | Lock output | Global and per output; yellow status | `output.md`, `shortcuts.md` | output state | planned |
| out.status | Output statuses | Green, red, blue, grey, yellow | `output.md` | output state | planned |
| out.transitions | Transitions | Global, per output style, slide, textbox; in/out/between | `output.md` | `src/frontend/components/output/transitions` | planned |
| out.transitions.priority | Transition priority | Textbox > slide > output style > global | `output.md` | transition resolver | planned |
| out.settings | Output settings | Add outputs, styles, NDI, window options | `output.md` | `src/frontend/components/settings/tabs/Outputs.svelte` | planned |
| out.window.position | Window placement | Choose screen, manual X/Y, always on top, invisible (NDI) | `output.md` | `src/electron/output` | planned |
| out.multiple | Multiple outputs | Add any number; enable individually; colors | `outputs.md` | output settings | planned |
| out.multiple.select | Output selection | Ctrl/Cmd select one; right click show/hide | `outputs.md` | output previews | planned |
| out.multiple.specific | Specific outputs | Slide or textbox limited to chosen outputs | `outputs.md` | slide/item data | planned |
| out.styles | Output styles | Background, aspect ratio, lines, layers, template, metadata | `styles.md` | `src/frontend/components/settings/tabs/Styles.svelte` | planned |
| out.styles.aspect | Aspect ratio | 16/9 or fit the window; contain content | `styles.md` | style renderer | planned |
| out.styles.lines | Line limit | Max lines per textbox in an output | `styles.md` | style renderer | planned |
| out.styles.layers | Layer toggles | Hide background etc. per output | `styles.md` | style renderer | planned |
| out.styles.template | Style template | Override item style; color rules | `styles.md` | style renderer | planned |
| out.styles.metadata | Metadata style | Look and display rules for metadata/messages | `styles.md` | style renderer | planned |
| out.ndi | NDI | Per-output NDI, fps, transparent; not on Linux | `ndi.md` | `src/electron/ndi` | planned |
| out.livestream | OBS control | Connect to OBS WebSocket | `livestreaming.md` | `OBS.svelte` | planned |
| out.stage-window | Stage output window | Stage layouts as an HDMI/NDI output | `stage.md` | stage server | planned |
| out.recorder | Recorder | Mirror a screen/program and record | `features.md`, `media.md` | `src/frontend/components/main/Recorder.svelte` | planned |

## Remote and clients

| ID | Feature | What it is | Docs | Code entry | Detail |
| --- | --- | --- | --- | --- | --- |
| remote.connect | Connect | Settings > Connection; enable servers; IP/QR | `connecting.md` | `src/frontend/components/settings/tabs/Connection.svelte` | planned |
| remote.password | Remote password | Random by default; can be changed or removed | `remote.md` | server auth | planned |
| remote.mobile | Mobile remote | Tabs for touch; shows, scripture, project, show, output | `remote.md` | `src/server/remote` | planned |
| remote.show | Remote show view | Slides, arrangements, groups, edit | `remote.md` | `src/server/remote/components` | planned |
| remote.output | Remote output view | Current/next, lyrics mode, tap zones | `remote.md` | `src/server/remote` | planned |
| remote.tablet | Tablet mode | Mirrors the main app panels and drawer | `remote.md` | `src/server/remote` | planned |
| stage.layouts | Stage layouts | Create layouts; items; resize; disable a slide | `stage.md` | `src/server/stage` | planned |
| stage.items | Stage items | Current/next text, styled, current output mirror | `stage.md` | `src/server/stage/items` | planned |
| stage.url | Stage URL queries | `?name=` and `?id=` select a layout | `stage.md` | `src/server/stage` | planned |
| controller.client | Controller | Presentation controller with draw mode | `controller.md` | `src/server/controller` | planned |
| outputstream.client | Output stream | Records the output window and streams it | `outputstream.md` | `src/server/output_stream` | planned |
| companion.module | Bitfocus Companion | Control FreeShow from a Streamdeck; port 5505 | `companion.md` | socket server, API | planned |

## Cloud and transfer

| ID | Feature | What it is | Docs | Code entry | Detail |
| --- | --- | --- | --- | --- | --- |
| cloud.setup | ChurchApps setup | B1.Church ministry/team, connect | `cloud.md` | `src/electron/cloud` | planned |
| cloud.sync | Cloud sync | Sync data on open/close and autosave | `cloud.md` | `src/electron/cloud` | planned |
| cloud.merge | Merge on connect | Merge cloud and local data | `cloud.md` | cloud sync | planned |
| cloud.media | Media sync folder | Move used media into a sync folder; find missing | `cloud.md` | cloud sync, media finder | planned |
| cloud.readonly | Read-only | Receive data without writing back | `cloud.md` | cloud sync | planned |
| cloud.conflict | Conflict rule | Different elements merge; same show keeps the latest | `cloud.md` | cloud sync | planned |
| integration.bible | API.Bible | 200+ versions online | `integrations.md` | bible drawer | planned |
| integration.planningcenter | Planning Center | Sync services a week ahead | `integrations.md` | `src/electron/contentProviders/planningCenter` | planned |
| integration.churchapps | ChurchApps | Song database and service plans | `integrations.md` | `src/electron/contentProviders/churchApps` | planned |
| integration.pixabay | Pixabay | Image/video search | `integrations.md` | content providers | planned |
| integration.unsplash | Unsplash | Image search | `integrations.md` | content providers | planned |
| midi.actions | MIDI actions | Trigger actions on MIDI input | `midi.md` | `src/frontend/components/actions/midi.ts` | planned |
| midi.defaults | MIDI defaults | Channel 1 show, 3 clear, 4 style, 5 index | `midi.md` | `midi.ts` | planned |
| import.formats | Import formats | 18 programs and file types | `importing.md` | `src/frontend/converters` | planned |
| import.pdf | PDF import | Text or page images | `importing.md` | converters | planned |
| import.pptx | PowerPoint | Text only, or PDF for styling | `importing.md` | `src/frontend/converters/powerpoint` | planned |
| export.formats | Export formats | Project, show, TXT, PDF | `exporting.md` | `src/frontend/components/export` | planned |

## Advanced and tips

| ID | Feature | What it is | Docs | Code entry | Detail |
| --- | --- | --- | --- | --- | --- |
| data.paths | Data and show paths | Change folder locations | `data.md` | `src/electron/data` | planned |
| data.folders | Data subfolders | Backups, Bibles, Exports, Imports, Lessons, Recordings, Media, Planning Center, Audio | `data.md` | `src/electron/data` | planned |
| data.config-in-data | Settings in data path | Config folder option | `data.md` | settings save | planned |
| data.backup | Backup/restore everything | Export and restore JSON files | `faq.md` | `src/frontend/components/settings/tabs/Files.svelte` | planned |
| data.import-export-settings | Import/export settings | Move app data between computers | `faq.md` | same | planned |
| data.profiles | Profiles | Profile selector, admin profile, `-p=` argument | `faq.md` | `ProfileSelector.svelte` | planned |
| data.kiosk | Kiosk mode | macOS kiosk; `DISABLE_KIOSK_MODE` escape | `faq.md` | electron main | planned |
| data.log | Log file | Open log file from settings | `faq.md` | electron logging | planned |
| data.hwaccel | Hardware acceleration | Toggle; off by default | `faq.md` | config | planned |
| data.updates | Auto-update | Permissions needed on Windows | `faq.md` | electron updater | planned |
| smart.stt | Smart transcription | Local speech-to-text (Nemotron) | `smart.md` | `src/electron/ai/stt` | planned |
| smart.llm | Smart LLM | Online providers or Ollama | `smart.md` | `src/electron/ai/llm` | planned |
| smart.scripture | Smart scripture | Suggest or auto-present verses | `smart.md` | `src/electron/ai/scripture` | planned |
| ccli.logging | CCLI usage logging | Opt-in log of song usage | `advanced/ccli-reporting.md` | shows drawer action | planned |
| ccli.export | CCLI report | JSON export of usage since last export | `advanced/ccli-reporting.md` | export code | planned |
| tips.styling | Styling advice | Readability guidance | `styling.md` | — | doc only |
| tips.shortcuts | Keyboard shortcuts | The published shortcut table | `shortcuts.md` | `src/frontend/values/keys.ts` | planned |
| tips.faq | FAQ | Operational answers | `faq.md` | — | doc only |

## Formats

| ID | Feature | What it is | Docs | Code entry | Detail |
| --- | --- | --- | --- | --- | --- |
| fmt.show | .show | JSON show/arrangement/media format | `format-show.md` | `src/types/Show.ts` | planned |
| fmt.project | .project | JSON or zip project with media | `format-project.md` | `src/types/Projects.ts` | planned |
| fmt.bible | .fsb | JSON Bible format | `format-bible.md` | `src/types/Bible.ts` | planned |

## Internal (not in the published docs)

| ID | Feature | What it is | Docs | Code entry | Detail |
| --- | --- | --- | --- | --- | --- |
| sys.arch | Process architecture | Electron main, frontend, server bundles | — | `src/electron`, `src/frontend`, `src/server` | planned |
| sys.ipc | IPC channels | Main and renderer messages | — | `src/types/IPC` | planned |
| sys.servers | Servers and ports | Remote, stage, controller, output stream, API, auth | — | `src/server`, `src/electron` | planned |
| sys.settings | Settings model | Defaults, keys, where stored | — | `src/electron/data/defaults.ts` | planned |
| sys.persistence | Persistence | config, settings, projects, shows, cache, backups | — | `src/electron/data` | planned |
| sys.api | API actions | HTTP, REST, WebSocket, OSC | `source/docs/api.svelte` | `src/frontend/components/actions/api.ts` | planned |
| sys.action-data | Action metadata | Names, icons, required inputs | — | `actionData.ts` | planned |
| sys.stores | Frontend stores | Reactive app state | — | `src/frontend/stores.ts` | planned |
| sys.media | Media pipeline | Capture, thumbnails, streaming, NDI, OMT | — | `src/electron/capture`, `ndi`, `streaming` | planned |
| sys.i18n | Translations | Language files and lookup | — | i18n | planned |
| sys.security | Security model | Remote password, API auth key, profiles | — | server auth | planned |
| sys.build | Build and release | Vite, tsc, electron-builder, CI | — | `package.json`, `.github` | planned |
