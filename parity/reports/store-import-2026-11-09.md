# FreeShow store import — 2026-11-09

Migrating one project was already possible (`import-project`). This walks a
whole FreeShow data folder: every project in `projects.json` becomes its own
`.cjcp`.

## What it does

`cjcrsg-presenter import-store <freeshow-data-dir> <out-dir>` reads
`projects.json`, imports each project against `shows/`, and writes
`<out-dir>/<project name>.cjcp`.

- **One failure does not stop the migration.** A project whose show is missing
  is reported by name and reason; the rest still import.
- **Names collide safely.** A duplicate project name gets the project id
  appended rather than overwriting the first file.
- **File names are sanitised** for characters that are awkward on Windows, and
  an empty name becomes `project`.

## Measured

A store with three projects and two shows (one reference deliberately broken):

```text
imported 2
  Midweek -> /tmp/opencode/store/out/Midweek.cjcp
  Sunday Morning -> /tmp/opencode/store/out/Sunday Morning.cjcp
failed   1
  Broken One: project "Broken One" references show "nope", which is not in the shows folder
```

The written project opens normally:

```text
project   Midweek
format    cjcp v1
shows     1
slides    3
media     0
```

Raw: `evidence/store/import-store.txt`, `inspect-midweek.txt`,
`projects.json`.

Note `media 0`: this store's shows reference no media. A real store's projects
import with external media and need `bundle` per project to become portable —
the importer does not silently copy gigabytes.

## Categories and tags

Category names live in FreeShow's `settings_synced.json`; shows reference one by
id and carry `metadata.tags`. Both now import:

```text
  show  Parity Fixture (fx-show) category=Songs tags=worship,easter
```

The name is resolved from the store's category map; a malformed or missing
`settings_synced.json` imports everything with no categories instead of failing
the migration.

Raw: `evidence/store/inspect-metadata.txt`, `settings_synced.json`.

## Tests

- every project in the file becomes its own `.cjcp`, with the right name and
  slide count;
- a project with a missing show is reported while the others import;
- a folder without `projects.json` fails with a message naming the folder;
- category names come from `settings_synced.json` into the project;
- a malformed synced-settings file does not fail the migration;
- names are sanitised and duplicates would differ.

## What DEV-005 still is

DEV-005 is now only **media metadata**: durations, thumbnails and playlists are
not imported. Content, categories and tags are:

- projects and their shows migrate;
- category names resolve from the store's synced settings;
- show-level tags import and round-trip;
- the media folder itself is still copied per project by `bundle`, not here.
