# Contract — left project browser (DEV-013, milestone 7)

Status: **approved** by the user on 2026-11-09: projects on the left, the show
outline in the drawer's Shows tab.

Reference: FreeShow `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (1.6.8-beta.3).
Evidence: `parity/features/controller-layout.yaml` (`ui.projects.*`),
`parity/reports/reader/controller-layout-2026-11-09.md` §2.

## Why this milestone

The drawer closed the bottom of DEV-013. The left column still shows the open
project's outline, where FreeShow shows a project browser and keeps the show
library in the drawer. This milestone makes that swap. It cannot port the tree:
there is no project catalogue, no folders and no create/rename — only the open
project and the session's recent list. What can be honest is a browser over
those.

## Scope

In:

- the left column becomes **Projects**: the open project plus the recent list;
- a row that opens a project, marks the open one, flags a missing file, and can
  be forgotten;
- the project outline moves into the drawer's **Shows** tab, with sections;
- **Make portable** moves with it, to the project browser;
- layout width behaviour unchanged.

Out, with reasons:

| Not in this milestone | Reason |
| --- | --- |
| Folder tree | No project catalogue exists; the session has a flat recent list |
| New / rename / duplicate / delete / archive | No project store to write to |
| Project templates, cloud/OnStage/Planning Center sync | No provider model |
| Import or open-file dialog | No file picker in the build; projects arrive by CLI or the recent list |
| Drag and drop, right-click menus, press-and-hold rename | Need a store and selection model |
| Project search | Ten rows at most |
| Slide editor | Different phase (`docs/ui-parity.md`) |

## Behaviours

### P1 — the column

- The left column contains one panel headed **Projects**.
- Rows are: the open project first, then every other recent project, newest
  first. The open project appears once, never twice.
- The built-in demo project is not a row: it has no file. With only the demo
  open, the panel shows the recent list alone.
- At most `MAX_RECENT` (10) recent entries are kept by the session; the panel
  shows all of them.
- The column stays resizable and its width is persisted as it is today.

### P2 — a row

- Shows the project's name, its path in muted text, and on the open project a
  `current` badge.
- The open project's row has a 4 px accent left border, matching the reference's
  active-tab marking.
- When the project's file is absent or cannot be read, the row says `missing`
  and its open action is disabled. The check happens when the panel renders,
  not once at startup, so a file restored while the app runs becomes openable
  again.
- No other metadata: no dates, sizes or slide counts on the row.

### P3 — opening

- Clicking a row that is not the open project opens it: engine, media
  allowlist, outline, media list and session all follow the current
  `open_project` path. Nothing new is invented here.
- Clicking the open project's own row does nothing.
- A failed open shows the error inline under the list and leaves the list
  intact. The row is not removed. This covers what the render-time check cannot
  see: the file changed or its permissions did between render and click, or the
  project parses but its media cannot be served.

### P4 — forgetting

- Every row except the open project's has a **Forget** control.
- Forget removes that entry from the session and from the panel. It never
  touches the file on disk.
- Forgetting the last entry leaves the panel in its empty state.
- There is no confirmation dialog; the control is small and the action is
  reversible by opening the project again.

### P5 — empty state

- With no recent projects the panel says:
  `No recent projects. Open a .cjcp from the command line and it appears here.`
- With an open project but no others, the panel shows just the open project.

### P6 — the outline moves

- The drawer's **Shows** tab renders the project outline: sections as headings,
  shows as rows with the live marker and a Play button, and the same ordering
  as today's outline.
- The left column no longer renders the outline.
- Focus mode is unchanged: it still shows the full-window list in the centre.

### P7 — Make portable

- Moves to the project browser's foot and acts on the open project, with the
  same success and error text as today.
- With no open project saved to a file, the foot says so, as today.

### P8 — untouched

- No engine or output change. Opening a project still publishes through
  `SharedEngine`; the browser is a consumer.
- No change to render state, media serving or the remote.
- Opening a recent project must leave `docs/status.md`'s measured behaviours
  (recovery, transitions, media) intact — this is the same open path the Open
  button uses today.

## Acceptance criteria

1. `scripts/check.sh` exits 0, with `EVIDENCE.md`'s count updated.
2. Unit tests: recent rows exclude a duplicate of the open project; ordering is
   newest first; forgetting removes exactly one entry and never the open one;
   a missing file is flagged and a restored file stops being flagged.
3. A capture of the real window at 1280×800 with three recent projects, one of
   them missing, the open project marked, and the drawer's Shows tab with
   sections. Opened and looked at, not just produced.
4. A side-by-side against FreeShow's project column at the same size, with the
   differences named (no folders, no add button, no provider icons).
5. `EVIDENCE.md` and `parity/reports/ui-project-browser-2026-11-09.md` in the
   code commit.
6. At acceptance the orchestrator updates `docs/status.md`,
   `docs/ui-parity.md` and `docs/deviations.md`; DEV-013 stays open for folders
   and the editor, with its deviation text narrowed to what is actually left.

## Knowingly not matched

- **No folder tree, create, rename, delete, import or templates** — Scope.
- **No provider icons** — no icon set (DEV-014) and no provider model.
- **Forget instead of a context menu** — the simplest reversible control that
  fits a list of ten.
