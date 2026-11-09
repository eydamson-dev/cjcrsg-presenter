# Known deviations

Places where we knowingly differ from FreeShow, or have not implemented
something it does. One list, so parity work does not relitigate them.

A deviation is not an excuse: each has an owner and a way to close it. If a
deviation is closed, delete the entry rather than marking it done.

| ID | Deviation | Impact | Close by |
| --- | --- | --- | --- |
| DEV-009 | Section actions (skip, loop, notes) are not executed; the focus view has no drag, auto-scroll or keyboard traversal | A service runs show-by-show, but FreeShow's per-section automation does not exist | Execute section actions when a service needs them |
| DEV-013 | The controller is a single scrolling panel stack, not FreeShow's three-column shell (top bar, left panel, show area, preview/tools on the right) | The app does not look like FreeShow and muscle memory from it does not transfer | Port the shell: top bar, resizable left/centre/right, preview pane |

## Rules

- A new deviation gets the next ID, an impact, and a way to close it.
- Anything user-visible needs a screenshot in `EVIDENCE.md` showing what we do
  instead, not just a line in this table.
- Deviations referenced from a report should cite the ID.
