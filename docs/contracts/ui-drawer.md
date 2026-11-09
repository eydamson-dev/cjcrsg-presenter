# Contract — controller drawer (DEV-013, milestone 1)

Status: **approved** by the user on 2026-11-09 (stage-2 gate). Eight tabs, with
honest empty states for the five whose libraries do not exist.
Scenarios: `parity/scenarios/controller-drawer.yaml` (manual until a controller
adapter exists).

Reference: FreeShow `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (1.6.8-beta.3).
Evidence: `parity/features/controller-layout.yaml`,
`parity/reports/reader/controller-layout-2026-11-09.md`.

## Why this milestone

DEV-013 is the last shell difference: the controller has FreeShow's frame but
not its information architecture. The drawer is the first piece with a working
feature behind it — the project's media already exists in the centre column and
is the reason a drawer is needed at all. The left project browser and the slide
editor are separate milestones; this contract does not touch them.

## Scope

In:

- a bottom drawer spanning the window, below the three columns;
- the tab strip, its order and its labels;
- collapse, expand, drag-to-resize, and remembered height;
- content for **Shows**, **Media** and **Audio**;
- an explicit empty state for **Overlays**, **Templates**, **Scripture**,
  **Calendar** and **Functions**;
- a clock and date in the drawer's right-hand column;
- Ctrl+1..8 tab selection.

Out, with reasons:

| Not in this milestone | Reason |
| --- | --- |
| Slide editor / editable centre | Different phase; `docs/ui-parity.md` |
| Left project browser | Next contract |
| Drawer search (Ctrl+F) | No per-tab search over three lists yet |
| Per-tab left sub-column (FreeShow's 290 px categories) | Only one list per tab exists; a second column would be empty |
| Per-tab right info panels (shows/media/audio info) | Not built; the clock occupies that column instead |
| Profile access rules, tab enable/disable menu | This build has no profiles |
| Ctrl+D / Ctrl+T panel toggles | No selection or panel model to toggle |
| FreeShow's icon set | Open question in `docs/ui-parity.md`; text labels only (DEV-014) |
| Timers as a tab | Timers are a Functions sub-tab in the reference, and are absent here |

## Behaviours

### B1 — geometry

- Collapsed height is **40 px** (the strip).
- Default open height is **300 px**.
- Maximum is the space left below the top bar: `innerHeight − top-bar height`.
  FreeShow's figure is `innerHeight − 40` because its top bar is 40 px; ours is
  56 px (44 px bar plus 6 px padding), so the same rule gives 744 px at an
  800 px window. Using FreeShow's literal 40 here would clip the bottom of a
  maximum-height drawer behind the controller's own chrome.
- The content area is `height − 40`; it scrolls and never overflows the drawer.
- The whole 40 px strip is the drag surface except its buttons; a 4 px
  accent-tinted bar at the top edge shows where to grab.

### B2 — tab strip

- Eight tabs, in this order, with these labels, left to right:
  `1 Shows`, `2 Media`, `3 Audio`, `4 Overlays`, `5 Templates`, `6 Scripture`,
  `7 Calendar`, `8 Functions`.
- The active tab is drawn with a 2 px accent underline and a lighter
  background than the inactive tabs.
- The strip scrolls horizontally and never wraps. Labels stay visible at every
  width (see DEV-014: no icon set, so the reference's 750 px icon-only rule
  does not apply).
- The default active tab is **Shows**.

### B3 — selection and opening

- Clicking a tab when the drawer is open selects it and changes the content.
- Clicking a tab when the drawer is collapsed opens it to the remembered open
  height, then selects it.
- Clicking the active tab when the drawer is open changes nothing. The
  reference's own source disagrees with itself here (reader report §5.1); a
  behaviour we cannot state confidently is not required.
- Clicking empty strip background toggles collapsed/open.
- Double-clicking a tab collapses the drawer.

### B4 — drag to resize

- Dragging the strip up grows the drawer, down shrinks it, clamped to
  `[40, B1's maximum]`.
- Releasing below **80 px** collapses to 40.
- Releasing at or above 80 px keeps the height and records it as the remembered
  open height.
- The height is persisted after release, not during the drag.

### B5 — remembered height

- The remembered open height survives a restart (session file).
- Collapsing records the current height as the remembered height; the collapsed
  height itself is not used as the remembered height.
- A remembered height **below 300 px reopens at 300 px**. The reference does
  this (`Drawer.svelte:95`); it means a drawer dragged small does not reopen
  cramped on the next click.
- A hand-edited session value is clamped before use: `40..=1200`, then again to
  B1's maximum when rendered.

### B6 — keyboard

- **Ctrl+1..8** selects the tab at that position and opens the drawer to at
  least 300 px.
- The shortcut is ignored while the event target is an `input`, `textarea` or
  `select`, so typing a stage message cannot change tabs.
- No other drawer shortcut is added in this milestone.

### B7 — content: Shows

- One row per show in the project, in project order.
- A row shows the show's name and its slide count.
- The live show is marked.
- A Play button on a row makes that show live (the same command the outline
  uses).

### B8 — content: Media

- Every non-audio asset in `project.media`, in project order.
- A row shows the file name, kind, origin, human-readable size, tags, and
  `missing` when the file cannot be resolved.
- This is the existing `MediaPanel`, moved. It remains read-only.

### B9 — content: Audio

- Every audio asset, same fields as Media.
- When the project has no audio, the tab says so.

### B10 — content: the other five tabs

Each renders the tab's name and one sentence stating why it is empty, not
silently blank and not a disabled control:

- Overlays — no overlay library in this build;
- Templates — no template library in this build;
- Scripture — no Bible translation loaded;
- Calendar — no calendar source connected;
- Functions — no action library in this build.

### B11 — clock

- The drawer's right-hand column is **290 px** and holds a clock.
- Time is `HH:mm:ss`, 24-hour, accent-coloured, centred.
- Below it, the date in long form with the weekday.
- Both update from the page's own clock; the time at least once a second.
- The column is present on every tab, because no tab has an info panel yet.

### B12 — untouched

- No engine change. The controller still reads `RenderState` through
  `SharedEngine`; the drawer is a consumer.
- No output-window change, and no change to any published render state.
- Moving the media list out of the centre column does not remove it from
  anywhere else: there is only one copy.

## Acceptance criteria

1. `scripts/check.sh` exits 0, with the test count in `EVIDENCE.md` updated.
2. Unit tests cover: tab order and Ctrl mapping; media split into
   non-audio/audio; height clamping; session round-trip of the remembered
   height; the empty-state text per tab.
3. A capture of the real window with the drawer open on Media, and one
   collapsed, at 1280×800, via `GDK_BACKEND=x11` and
   `scripts/capture_window.sh`; both opened and looked at, not just produced.
4. A side-by-side against FreeShow's drawer at the same window size, in the
   report, with the differences named.
5. `EVIDENCE.md` and `parity/reports/ui-drawer-2026-11-09.md` in the same
   commit as the code.
6. At acceptance, the orchestrator updates `docs/status.md`,
   `docs/ui-parity.md` and `docs/deviations.md`: DEV-013's milestone list gains
   this item, DEV-014 records the text-only tabs.

## Knowingly not matched

- **Text-only tabs** — DEV-014.
- **No 750 px label hiding** — follows from DEV-014.
- **Click on the active tab does not collapse** — the reference is ambiguous.
- **No drawer search, sub-columns, info panels, profiles or Ctrl+D/Ctrl+T** —
  listed in Scope.

## Acceptance

Accepted by the orchestrator on 2026-11-09.

- Candidate: `b969f826a72f4d55c043398192598a60b7ad2c4a` (`dev-013-drawer`,
  fast-forwarded to `main`), `scripts/check.sh` exit 0, 177 tests.
- Verifier: pass, no contract defects. First pass failed on the grab-bar hit
  target, evidence crops and three small defects; the second pass re-tested each
  fix and the whole contract.
  Reports: `parity/reports/verifier/ui-drawer-2026-11-09.md` and
  `parity/reports/verifier/ui-drawer-2026-11-09-2.md`.
- Evidence index: `EVIDENCE.md` § Controller drawer.
- Recorded gaps at acceptance: no controller adapter, so the 20 scenarios are
  manual; the scenario fixtures do not exist yet; the 1400 px clamp capture is
  blocked by this display's window-manager cap (1302 px WebView) and is
  reported as unconfirmed rather than passed.
