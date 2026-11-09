# Reference audit

Contradictions found while writing this directory. Each entry says what was
believed, what the reference actually does, and which document is wrong.

This is a list of defects in our understanding, not a list of FreeShow bugs. When a
contract or a report is corrected, keep the entry and mark it resolved with the
change that fixed it.

## A-001 — Next at the end of a show is configurable

- **Status:** resolved 2026-11-09. The old report was rewritten after the observed
  run, and `show/presenting.md` now records the setting and the two-step move.
- **Where:** `parity/reports/navigation-end-behaviour-2026-11-09.md`, "How this was
  verified", says the code path "has no configuration branch".
- **Reference:** the branch is
  `src/frontend/components/helpers/OutputHelper.ts:131`:
  `if (!get(focusMode) && get(special).nextItemOnLastSlide === false) return`.
- **What actually happens:** with the default, `nextItemOnLastSlide` is not `false`
  (`src/frontend/components/settings/tabs/General.svelte:55`), so next at the end
  of a show moves to the next project item. If the user turns the setting off, it
  does nothing. At the end of the project it does nothing either way.
- **Consequence:** the report's conclusion (no wrap) is right for the default, but
  its claim that the behaviour is unconditional is wrong. A contract that ignores
  the setting will fail for users who disable it.
- **Fix:** correct the report and add the setting to the contract and scenarios.

## A-002 — The API is not HTTP on 5505

- **Status:** open in outside notes; not repeated in these pages.
- **Where:** the architecture recommendation that described the API as an HTTP
  interface at `localhost:5505`.
- **Reference:** `src/electron/utils/api.ts:13` sets WebSocket 5505 and REST 5506;
  `:41-48` starts REST at `port + 1` and OSC on the WebSocket port.
- **What actually happens:** 5505 speaks Socket.IO and OSC; REST is 5506 and
  accepts a JSON body or a query. The published API page documents all four.
- **Consequence:** an integration written against "HTTP 5505" does not work.
- **Fix:** cite the API page (`source/docs/api.svelte`) and use 5506 for REST.

## A-003 — Language count

- **Status:** open, low impact.
- **Where:** `source/docs/features.md` says 20 languages.
- **Reference:** `public/lang/` holds 31 files, including regional variants such as
  `en_GB`, `pt_BR` and `zh_TW`.
- **What actually happens:** the counts describe different things (languages versus
  files). Nothing is necessarily missing.
- **Consequence:** do not use "20" as a completeness check for translations.
- **Fix:** compare the language list, not the file count, if this ever matters.

## A-004 — Next at the end of a show takes two presses

- **Status:** resolved 2026-11-09 in `show/presenting.md` and in
  `parity/reports/navigation-end-behaviour-2026-11-09.md`.
- **Where:** `show/presenting.md` said "the next item ... its first slide is played"
  for space advances, and the docs say space at the end "will go to the next show".
- **Reference:** observed on 2026-11-09 with two shows in one project, one Space
  press at a time. With the default setting: press 1 selects the next project item
  and the output stays on the old show; press 2 outputs the next show. With
  `special.nextItemOnLastSlide` off: neither happens. At the end of the project:
  no change.
- **Mechanism:** `OutputHelper.ts:130-194`; `openProjectItem` only sets
  `activeShow` (`src/frontend/components/show/project.ts:35-64`), and the item is
  played directly only when `options.playNext` is set (`:183-193`).
- **Consequence:** a contract that says "next outputs the next show" will fail the
  reference on the first press.
- **Evidence:** `parity/reports/reader/next-at-end-2026-11-09.md` and the captures
  in that directory.

## How to add an entry

Use the next number, keep the five parts, and cite the pinned commit. If the
contradiction is only between two of our own documents, say which one the
reference supports.
