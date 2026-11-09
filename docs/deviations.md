# Known deviations

Places where we knowingly differ from FreeShow, or have not implemented
something it does. One list, so parity work does not relitigate them.

A deviation is not an excuse: each has an owner and a way to close it. If a
deviation is closed, delete the entry rather than marking it done.

| ID | Deviation | Impact | Close by |
| --- | --- | --- | --- |
| DEV-009 | Section actions (skip, loop, notes) are not executed; the focus view has no drag, auto-scroll or keyboard traversal | A service runs show-by-show, but FreeShow's per-section automation does not exist | Execute section actions when a service needs them |
| DEV-013 | The controller has FreeShow's top bar, three columns, drawer and a Projects column, but no project catalogue behind it: no folders, create, rename, duplicate, delete, archive or import, and no editable slide grid | Projects can only be opened from the command line or the recent list; they cannot be created or organised in the app, and slides cannot be edited | Add a project store behind the browser, then the slide editor when editing reaches its phase (`docs/ui-parity.md`) |
| DEV-014 | Drawer tabs are text-only: there is no ported icon set, so the reference's label-hiding rule below 750 px does not apply | The strip reads differently from FreeShow and takes more width at small window sizes | Port FreeShow's icon set and apply the 750 px icon-only rule |
| DEV-015 | Next at the end of a show advances to the next show in one press and ignores `nextItemOnLastSlide`; FreeShow selects the next project item on the first press, plays it on the second, and stops both when the setting is off | At a show boundary one press changes the live output in our app where FreeShow only changes the selection; a user who disables the setting cannot stop the move | Model the setting and the select-then-play step in `crates/core`, then cover it with `nav-next-edge-cases` |

## Rules

- A new deviation gets the next ID, an impact, and a way to close it.
- Anything user-visible needs a screenshot in `EVIDENCE.md` showing what we do
  instead, not just a line in this table.
- Deviations referenced from a report should cite the ID.
