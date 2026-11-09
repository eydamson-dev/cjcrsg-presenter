# Screenshots of the reference

Captured from the pinned reference, not from the online docs.

- **Version:** FreeShow `1.6.8-beta.3`, commit `ff784eb`
- **Captured:** 2026-11-09
- **Profile:** `/tmp/opencode/fs-store` (the seeded profile from `docs/reference.md`),
  project "Parity Project", shows "Welcome" and "Parity Fixture"
- **Main window content area:** 1600×900 for the shell captures; the output window
  is 1920×1080; clients are 1280×800
- **Scripts:** `parity/tools/capture_freeshow_ui.mjs` and
  `parity/tools/capture_freeshow_clients.mjs`

Each image is a real capture of the running app under Playwright, not a mock. The
one exception is noted below.

## Main window

| File | What it shows | Supports |
| --- | --- | --- |
| `main-show-view.png` | Show view, drawer open on Shows, project list, live preview, controls | show.present, drawer.shell |
| `show-grid.png` | A show opened in grid view with its slide | show.views.grid |
| `show-edit.png` | Edit view: slide list, item selected, Textbox/Item tools | show.edit, show.edit.tabs, show.items |
| `stage-view.png` | Stage view with the current slide | stage.layouts |
| `new-show-dialog.png` | New show dialog: Quick lyrics, Web search, Empty show | show.create, show.quicklyrics |
| `output-window.png` | The output window, 1920×1080, showing the live slide | out.window, out.layers |
| `edit-add-items.png` | The Add items menu: Textbox, Media, Camera, Timer, Clock, Table, Chart, Icon, More | show.items |
| `show-chords-mode.png` | Chords mode in the Edit view | show.chords |
| `show-groups-panel.png` | The Groups panel in Show view | show.groups |
| `show-metadata-panel.png` | The Metadata panel in Show view | show.tools.metadata |
| `outputs-transitions.png` | The Transition popup: types, duration and easing | out.transitions |
| `quick-search.png` | Quick search over the main window | drawer.search |
| `next-at-end-selected.png` | After one Space at the end of a show: header shows the next show, output still shows the old one | nav.bounds.next-at-end |
| `next-at-end-played.png` | After the second Space: the next show is now in the output | nav.bounds.next-at-end |

## Drawer tabs

| File | Tab | Supports |
| --- | --- | --- |
| `drawer-shows.png` | Shows | drawer.tabs, show.categories |
| `drawer-media.png` | Media | media.folders, media.play |
| `drawer-audio.png` | Audio | audio.play |
| `drawer-overlays.png` | Overlays | overlay.create |
| `drawer-templates.png` | Templates | template.create |
| `drawer-scripture.png` | Scripture | scripture.sources |
| `drawer-calendar.png` | Calendar | calendar.events |
| `drawer-functions.png` | Functions | functions.actions, functions.timers, functions.variables |

## Settings

| File | Tab | Supports |
| --- | --- | --- |
| `settings-general.png` | General | sys.settings |
| `settings-outputs.png` | Outputs | out.settings, out.window.position |
| `settings-styles.png` | Styles | out.styles |
| `settings-connection.png` | Connection | remote.connect |
| `settings-files.png` | Files | data.paths |

## Clients

| File | Client | Port | Supports |
| --- | --- | --- | --- |
| `client-remote.png` | Remote (tablet layout) | 5510 | remote.mobile, remote.show |
| `client-stage.png` | Stage, current slide | 5511 | stage.items |
| `client-controller.png` | Controller | 5512 | controller.client |

## Not captured

- **Output stream (5513).** The client loaded and created a 1280×720 canvas, but
  the canvas stayed black in this environment. No useful image was produced, so
  there is no file. A capture on a machine with a real display may work.
- **NDI, OBS, audio routing, Smart.** They need external hardware or services.
- **Context menus and popups.** Only the New show dialog is captured; other
  popups were not opened.

## Adding a capture

1. Run the relevant script from `parity/tools`.
2. Open the PNG and check it shows the feature, not an empty state.
3. Add a row here and point the feature page at it with
   `![caption](../screenshots/<file>.png)`.
