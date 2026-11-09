# Contract — next at the end of a show (DEV-015)

Status: **approved** by the user on 2026-11-09 (option 1: model the two-step move
and expose the setting on the controller).
Feature: `nav.bounds.next-at-end`.
Reference: FreeShow `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (1.6.8-beta.3).
Evidence: `parity/reports/reader/next-at-end-2026-11-09.md`,
`docs/freeshow-reference/show/presenting.md` (observed 2026-11-09).

## Why this milestone

Our engine advances to the next show in one press at a show boundary. FreeShow
does not: the first press selects the next project item, the second outputs it,
and the whole move can be disabled. The difference is felt by an operator at every
show boundary, so it is a parity defect, not a detail. DEV-015 records it.

## Scope

In:

- a **selected project item** distinct from the **outputted slide**;
- `next` at the last slide of a show: select, then play on the following press;
- the setting `next_item_on_last_slide`, default on;
- persistence of the setting across restarts;
- a controller control for the setting;
- the controller showing which show is selected and which is live;
- unit tests for on, off, project end, and normal in-show advance.

Out, with reasons:

| Not in this milestone | Reason |
| --- | --- |
| Previous at the first slide | Symmetric but separate; not observed in this run |
| Sections as selectable project items | Our model has sections but does not present them; DEV-009 |
| FreeShow's full settings surface | Only this setting is in scope |
| Changing `next_section` / `next_group` semantics | They keep working as they do; only the selected show is updated |
| A differential harness for selection | The controller adapter does not expose selection yet; unit tests plus the reference report are the acceptance evidence |

## Behaviours

### B1 — two state positions

- `outputted` is the slide the audience sees. It is the engine's `index` today.
- `selected` is the project show the operator has moved to. It is a new
  `selected_show: usize`.
- On construction and on `replace_project`, both point at the first show that has
  a slide.
- `go_to`, `go_to_show`, `go_to_index`, `first_slide`, `last_slide`,
  `next_section` and `next_group` set `selected` to the show of the slide they
  land on.
- A selection change increments the revision but does **not** change the outputted
  slide and does **not** start a transition.

### B2 — next inside a show

- If the current show has a later slide, `next` advances within it exactly as now.
- `selected` follows to the same show.

### B3 — next at the end of a show, setting on

Let `current` be the show of the outputted slide and `next_show` the next show
after `current` that has at least one slide.

| State before | Press | After |
| --- | --- | --- |
| `selected == current` | 1 | `selected = next_show`; output unchanged |
| `selected == next_show` | 2 | output = first slide of `next_show`; `selected == current` |
| no `next_show` | any | no change |

- The first press returns `true` (the state changed) and bumps the revision.
- The second press changes the outputted slide and publishes a slide transition
  like any other advance.
- `next_show` skips shows without slides. It does not wrap.

### B4 — next at the end of a show, setting off

- `next` does nothing: no selection change, no output change, returns `false`.
- This also applies at the end of the project, where it was already a no-op.

### B5 — setting

- Name: `next_item_on_last_slide`.
- Default: `true`, matching FreeShow.
- Persisted in the session file, so it survives a restart.
- Changing it does not change the current output or selection.
- The engine exposes `next_item_on_last_slide()` and
  `set_next_item_on_last_slide(bool) -> bool`.

### B6 — controller control

- A control in the controller's top bar, in the actions area next to **Focus**.
- Label is a state, not a question: **At end: advance** when on, **At end: stop**
  when off. Clicking toggles it.
- The control reflects the persisted value after a restart.
- Changing it updates the engine immediately and saves the session.
- It has a `title`/`aria-label` that says "Advance to the next show at the end of a
  show" and its current state.

### B7 — controller selection display

- The project outline marks the **live** show as today (`outline-show current`,
  badge `live`).
- It also marks the **selected** show distinctly (`outline-show selected`, badge
  `selected`). If selected and live are the same show, show the live marker only.
- This is what makes the first press visible: the selected row moves while the
  preview and the live badge stay on the old show.

## Engine API

```rust
pub fn selected_show(&self) -> Option<usize>;
pub fn next_item_on_last_slide(&self) -> bool;
pub fn set_next_item_on_last_slide(&mut self, enabled: bool) -> bool;
```

- `selected_show` returns the project index of the selected show, or `None` for an
  empty project.
- `set_next_item_on_last_slide` returns whether the value changed. It does not
  bump the revision; the controller re-renders from its own state.

## Data and persistence

- `Session` gains `next_item_on_last_slide: bool` with a serde default of `true`,
  so an old session file loads as on.
- The desktop app applies the session value to the engine in `AppState::new`,
  before the first render.
- The controller writes the session when the control changes, using the same
  `SessionStore` path as the column widths and drawer height.

## Tests

Unit tests in `crates/core`:

1. `next_at_show_end_selects_then_plays` — two shows; press 1 selection only,
   press 2 output; revision bumps on both.
2. `next_at_show_end_setting_off_is_no_op` — same fixture, setting off; no change.
3. `next_at_project_end_is_no_op` — last show, setting on; no change, no wrap.
4. `next_within_show_is_unchanged` — normal advance still one press.
5. `selection_follows_go_to_and_first_last` — the selected show tracks explicit
   navigation.
6. `replace_project_resets_selection` — a new project starts selected and live on
   its first show.

The existing `next_advances_and_increments_revision` and
`next_at_the_end_is_a_no_op` must be updated to the new model, not deleted.

## Acceptance

- `scripts/check.sh` exit 0.
- The six unit tests pass.
- A verifier in a separate worktree reports pass against this contract and the
  reference report.
- Evidence: a controller screenshot with the control in both states, a screenshot
  of the outline after the first press (selected moved, live unchanged), and the
  test output, under `parity/reports/evidence/`.

## Open questions

- The controller control's exact placement is left to the implementer, subject to
  B6: it must be visible without opening a menu.
- Whether a future project-item model should expose sections as selectable is
  DEV-009, not this contract.
