# Reader report - controller layout (DEV-013)

Date: 2026-11-09
Reference: FreeShow `ff784eb388c7baef60d67e6d4e7c504f4322bca3`
(`package.json` version `1.6.8-beta.3`), detached HEAD verified by reading
`~/projects/reference/freeshow/.git/HEAD`. Read-only; nothing in the reference
was modified.

Scope: the drawer tab strip, the drawer's right-hand info panel and clock, the
left project browser (brief), the top bar (brief). No FreeShow instance was
launched in this pass: every statement below comes from the pinned source, with
file:line in `parity/features/controller-layout.yaml`. Nothing here is a
measured screenshot.

Labels used exactly as the workflow requires: `observed` (stated literally at
the cited line), `inferred` (composed from several places or from runtime
ordering that was not executed), `unknown` (not established). Entry count:
16 drawer, 4 project, 2 top bar; 19 `observed`, 3 `inferred`, 0 `unknown`.

## 1. Drawer structure

The drawer is the bottom strip of the controller. It is the last child of a
full-height flex column (`MainLayout.svelte:118-120`, `:141-149`), so it spans
the window below the three columns, and the columns above shrink as it grows.
It is only mounted on the Show and Edit pages.

Inside, three columns (`Drawer.svelte:319-329`):

| Column | Component | Default width |
| --- | --- | --- |
| left | `Navigation` - per-tab sub-categories | 290 px (`leftPanelDrawer`) |
| centre | `Content` - the per-tab list | flexible |
| right | `Info` - the info panel / clock | 290 px (`rightPanelDrawer`) |

Both drawer panels are resizable; they snap back to 290 within +/-20 px, snap to
200.1 px below that, and collapse to a 4 px handle below 100
(`Resizeable.svelte:18-22`, `:69-74`; `stores.ts:356`).

### 1.1 Tab set and order

`drawerTabs` is an object literal; the strip iterates `keysToID(drawerTabs)`,
which preserves insertion order (`tabs.ts:5-16`, `array.ts:137-140`).

| # | id | Label (en) | Icon | Ctrl |
| --- | --- | --- | --- | --- |
| 1 | shows | Shows | `shows` | Ctrl+1 |
| 2 | media | Media | `media` | Ctrl+2 |
| 3 | audio | Audio | `audio` | Ctrl+3 |
| 4 | overlays | Overlays | `overlays` | Ctrl+4 |
| 5 | templates | Templates | `templates` | Ctrl+5 |
| 6 | scripture | Scripture | `scripture` | Ctrl+6 |
| 7 | calendar | Calendar | `calendar` | Ctrl+7 |
| 8 | functions | Functions | `functions` | Ctrl+8 |

`DrawerTabIds` also contains `timers`, but there is no Timers tab; Timers is a
Functions sub-tab (`types/Tabs.ts:62`, `Content.svelte:71-72`).

Hidden tabs: a tab is rendered only when `drawerTabsData[id].enabled !== false`
AND the profile's `access[id].global !== "none"` AND (not in focus mode, or not
templates/calendar) - `Drawer.svelte:275`, `:252`, `profile.ts:5-7`. Nothing is
hidden on a fresh install (`drawerTabsData` starts `{}`, `stores.ts:343`) -
inferred. The "Enabled tabs" context submenu cannot hide Shows or Media: it
slices the first two entries off the list (`loadItems.ts:21-30`). Hiding a tab
does not renumber the others.

### 1.2 Heights and the drag handle

| Quantity | Value | Evidence |
| --- | --- | --- |
| collapsed height | 40 px (= strip height) | `Drawer.svelte:28` |
| default open height | 300 px | `common.ts:15`, `stores.ts:345` |
| maximum height | `innerHeight - 40`; on Windows `innerHeight - 64.7` | `Drawer.svelte:30`, `:40` |
| drag threshold | below 80 px collapses to 40 | `Drawer.svelte:73-78` |
| content area | `height - 40` | `Drawer.svelte:416-420` |
| restored height | `stored` if >= 300, else 300 | `Drawer.svelte:95` |

The visible drag handle is a 4 px bar: `.top::after`, `top: 0`, `height: 4px`,
`background: var(--primary-lighter)`, `cursor: ns-resize`
(`Drawer.svelte:355-363`). It is decoration. The `mousedown` listener is on the
whole 40 px strip and only skips targets inside `.search`, so dragging anywhere
on the strip resizes (`:35-46`). Height is
`innerHeight - clientY - offsetY` with the offset captured at mousedown, clamped
to `[40, maxHeight]` (`:52-78`). The first move of a drag clears the current
selection (`:55`).

### 1.3 Collapse and expand

Paths in the source:

- click the empty part of the strip toggles (`Drawer.svelte:81-106`);
- double-click any tab calls `closeDrawer()` (`:277`);
- Ctrl+D toggles when nothing is selected and no edit item is open (`:184-185`);
- Ctrl+T (`togglePanels`) closes the drawer and both side panels, or restores
  them (`common.ts:190-209`, `shortcuts.ts:57`);
