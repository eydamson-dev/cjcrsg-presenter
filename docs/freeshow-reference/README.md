# FreeShow reference — source of truth for parity

This directory documents what FreeShow does, so that the Rust implementation can be
checked against a written description instead of against our own reading of a UI.
It covers user-facing features and the internal behaviour behind them: state,
settings, persistence, IPC, network servers, and file formats.

Start here:

- [`WHAT-IS-THIS.md`](WHAT-IS-THIS.md) — what the set is, what it is not, and a
  copy-paste prompt for an agent.
- [`feature-inventory.md`](feature-inventory.md) — every feature, with a stable ID.
- [`USING-THIS.md`](USING-THIS.md) — what each label permits; read before treating
  a page as a requirement.
- [`audit.md`](audit.md) — contradictions found, and which of our documents is wrong.
- [`screenshots/`](screenshots/README.md) — captures of the running reference.
- [`source/`](source/README.md) — the published docs, mirrored.

## Pinned version

```
FreeShow ff784eb388c7baef60d67e6d4e7c504f4322bca3   (1.6.8-beta.3)
```

Every code reference is at this commit. The online docs at freeshow.app describe the
latest release; where they differ, the page says so. When the pin moves, update
every page's references, and re-check the pages that changed.

## Online docs, locally

`source/` is a mirror of the published documentation, not a summary of it. It is
taken from `ChurchApps/FreeShowWeb` (the site that renders freeshow.app), because
that repository holds the Markdown the site is built from.

```bash
scripts/fetch_freeshow_docs.sh        # refresh the mirror, records the commit
```

- `source/docs/*.md` — one file per published page, same names as the URLs.
- `source/docs/_nav.svelte` — the sidebar definition.
- `source/docs/api.svelte` — the API page, which is a component, not Markdown.
- `source/static/images/docs/` — the images the pages link.

Read `source/README.md` for the upstream commit and layout. Do not edit the
mirror: it is upstream text. Findings go in the pages beside it, citing
`source/docs/<page>.md`.

Page order in this directory follows the published navigation:

1. Getting started: Introduction, Features, Installation (Windows, macOS, Linux)
2. Projects: Projects, Project
3. Show: Shows, Views, Editing, Items, Chords, Groups, Arrangements, Tools
4. Drawer: Drawer, Media, Audio, Overlays, Templates, Scripture, Calendar, Actions
5. Outputs: Output, NDI, Multiple outputs, Styles, Livestreaming
6. Remote: Connecting, RemoteShow, StageShow, ControlShow, OutputShow, Companion
7. Cloud: Cloud Sync, Integrations
8. Actions: MIDI, Importing, Exporting
9. Advanced: Data storage, Smart, CCLI Reporting
10. Tips: Styling, Keyboard Shortcuts, FAQ
11. Formats: .show, .project, .fsb

`source/docs/functions.md` and `source/docs/show.md` are not in the sidebar:
`functions` describes the drawer's Functions tab, and `show` redirects to
`show-type`.

## How to read a page

Each feature page follows `TEMPLATE.md` and has these parts:

- **What the user sees**: the visible behaviour, in plain words.
- **How it behaves**: the steps and state transitions, with the edge cases.
- **State and persistence**: what is stored, where, and when it is written.
- **Settings**: the settings that change the behaviour, and their defaults.
- **Code**: `path:line` references at the pinned commit.
- **Online docs**: the matching freeshow.app page, for context.
- **Screenshot**: a capture of the running reference where one exists, otherwise a
  shot list of what a capture must show.
- **Doc vs code**: any place the online docs say something the code does not do.
- **Open questions**: what is not yet established.

## Labels

Every behavioural claim carries one label:

| Label | Meaning |
| --- | --- |
| `observed` | Confirmed by running the reference, with the observation recorded. |
| `code` | Read from the source at the pinned commit. Not run yet. |
| `doc` | Stated only by the online docs. Not confirmed in the code or by a run. |
| `unknown` | Not established. Say what would establish it. |

`code` is the default for most pages. It becomes `observed` only after a run.

## Rules

1. **Code wins.** When the online docs and the code disagree, the page records both
   and treats the code as the behaviour. The docs claim stays in the page, labelled
   `doc`.
2. **Behaviour, not structure.** Describe what the feature does and what it changes.
   Do not describe how the Svelte components are laid out, unless that is part of
   the behaviour.
3. **Cite every claim.** A claim without a `path:line` or an online docs link is not
   a finding; move it to Open questions.
4. **No invention.** If a behaviour cannot be traced, write `unknown`. Do not fill
   the gap from general knowledge of similar apps.
5. **Keep the page short enough to read.** Detail goes into the page; the index only
   lists features.

## Areas

| Area | Index | Pages | Online docs sections |
| --- | --- | --- | --- |
| Getting started and projects | [`getting-started/index.md`](getting-started/index.md) | 4 | Introduction, Features, Installation, Projects |
| Shows | [`show/index.md`](show/index.md) | 9 | Shows, Views, Editing, Items, Chords, Groups, Arrangements, Tools |
| Drawer | [`drawer/index.md`](drawer/index.md) | 9 | Drawer, Media, Audio, Overlays, Templates, Scripture, Calendar, Actions |
| Outputs | [`outputs/index.md`](outputs/index.md) | 6 | Output, NDI, Multiple outputs, Styles, Livestreaming |
| Remote and clients | [`remote/index.md`](remote/index.md) | 6 | Connecting, RemoteShow, StageShow, ControlShow, OutputShow, Companion |
| Cloud, integrations and transfer | [`cloud-and-transfer/index.md`](cloud-and-transfer/index.md) | 6 | Cloud Sync, Integrations, MIDI, Importing, Exporting |
| Advanced, tips and formats | [`advanced/index.md`](advanced/index.md) | 7 | Data storage, Smart, CCLI Reporting, Styling, Shortcuts, FAQ, Formats |
| Internal (not in the docs) | [`internal/index.md`](internal/index.md) | 12 | IPC channels, main process, servers, settings, stores, API actions |

## Current state

| Measure | Value |
| --- | --- |
| Features in `feature-inventory.md` | 225 |
| Detail pages | 60 |
| Code citations checked | 1,628, 0 failed |
| Screenshots of the running reference | 30 |
| Claims labelled `observed` | 0 |

No page is a runtime-verified contract yet. The reference was run to capture the
screenshots, not to exercise each behaviour. A page becomes a contract only when a
scenario confirms it; `USING-THIS.md` says what each label permits.

The checks:

```bash
scripts/check_freeshow_refs.py        # every src/...:line exists at the pin
scripts/check_freeshow_coverage.py    # every inventory ID is mentioned by a page
```

## Screenshots

`screenshots/` holds captures of the running reference, with a README that names
the state and viewport of each one. They are taken with
`parity/tools/capture_freeshow_ui.mjs` and
`parity/tools/capture_freeshow_clients.mjs`, not with desktop screenshot tools.

## Using it as a contract

`USING-THIS.md` says what each evidence label permits, and how the reader,
scenario author, implementer and verifier should cite this directory. Read it
before turning a page into a requirement.

## Relation to the rest of the repo

- `docs/reference.md` says how to run the reference. This directory says what it
  does.
- `parity/features/` holds the machine-readable entries used by the parity harness.
  An entry cites a page here and uses the inventory ID as its stable key.
- `docs/deviations.md` lists what we knowingly do not match. A deviation must cite a
  page here.
