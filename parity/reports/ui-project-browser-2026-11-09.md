# Controller project browser — implementation report (DEV-013, milestone 7)

Date: 2026-11-09
Contract: `docs/contracts/ui-project-browser.md` (approved 2026-11-09)
Scenarios: `parity/scenarios/controller-project-browser.yaml`
Reference: FreeShow `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (1.6.8-beta.3)

Status: **candidate ready for verification.** This report does not accept the
work; the verifier grades the exact commit.

## What was built

- **One Projects panel** in the left column. The open file-backed project is the
  first row, then every other recent project in session order (newest first),
  deduplicated by path. The session caps the list at `MAX_RECENT` (10), and the
  panel shows all of them. The built-in demo has no file and is not a row.
- **A row** carries the project name, its path in muted text, and on the open
  project a `current` badge and a 4 px accent-coloured left border (the
  reference's active-tab marking). A file that is absent, is not a regular file,
  or cannot be opened says `missing`, is drawn in the error colour, and its open
  action is disabled. Every row except the open project has a small **Forget**.
- **Opening** goes through the existing `AppState::open_project`: engine, media
  allowlist, outline, media list and session all follow it. The open row's click
  is ignored. A failed open renders the error below the list, keeps every row and
  leaves the open project unchanged.
- **Forgetting** goes through a new `AppState::forget_recent`, which removes the
  entry from the session, saves the session, and logs a save failure instead of
  panicking. It refuses the open project's path and never opens or removes the
  file. The model rule is a pure function so it is tested without a window.
- **Missing detection** is a pure `projects::is_missing(&Path) -> bool`, called
  while the panel renders. It checks metadata (regular file) and opens the file,
  so a restored file clears the flag without a restart.
- **The outline moved** to the drawer's **Shows** tab: the drawer now renders
  `outline::build` output — sections as `<h3>` headings and shows as rows with
  the live marker and Play, in project entry order. The per-open `shows` cache in
  `AppState` and the old `ShowRow`/`build_shows` were removed; there is one model.
- **Make portable** moved to the Projects panel's foot with the same path,
  button, status and error handling as before. With no file-backed project the
  foot says `Not saved to a file yet.` and has no control. The old standalone
  `OutlinePanel` remains only for `render --layout outline`; the controller no
  longer mounts it, and its duplicate Make portable foot was removed.
- **The controller re-renders from its existing 250 ms tick.** The tick signal
  existed to drive the revision readout but was never read, so the controller
  only refreshed on an interaction. Reading it makes the render-time file check
  (and the readout) honest without a click; it is a local VDOM diff at 4 Hz, not
  cross-window or per-frame traffic (invariant 6).
- **CSS** is embedded as before: one panel that fills the left column, a
  scrolling row list, the accent border, muted wrapped paths, the badges, the
  small Forget, and the foot pinned to the bottom. Focus mode, the other drawer
  tabs, the drawer geometry and the column resize/persistence code are untouched.

## What was measured

### Workspace gate

`scripts/check.sh` was run bare (not piped) in this session:

- **exit code 0**
- **184 tests** (baseline before this milestone: 177), matching `EVIDENCE.md`
- fmt, clippy with `-D warnings`, tests and the evidence count all pass

New unit tests (8; one drawer test was removed with `build_shows`):

- the open project is first and appears exactly once when its own session entry
  sits in the middle of the recents;
- other recent rows keep the session order (newest first);
- the open project alone is the only row (P5's second state);
- repeated recent paths are deduplicated;
- forgetting removes exactly one entry, refuses the open project's path, does
  nothing for an absent entry, and leaves both files on disk;
- a missing file is flagged, becomes unflagged when written, is flagged again
  when removed, and a directory counts as missing;
- the empty-state constant is the contract's exact sentence and an empty list
  builds no rows;
- the outline keeps project entry order with sections and shows even when the
  project's `shows` array is in the opposite order.

### Real-window captures

Method: `GDK_BACKEND=x11`, `CJCRSG_REMOTE=0`, a scratch `CJCRSG_DATA_DIR` with a
seeded session, and `scripts/capture_window.sh` by X window id. The app requests
a 1280×820 inner size; this desktop's native menu bar is 27 px inside the X11
client, so the window was resized to a 1280×827 client with `XResizeWindow`. The
page then reported **`innerHeight = 800`, `topBar = 56`** in the app's own
viewport debug line (`run-log-projects.txt`), and every image is cropped to that
1280×800 content box below the menu bar. No image contains the menu bar, and none
is a DOM mock-up or an SSR render.

The scratch project has the entry order `Section Opening`, `Welcome`, `Worship`,
`Section Sermon`, `Communion`; the session's three entries are `Browser Main`
(open), `Browser Second`, and `Browser Third` whose file is absent.

**`browser-projects-1280x800.png`, described from the image:**

- the left column is a `PROJECTS` panel at x=12..292, 280 px wide, with the
  drawer top at y=500;
- `Browser Main` is the first row, with a 4 px pink accent border on its left
  edge, the `current` badge at its right, and its full path (wrapped) below the
  name;
- `Browser Second` follows with its path and a `Forget` control; no badge;
- `Browser Third` follows in the error colour, with the red `missing` label and
  a `Forget` control; it has no open control that can fire;
- the foot is pinned to the panel bottom: the open project's path in small muted
  text and a `Make portable` button;
- the drawer's `1 Shows` tab is active and shows `OPENING`, `Welcome` (`LIVE`,
  `Play`), `Worship` (`Play`), `SERMON`, `Communion` (`Play`) — sections as
  headings, three show rows, three Play controls, project order preserved.

**`browser-shows-1280x800.png`, after Play on Worship:** the preview published
`worship-1`, `3 / 7`, `rev 1`; the Shows tab has `Worship` highlighted with the
`LIVE` marker and `Welcome`/`Communion` without it; the sections and row order are
unchanged. This is the same Play path the focus view and the old outline used.

**`browser-empty-1280x800.png`:** no rows; the panel says exactly
`No recent projects. Open a .cjcp from the command line and it appears here.`;
the foot says `Not saved to a file yet.` with no button; the demo project loads
(the top bar says `Experiment 1`, the drawer shows its `Sunday Service`), and it
is not a row.

**`browser-portable-1280x800.png`:** the foot shows `copied 0` beside Make
portable after the action ran on the scratch project (it has no external media).

**`browser-missing-before-1280x800.png` → `browser-missing-restored-1280x800.png`:**
`Browser Third` starts red with `missing`; writing its `.cjcp` while the app runs
clears the label and re-enables its open action within the next render, with no
click, tab switch or restart.

**`session-open-second.json`:** after opening `Browser Second` from the browser,
the session list is `[Browser Second, Browser Main, Browser Third]`, the top bar
says `Browser Second`, the preview is `second-1` `1 / 2`, and the Shows tab shows
`Second Show` live.

**`session-forget-second.json`:** after Forget on `Browser Second`, the session
list is `[Browser Main, Browser Third]` and `browser-second.cjcp` is still on
disk. No confirmation dialog appears.

**`session-missing-click-unchanged.json`:** activating the missing row's open
control left the session exactly as seeded; the disabled control does not fire.

**`session-open-failed.json`:** `Browser Broken` is a readable `.cjcp` with
`format_version: 2`. Opening it leaves the project as `Browser Main` and the row
list intact, and the error appears below the list:
`cannot open <path>: format version 2 is newer than this build supports (1)`.

`ssr-empty-state.html` is the headless `render --layout recent` output with an
empty session; it contains the same empty sentence and no-file foot.

### Side-by-side against FreeShow

`freeshow-projects-1280x800.png` is the raw reference, captured from the pinned
checkout running on X11 (`--ozone-platform=x11`) with its scratch store at the
same 1280×800 window. `browser-comparison-1280x800.png` places its left column
and the candidate's side by side.

Differences, named from the two images:

- **No folder header or tree.** FreeShow's column opens with a back button, the
  project title (`Parity Project`) and a "more" menu; ours opens with the
  `PROJECTS` heading and rows. There are no folders, groups or archive state —
  the session is a flat list (Scope).
- **No add/import controls.** FreeShow has a round **+** at the bottom right
  (and import in the drawer); ours has none, because no project store or file
  picker exists (Scope). Our foot instead carries **Make portable**, which
  FreeShow exposes through its project menu.
- **No project or provider icons.** FreeShow's row starts with a project icon
  (cloud when provider-linked); ours is text-only (DEV-014, no icon set).
- **Row content differs.** FreeShow's row is the project name only. Ours adds the
  path in muted text, a `current` badge, a `missing` label and a Forget control;
  the open project is marked with the same 4 px accent left border the reference
  uses for its active tab.
- **Recent-list rules differ.** FreeShow swaps its tree for a "Recently used"
  view only when at least two unarchived projects were used in five days; ours
  always shows the session's recent entries, because there is no project
  catalogue to return to.
- **Width.** FreeShow's left column defaults to 290 px; ours keeps its existing
  280 px default and 200–480 clamp (P1: width behaviour unchanged).
- **Drawer.** The reference's Shows drawer is a Name/Modified table with
  Import/New show; ours is the project outline with sections, live marker and
  Play (P6). The drawer was accepted separately; slide counts were removed from
  the Shows rows because P6 supersedes contract B7.

Palette, panel radius, type scale and the bottom drawer position match, as the
earlier shell and drawer comparisons established.

## Contract clause by clause

| Clause | State | Evidence |
| --- | --- | --- |
| P1 one Projects panel, open first, recents newest first, open once, all ten, demo not a row | implemented | unit tests; `browser-projects`, `browser-empty`; session files |
| P1 width resizable, persisted, clamp unchanged | unchanged code | existing session tests; no width code touched |
| P2 name, muted path, `current` badge, 4 px accent border, no other metadata | implemented | `browser-projects` image; row markup; unit tests |
| P2 `missing` on absent/unreadable, open disabled, checked at render | implemented | unit test; `browser-missing-before/restored`; disabled-click session file |
| P3 non-current row opens the existing path; current row no-op; inline error, list kept | implemented | `session-open-second`, `session-open-failed`; unit-adjacent open path is unchanged |
| P4 Forget on every non-open row, one entry, file untouched, no dialog, open project never removed | implemented | unit test; `session-forget-second`; `browser-second.cjcp` still present; capture has no dialog |
| P4/P5 last entry leaves the empty state; open alone shows just it | implemented | unit tests; `browser-empty`; P5 sentence render |
| P5 exact empty sentence; open-with-no-others shows the row | implemented | `NO_RECENTS` test; `ssr-empty-state.html`; `browser-empty` |
| P6 outline in the drawer's Shows tab with sections, live marker, Play, entry order; left column without it | implemented | `outline` unit test; `browser-projects`, `browser-shows`; no outline in the left column |
| P6 focus mode unchanged | unchanged code | `FocusView` untouched; the centre still renders it |
| P7 Make portable in the foot, same text and errors, no-file message | implemented | `browser-portable`, `browser-empty`; foot code uses the existing `bundle_media` |
| P8 consumer only, no engine/output/render-state change | implemented | only `apps/desktop` UI and model code changed; no `crates/*` diff |

## Interpretations and limitations

1. **The open project means a file-backed project.** The scenario notes call
   this out: the demo always exists and has no file, so counting it as "an open
   project" would make the empty sentence unreachable. The demo is not a row and
   does not suppress the empty state. The contract should state this.
2. **"Cannot be read" means the OS cannot open a regular file.** `is_missing`
   rejects an absent path, a non-regular file (e.g. a directory) and a file that
   cannot be opened. A present `.cjcp` that parses but is refused (a newer
   `format_version`) is *not* missing, which is what makes P3's failed-open path
   reachable.
3. **One row beyond ten is possible.** The panel shows the open project plus the
   session's recents after removing the open duplicate. The session caps recents
   at 10, so normal use yields at most 10 rows; a session that does not contain
   the open project (a write that failed) yields 11. The contract says the panel
   shows all ten, which it does; it does not forbid the open row being extra.
4. **The 250 ms tick is now subscribed.** Before this milestone the signal was
   written but never read, so no state outside Dioxus signals refreshed on its
   own. P2's "checked when the panel renders" and the scenario's
   `wait_for_render` need renders without an operator action, so the read is
   restored. It is a 4 Hz local VDOM diff; nothing is sent to another window.
5. **Evidence actions are DOM clicks, not synthetic X11 input.** Synthetic X11
   pointer events are not delivered to an XWayland WebView (the drawer session
   hit this). The debug-only `CJCRSG_DRAWER` hook was extended with
   `open:<name>`, `forget:<name>`, `play:<show>` and `portable`, which find the
   rendered row and click the same handler an operator uses. It is gated by
   `cfg!(debug_assertions)` and is not in the presentation path.
6. **No scenario was executed by a harness.** There is still no controller
   adapter, and the proposed scenario fixtures were not created by this stage
   (fixtures are protected). The captures use scratch `.cjcp` projects under
   `/tmp/opencode`; this report is manual observation against the scenarios'
   intents, not a `parity run` pass. The exact fixture names, computed-style and
   DOM-structure checks remain for the verifier and the harness.
7. **Drawer shows content changed shape.** Contract B7's slide count is gone
   from the Show rows, as P6 specifies and the scenario notes accept. The
   accepted drawer's other tabs, geometry, clock and keyboard are untouched.
8. **The FreeShow comparison uses its existing scratch profile**, which has one
   project row; the comparison is of the column surfaces, not identical project
   data. Its window is the raw 1280×800 capture from the reference.

## Evidence manifest

All paths relative to the repository root.

| Artefact | What it proves |
| --- | --- |
| `parity/reports/evidence/ui-project-browser/browser-projects-1280x800.png` | required capture: three recents, `Browser Main` current with badge and 4 px accent border, `Browser Third` missing, Forget on non-open rows, foot, drawer Shows with sections |
| `parity/reports/evidence/ui-project-browser/browser-shows-1280x800.png` | Shows tab after Play on Worship: live marker moved, entry order kept, preview published |
| `parity/reports/evidence/ui-project-browser/browser-empty-1280x800.png` | exact empty sentence, no rows, no-file foot, demo not a row |
| `parity/reports/evidence/ui-project-browser/browser-portable-1280x800.png` | Make portable in the foot with the existing `copied 0` status |
| `parity/reports/evidence/ui-project-browser/browser-missing-before-1280x800.png` | `Browser Third` flagged `missing` at launch |
| `parity/reports/evidence/ui-project-browser/browser-missing-restored-1280x800.png` | the flag clears after the file is created, without an interaction |
| `parity/reports/evidence/ui-project-browser/freeshow-projects-1280x800.png` | raw FreeShow 1.6.8 project column at the same window size |
| `parity/reports/evidence/ui-project-browser/browser-comparison-1280x800.png` | side-by-side column comparison |
| `parity/reports/evidence/ui-project-browser/session-open-second.json` | open from the browser refreshes the session order and follows the open path |
| `parity/reports/evidence/ui-project-browser/session-forget-second.json` | Forget removes exactly one entry; file untouched |
| `parity/reports/evidence/ui-project-browser/session-missing-click-unchanged.json` | the missing row's open action is a no-op |
| `parity/reports/evidence/ui-project-browser/session-open-failed.json` | failed open keeps the project and list; inline error path |
| `parity/reports/evidence/ui-project-browser/session-portable.json` | session after Make portable (open project recorded once) |
| `parity/reports/evidence/ui-project-browser/run-log-projects.txt` | `innerHeight = 800`, `topBar = 56` after the resize; project loaded |
| `parity/reports/evidence/ui-project-browser/ssr-empty-state.html` | headless panel render carrying the exact empty sentence |