- dragging below 80 px collapses (`:73-78`);
- opening the Edit page collapses the drawer with `autoclosed: true` and
  `stored` = previous height (`Editor.svelte:53-58`); returning to Show reopens
  it after 100 ms (`Drawer.svelte:48-49`).

Remembered state: `drawer.stored` holds the pre-collapse height; a pointer or
keyboard collapse writes it, a drag-collapse sets it to `null`. `drawer` and
`resized` are serialised into the saved settings (`save.ts:173-174`, `:187`) and
applied on load (`updateSettings.ts:376-377`, `:390`), so the height survives a
restart - inferred for the restore path, the write is observed.

**The one conflict to resolve at runtime.** `Drawer.svelte:89` intends a click on
the *active* tab to close the drawer. The guard at `:82` returns first for any
click whose target is inside a button, and every tab is a button
(`MaterialButton.svelte:107` does not stop propagation, but the guard does not
care). So in the code as written, clicking a tab can open a collapsed drawer but
cannot close an open one; only the strip background closes it. The comment and
the guard disagree. Recorded as `inferred`, medium, and it is the first thing a
runtime pass should confirm.

### 1.4 Keyboard

- Ctrl+1..8 - drawer tabs, fixed index order. Gated on
  `document.activeElement === document.body`, skips tabs the profile denies, and
  opens the drawer to `stored || 300` when height < 300
  (`shortcuts.ts:179-189`). The tooltip prints `[Ctrl+{i+1}]` using the tab's
  position in the unfiltered list (`Drawer.svelte:277`), so hiding a tab does not
  renumber its shortcut. The shortcut does not check `enabled`, so a
  hidden-but-permitted tab is still reachable by number - inferred.
- Ctrl+F - focus the drawer search (`Drawer.svelte:164-183`, bound on
  `<svelte:window>` at `:255`). Suppressed when a "show" popup is open or the
  editor's replace dialog should open. If the drawer is closed on media/audio it
  first switches to Shows with sub-tab "all".
- Ctrl+G / F8 - global quick search, a different feature
  (`QuickSearch.svelte:106-113`).
- Plain 1..5 - page switches (Show/Edit/Stage/Draw/Settings) when the "number
  keys" setting is off (`shortcuts.ts:256-265`, `TopButton.svelte:15`) - easy to
  confuse with Ctrl+1..8.

### 1.5 Strip at narrow widths

`.top .tabs` is `display: flex; overflow-x: auto; overflow-y: hidden`, so the row
scrolls horizontally and never wraps. At `@media (max-width: 750px)` the label
span inside each tab is `display: none`, leaving icon-only tabs
(`Drawer.svelte:365-369`, `:437-441`). Labels also hide when the "disable
labels" setting is on (default false, `stores.ts:368`, `General.svelte:44`) or in
focus mode. The search box is pinned at the far end, fixed at 290 px
(`var(--navigation-width)`, `global.css:56`).

### 1.6 Info panel per tab

| Tab | Panel | Options button |
| --- | --- | --- |
| Shows | ShowInfo | yes |
| Media | MediaInfo | yes |
| Audio | AudioInfo | no |
| Overlays | none -> clock + date | no |
| Templates | TemplateInfo | yes |
| Scripture | ScriptureInfo | yes |
| Calendar | CalendarInfo | yes |
| Functions | FunctionsInfo | no |

`Info.svelte:19-46`, `:48-54`. Overlays is the only tab with no info component at
all, so it always shows the clock. The panels that do have one render the clock
themselves when their content is absent: ShowInfo when no show (or a non-show
item) is active (`ShowInfo.svelte:137-142`), MediaInfo when no media, recording
or online view applies (`MediaInfo.svelte:102-107`), and TemplateInfo whenever
its options view is closed (`TemplateInfo.svelte:30-35`). The accurate rule is
"the clock is visible whenever the right column has nothing else to say", not
"only for tabs without an info panel".
Right-clicking the info column offers "Toggle clock"
(`contextMenus.ts:264`, `menuClick.ts:866-868`), which forces the clock on every
tab.

### 1.7 Clock format

`<Clock seconds />` + `<Date />` (`Info.svelte:41-46`).

- Digital, `HH:mm:ss` by default because `timeFormat` defaults to `"24"`
  (`stores.ts:365`, `Clock.svelte:45`).
- With `timeFormat: "12"`: `h:mm:ss A`, AM/PM in small accent text
  (`Clock.svelte:44-45`, `:105-108`).
- Seconds are shown; the hours/minutes are zero-padded (`Clock.svelte:105-107`).
- Time updates every 250 ms; the date every 10 s (`Clock.svelte:24`,
  `Date.svelte:8-11`).
- Date is the long form from `dateToString`: `toLocaleDateString` with weekday
  long, day numeric, month long, year numeric, first letter capitalised
  (`time.ts:98-101`).
- 4 em, accent-coloured, centred (`Clock.svelte:128-135`).

