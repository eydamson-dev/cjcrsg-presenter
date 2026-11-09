# Next at the end of a service — 2026-11-09

**Corrected 2026-11-09 after a runtime observation.** The first version of this
report said the code path had "no configuration branch" and had not been run. Both
were wrong. The correction is recorded here and in
`docs/freeshow-reference/audit.md` A-001 and A-004.

DEV-008 asked whether our "next on the last slide is a no-op" matches FreeShow.
The boundary is the **project**, not the show, and the move has two steps.

## What FreeShow does — observed

Two shows in one project, one Space press at a time. Setting
`special.nextItemOnLastSlide` is the only difference between the two runs.

| Setting | Press 1 | Press 2 | At the end of the project |
| --- | --- | --- | --- |
| on (default) | next show **selected**, output unchanged | next show **outputted** | no change |
| off | no change | no change | no change |

Full method, captures and code trace:
`parity/reports/reader/next-at-end-2026-11-09.md`.

So: at the end of a **show**, one press moves the active project item to the next
item; a second press outputs it. At the end of the **project**, next does nothing:
no wrap, no clear, no blank. `Space` on the last slide of the last show does not
loop to the first.

## Why it takes two presses

- `OutputHelper.play()` calls `changeProjectItem` when there is no subsequent
  slide (`src/frontend/components/helpers/OutputHelper.ts:80-99`).
- `changeProjectItem` opens the next item with `openProjectItem`
  (`:130-194`, call at `:180`).
- `openProjectItem` only sets `activeShow`; it does not play a slide
  (`src/frontend/components/show/project.ts:35-64`).
- The item is played directly only when `options.playNext` is set (next-slide
  timer, next on media finished), not for Space or ArrowRight (`:183-193`).
- On the following press, `getShow` returns the now-active show once the outputted
  show has ended (`:240-264`), and its first slide is played.

The configuration branch is at `OutputHelper.ts:131`:
`if (!get(focusMode) && get(special).nextItemOnLastSlide === false) return`. The
setting defaults to on (`src/frontend/components/settings/tabs/General.svelte:55`).

## What we do

Our engine flattens the project's shows into one order, so:

| Situation | FreeShow | Ours |
| --- | --- | --- |
| Next at the last slide of a show, setting on | selects the next item, then plays it on the next press | next show's first slide, one press |
| Next at the last slide of a show, setting off | no change | next show's first slide, one press |
| Next at the last slide of the project | no-op | no-op (`next_at_the_end_is_a_no_op`) |
| Previous at the first slide | previous project item or no-op | no-op at the first slide |

This is a real difference, not the "behaviour agrees" the first version claimed.
FreeShow's project items can also be sections and other non-show entries; we have
no sections (DEV-009).

## How this was verified

- Runtime: the reference was run under Playwright, presented, started on a show,
  and driven with Space. State came from the API's `get_output`; the main and
  output windows were captured at each step. See
  `parity/reports/reader/next-at-end-2026-11-09.md`.
- Our side: `engine::tests::next_at_the_end_is_a_no_op` and
  `engine::tests::next_advances_and_increments_revision`, which crosses a show
  boundary.

## History

The first version of this report, written from code reading alone, said:
"It was **not** verified by running FreeShow ... The code path is unconditional
and has no configuration branch." The run disproved both the missing branch and
the one-press assumption. The original wording is kept here so a later reader can
see why the correction exists.
