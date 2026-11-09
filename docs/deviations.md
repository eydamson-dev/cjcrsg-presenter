# Known deviations

Places where we knowingly differ from FreeShow, or have not implemented
something it does. One list, so parity work does not relitigate them.

A deviation is not an excuse: each has an owner and a way to close it. If a
deviation is closed, delete the entry rather than marking it done.

| ID | Deviation | Impact | Close by |
| --- | --- | --- | --- |
| DEV-001 | The controller UI has no keyboard shortcuts (`Space`, arrows, `PageUp/Down`) | Operators using a keyboard lose speed | Add a key handler on the controller window |
| DEV-003 | The remote speaks JSON over HTTP, not Socket.IO | Existing FreeShow remote/stage clients cannot connect | Implement the Socket.IO surface, or ship our own clients |
| DEV-004 | Imported media is `External`; there is no copy-into-project | Projects are not portable or shareable | Provide `External → Bundled` copy with a relative path |
| DEV-005 | No SQLite persistence | No recent-projects, no restore-on-start, no FreeShow DB import | Phase 3: project store |
| DEV-006 | No document importers (PDF, PPTX, DOCX, ODP/ODT) | Churches cannot bring existing decks | Phase 3; evaluate LibreOffice sidecar first |
| DEV-007 | The stage shows live, next, notes and a clock slot only | No timers, message, or layout options | Phase 2 remainder |
| DEV-008 | `next` on the last slide is a no-op; FreeShow's behaviour is unverified | Could differ at the end of a service | Observe the reference, then match it |
| DEV-009 | The engine is linear inside a show; groups are navigation only | FreeShow's layout/section model is richer | Model layout sections when a feature needs them |
| DEV-010 | Experiment 3 measured dropped frames, not CPU cost | Media budget is unknown | Measure inside the app in Phase 4 |
| DEV-011 | `elastic` and `bounce` easings are approximated by one cubic-bézier | Those two curves are not exactly FreeShow's | Keyframes with intermediate stops per curve |
| DEV-012 | The `slide` transition always enters from the right | FreeShow's default enters from the left and `custom.direction` selects an edge | Apply `custom.direction` in the renderer |

## Rules

- A new deviation gets the next ID, an impact, and a way to close it.
- Anything user-visible needs a screenshot in `EVIDENCE.md` showing what we do
  instead, not just a line in this table.
- Deviations referenced from a report should cite the ID.