## 2. Left project column (brief, for a later milestone)

Shown only on the Show page, default 290 px
(`MainLayout.svelte:40-56`). One tree of folders and projects
(`Projects.svelte:40-91`). Rendering: each root folder is a rounded section, its
children indent 8 px per level, root-level projects collect under an "Unlabeled"
heading, archived projects sit behind a "Show archived (n)" row
(`ProjectList.svelte:64-86`, `:145-212`). A row is an icon plus the name: cloud
icon when provider-linked, `project` otherwise, folder/folderOpen for folders
with a child count (`ProjectList.svelte:162-181`). The active project is
`$activeProject === id`, drawn as a 4 px accent left border
(`MaterialButton.svelte:166-169`). Click opens the project and its first item,
Alt-click opens without an item, Ctrl-click is ignored
(`ProjectList.svelte:103-108`, `project.ts:10-22`). Rename is press-and-hold
700 ms on the name, or the context menu / F2 (`HiddenInput.svelte:35-50`).
Actions: header "more" dropdown (export, data link, timeline, collapse/lock
sections, save to file, OnStage/PCO sync), a "+" button with New project / New
folder / Project template / Import / Planning Center, double-click "+" to create
a project, and context menus (project: rename, duplicate, delete, copy to
template, archive; folder: remove; read-only: empty). Recent projects: when two
or more unarchived projects were used in the last five days, they replace the
tree, newest first, under "Recently used" (`Projects.svelte:136-145`,
`project.ts:66-75`).

## 3. Top bar (brief)

40 px, three spans: a 290 px brand span, Show/Edit/Stage view buttons in the
centre, Draw + Settings + the output-display toggle (Ctrl+O, second click within
1.8 s to stop) on the right; cloud user avatars overlay the top-left; the whole
bar is hidden in focus mode (`Top.svelte:95-159`, `:161-174`,
`MainLayout.svelte:36-38`). **There is no clock or time display in the top bar.**
`Top.svelte` imports only Button, TopButton, Icon and T. A clock in our top bar
would not match the reference.

## 4. Numbers a contract can use

- Collapsed 40; default 300; max `innerHeight - 40` (Linux/macOS) /
  `innerHeight - 64.7` (Windows); drag threshold 80.
- Strip height 40; handle 4; content `height - 40`.
- Drawer side columns 290 default, snap +/-20, 200.1 below that, 4 px handle
  below 100.
- Labels hidden below 750 px.
- Tab order and Ctrl mapping: see 1.1.
- `activeDrawerTab` default `shows`; `drawer` default `{ height: 300,
  stored: null }`.

## 5. Not confirmed, and what would confirm it

1. **Click on the open tab does not collapse it.** Code intent and the guard
   disagree (`Drawer.svelte:82` vs `:89`). Needs one runtime click on an
   expanded active tab. This blocks a collapse-gesture contract.
2. **Windows maximum height.** `MENU_BAR_HEIGHT - 0.3` = 24.7 px is subtracted
   from `innerHeight`; whether that lands on a whole pixel and whether the
   Electron title bar is inside `innerHeight` was not measured. Blocks an exact
   height assertion on Windows only.
3. **`stored` across a restart.** The drawer object is saved, but whether a
   non-null `stored` is captured before the save happens was not traced. Blocks a
   "remembers height across restarts" contract; test by collapsing, quitting,
   relaunching.
4. **Hidden tab reachable by Ctrl+N.** Read from code (no `enabled` check at
   `shortcuts.ts:181-188`), not run. Blocks a statement about hidden tabs being
   unreachable.
5. **Rendered look** - scrollbar visibility on the strip, the exact active-tab
   border colour, the clock's point size relative to the drawer - was not
   captured. Visual thresholds need a capture, not this report.

## 6. Recommended coverage for contracts/scenarios

- Collapse/expand: click strip background, double-click tab, Ctrl+D, Ctrl+T,
  drag past 80 px, and click a tab while collapsed. Assert `drawer.height` and
  `stored` after each, not only the visible result.
- Height restore: collapse at 500 -> reopen -> 500; drag-collapse -> reopen ->
  300; restart -> same height.
- Ctrl+1..8: five representative tabs including one hidden by
  `drawerTabsData.enabled = false`, and one denied by profile access; assert the
  active tab and the drawer height.
- Ctrl+F: from collapsed on media, from expanded on shows, while a popup is
  open, while typing in a text field.
- Clock: 24 h and 12 h, seconds present, date long form; the Overlays tab; and
  right-click "Toggle clock" forcing it on Shows.
- Project column: active marker, folder depth indent, archived reveal, recent
  list threshold (0, 1, 2 projects within five days).
- Top bar: no clock; Ctrl+O second-click confirm window of 1.8 s.

## 7. Note on `area`

The entries use `area: controller`, which is not in the §3.1 enum
(navigation | outputs | rendering | media | remote | stage | editing | import).
The enum should gain it; the alternative - filing controller-shell behaviour
under "editing" - would be wrong.
