# Project file format

Status: **proposed.** Nothing is implemented. Decisions below need sign-off
before `crates/compat` or `crates/persistence` are written.

## Why our own format

FreeShow's `.show` and project data are JSON shaped by its Electron store, with
fields that carry UI and cloud-sync state. Adopting that shape as our primary
format would couple this project to every FreeShow schema change, and would
make a clean domain model impossible.

So we define our own format, and **import** FreeShow's. We still read FreeShow
files, forever, and never write them unless exporting for a user who asks.

## Proposed extensions

| Extension | Contains | Why |
| --- | --- | --- |
| `.cjcp` | A **project**: its shows, sections, timeline, and referenced media | The unit users open, save and share |
| `.cjcs` | A single **show**, for exchanging one show | Matches FreeShow's habit of sharing one show at a time |

Both names need a check: no conflicting registered extension, and no clash
with anything FreeShow or common tools already claim. `.cjcp` and `.cjcs` are
the proposal, not final.

## Container: start with JSON, decide on bundling later

**Phase A — a single JSON document.** The file is UTF-8 JSON with a versioned
envelope. It can be opened in a text editor and diffed in git, which suits
fixtures and tests.

```json
{
  "format": "cjcp",
  "format_version": 1,
  "app_version": "0.1.0",
  "project": { "...": "domain model" },
  "extensions": { "...": "unknown fields preserved verbatim" }
}
```

Media stays as references (paths or content hashes), not embedded.

**Phase B — a zip container, when needed.** A `.cjcp` becomes a zip holding
`project.json` plus a `media/` folder. This is the right answer for portable
projects with video, but it is more to get right, so it waits until a real
need exists. The envelope stays the same, so the move is additive.

The decision between the two is a question for you (§6).

## Versioning

Three separate version numbers, never conflated:

| Version | Changes when | Example |
| --- | --- | --- |
| `format_version` | the file layout changes | a new top-level key |
| schema version (per type) | a field's meaning changes | a slide element gains a `z` order |
| `app_version` | informational only | written, never used for decisions |

Readers accept any `format_version` they know and refuse newer ones with a
clear message. They never guess.

## Unknown data is preserved

Any field the reader does not model is kept in an `extensions` map, and written
back unchanged on save. A user's file must never lose data because a feature
is not built yet. This is the most important compatibility rule and it gets a
round-trip test on every fixture.

## Import from FreeShow

`crates/compat` reads FreeShow's JSON and maps it to our domain model. It is
one-way by default.

- Reads the FreeShow `.show` shape: a show is stored as JSON in the `shows`
  folder, with its slides, groups and layout.
- Reads FreeShow's project records (name, parent, shows, sections).
- Records anything it could not map in the import report, so nothing is silently
  dropped.
- Does not depend on the Electron store layout beyond the files themselves.

Import is tested against files from more than one FreeShow release, because its
format has changed over time.

## Fixtures

Synthetic `.cjcp` fixtures live in `parity/fixtures/`, written in our format and
licensed under this project's licence. They cover, at minimum:

- one project with two shows and grouped slides (the navigation slice);
- a show with an empty group, to test navigation past it;
- a file with an unknown `extensions` key, to test round-trip preservation;
- a file from a newer `format_version`, to test refusal.

A FreeShow-format fixture is converted by the importer during the test run, so
the importer is exercised every time.

## Media references

The rule: **a project's identity is never an absolute path.** Absolute paths
break when a folder moves, when a project is shared, and when the same file is
opened on another machine. They also leak the user's directory layout.

A media entry:

```json
{
  "id": "m_7f3a",
  "kind": "video",
  "origin": "bundled",
  "path": "media/worship-bg.mp4",
  "size": 18432021,
  "hash": "blake3:9f2c…",
  "relink_hint": null
}
```

| Field | Rule |
| --- | --- |
| `origin` | `bundled` (inside the project folder) or `external` (anywhere else) |
| `path` | Always forward slashes. For `bundled`, relative to the project root and must not escape it. For `external`, may be absolute, and is documented as non-portable |
| `size` + `hash` | Optional now; required when zip packaging lands. Used to detect a file that changed underneath us, and to deduplicate |
| `relink_hint` | Last known location, used only to offer a one-click relink. Never resolved silently |

**Why not hashes as the primary identity.** Content hashing means reading
every byte of every video on open, and it makes a project unreadable in a text
editor. Hashing is a *verification* field, not an address.

**Why relative paths win.** They survive moving the project, sharing it, and
the change to a zip container, because the zip layout is relative paths by
nature. JSON first and zip later only works cleanly if references are already
relative.

**Resolution order**, when opening a project:

1. `bundled`: resolve against the project root. That is the only authoritative
   lookup.
2. `external`: resolve `path`. If it is gone, offer relink using `relink_hint`.
3. Never scan the filesystem guessing by filename — with several `bg.mp4`
   files around, that silently picks the wrong asset.

**FreeShow imports.** FreeShow keeps media in a central media folder, outside
any project, so imported media arrives as `origin: "external"` with an absolute
`path`. That is accurate, not a workaround. The import report lists how many entries are
external, and `cjcrsg-presenter bundle <file.cjcp>` copies them into
`<root>/media` and rewrites them to relative `bundled` paths.

**When zip packaging lands**, `bundled` entries are what goes in the archive;
`external` entries stay references and are reported to the user. Because the
field is already there, nothing about the file layout has to change.

## Decisions

Decided by the user, 2026-11-09:

1. **Extensions:** `.cjcp` (project) and `.cjcs` (single show).
2. **Container:** JSON first, zip later. The envelope does not change when it does.
3. **Export to FreeShow format:** not planned, and not implemented.
4. **Media:** relative paths, with `origin` distinguishing bundled from
   external, and an optional hash for verification. See above.

