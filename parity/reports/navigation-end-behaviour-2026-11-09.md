# Next at the end of a service — 2026-11-09

DEV-008 asked whether our "next on the last slide is a no-op" matches FreeShow.
It does, with one distinction worth stating: the boundary is the **project**, not
the show.

## What FreeShow does

Read from the pinned reference (`ff784eb`), not guessed:

- `src/frontend/components/helpers/OutputHelper.ts`, `play()` — when there is no
  subsequent slide, it calls `changeProjectItem(outputId, show, next, options)`.
- `changeProjectItem()` — builds the project's item list, takes
  `projectItemIndex + 1`, and:

  ```ts
  const newItem = projectItems[newIndex]
  if (!newItem) return
  ```

  No wrap, no clear. At the end of the project, next does nothing.

So: at the end of a **show**, next moves to the next item in the project; at the
end of the **project**, it is a no-op. `Space` on the last slide of the last show
does not loop to the first, and does not blank the output.

## What we do

Our engine flattens the project's shows into one order, so:

| Situation | FreeShow | Ours |
| --- | --- | --- |
| Next at the last slide of a show | next project item | next show's first slide |
| Next at the last slide of the project | no-op | no-op (`next_at_the_end_is_a_no_op`) |
| Previous at the first slide | previous project item or no-op | no-op at the first slide |

The one difference is that FreeShow's project items can be sections and other
non-show entries; we have no sections (DEV-009). Within a project of shows only,
the behaviour agrees.

## How this was verified

By reading the reference implementation and by our own tests:

- `engine::tests::next_at_the_end_is_a_no_op`
- `engine::tests::next_advances_and_increments_revision`, which crosses a show
  boundary.

It was **not** verified by running FreeShow and pressing next at the end. The
code path is unconditional and has no configuration branch, so reading it
answers the question; the report says so rather than implying a runtime
observation that did not happen.
