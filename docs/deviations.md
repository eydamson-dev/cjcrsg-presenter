# Known deviations

Places where we knowingly differ from FreeShow, or have not implemented
something it does. One list, so parity work does not relitigate them.

A deviation is not an excuse: each has an owner and a way to close it. If a
deviation is closed, delete the entry rather than marking it done.

| ID | Deviation | Impact | Close by |
| --- | --- | --- | --- |
| DEV-009 | Section actions (skip, loop, notes) are not executed; the focus view has no drag, auto-scroll or keyboard traversal | A service runs show-by-show, but FreeShow's per-section automation does not exist | Execute section actions when a service needs them |
| DEV-013 | The controller has FreeShow's top bar, three columns and bottom drawer, but its left column is the open project's outline rather than FreeShow's project browser, and the centre has no editable slide grid | Projects cannot be browsed or edited the way FreeShow's controller allows; the shell looks right but two whole surfaces are missing | Port the left project browser, then the slide editor when editing reaches its phase (`docs/ui-parity.md`) |
| DEV-014 | Drawer tabs are text-only: there is no ported icon set, so the reference's label-hiding rule below 750 px does not apply | The strip reads differently from FreeShow and takes more width at small window sizes | Port FreeShow's icon set and apply the 750 px icon-only rule |

## Rules

- A new deviation gets the next ID, an impact, and a way to close it.
- Anything user-visible needs a screenshot in `EVIDENCE.md` showing what we do
  instead, not just a line in this table.
- Deviations referenced from a report should cite the ID.
