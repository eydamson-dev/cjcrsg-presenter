# FreeShow documentation source

Mirrored from https://github.com/ChurchApps/FreeShowWeb at commit `8d875b59f48976ea2e9a2c4b90b9bb66b4480937` (ref `main`).
Fetched 2026-11-09T10:53:16Z by `scripts/fetch_freeshow_docs.sh`.

Layout:

- `docs/` mirrors `src/routes/docs`: `+page.md` becomes `<dir>.md`,
  and `+layout.svelte` becomes `docs/_nav.svelte`.
- `docs/api.svelte` is the API page (`src/routes/api/+page.svelte`).
- `static/images/docs/` holds the images the Markdown links.

Do not edit these files: they are upstream text. Write findings in the
pages next to this directory instead, and cite `source/docs/<page>.md`.

Files: 54 markdown/page files, 34 images.
