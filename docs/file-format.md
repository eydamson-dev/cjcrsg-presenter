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

## Open decisions

1. **Extension names:** `.cjcp` and `.cjcs`, or something else?
2. **Container:** JSON first, zip later (recommended), or zip from the start?
3. **Export to FreeShow format:** not planned. Do we ever need it?
4. **Media references:** relative paths, absolute paths, or content hashes?
