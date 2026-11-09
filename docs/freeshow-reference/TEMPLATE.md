# <Feature title>

- **ID:** `<area>.<feature>`
- **Area:** <area>
- **Online docs:** <https://freeshow.app/docs/<slug>>
- **Pinned code:** ff784eb
- **Confidence:** `code` | `observed` | `doc` | `unknown` (overall, lowest of the claims below)

## Summary

One or two sentences: what the feature is, and why a user would use it.

## What the user sees

The visible behaviour, in plain words. Name the controls by their visible label.

Screenshot: `../screenshots/<area>-<name>.png` — not yet captured. When it is
captured, state in the caption which window, which state, and the viewport.

## How it behaves

Numbered steps for the main flow, then the state transitions.

- Step → effect on state, outputs, or persistence (with `path:line`).
- Edge cases: empty input, no active show, no output, repeated action, boundary.

## State and persistence

| What | Where it lives | When it is written | Survives restart |
| --- | --- | --- | --- |

## Settings

| Setting | Key and location | Default | Effect |
| --- | --- | --- | --- |

## Code

- `src/...:line` — what this location does, in one line.

## Online docs

- Link and the one thing it adds that the code does not show.

## Doc vs code

- `doc` says: ... / code does: ... (`path:line`).
- Or: none found.

## Open questions

- What is not established, and what would establish it (a run, a file, a setting).

## Changelog

The page is living. Each correction adds a line here and an entry in `audit.md`.

- `YYYY-MM-DD` — what changed, why, and the audit ID (`A-nnn`). Keep the earlier
  claim visible in `audit.md`.
