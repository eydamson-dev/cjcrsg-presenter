# Known deviations

Places where we knowingly differ from FreeShow, or have not implemented
something it does. One list, so parity work does not relitigate them.

A deviation is not an excuse: each has an owner and a way to close it. If a
deviation is closed, delete the entry rather than marking it done.

| ID | Deviation | Impact | Close by |
| --- | --- | --- | --- |
| DEV-003 | The remote speaks JSON over HTTP, not Socket.IO | Existing FreeShow remote/stage clients cannot connect | Implement the Socket.IO surface, or ship our own clients |
| DEV-005 | FreeShow's categories, tags and media metadata are not imported | A migrated library loses its organisation and media details | Read FreeShow's store and map those fields |
| DEV-009 | The engine is linear inside a show; groups are navigation only | FreeShow's layout/section model is richer | Model layout sections when a feature needs them |

## Rules

- A new deviation gets the next ID, an impact, and a way to close it.
- Anything user-visible needs a screenshot in `EVIDENCE.md` showing what we do
  instead, not just a line in this table.
- Deviations referenced from a report should cite the ID.
