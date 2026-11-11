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

## A-005 — Present can create an output that is never shown

- **Status:** corrected in `outputs/output-window.md` on 2026-11-11; the run is
  recorded in `parity/reports/evidence/observe-outputs-2026-11-11-workspace/`.
- **Where:** `outputs/output-window.md` said each output is a window "created
  hidden and shown inactive" (Summary), described `showWindow()` as the result of
  a present (`out.window` step 5), and listed only `autoStartup` as the case where
  one display shows no window (`out.enable`, Edge cases). Read together, that said
  a normal Present shows the output window.
- **Reference:** `src/electron/output/helpers/OutputVisibility.ts:58-72` hides an
  output instead of showing it when its resolved bounds cover more than half of
  the main window, bounds are not locked, and it is auto-positioned,
  auto-started, or always-on-top (the default). `src/frontend/components/helpers/output.ts:129-133`
  makes `autoPosition` true for a single output. `OutputLifecycle.ts:251-291`
  creates the `BrowserWindow` with `show:false`. Run 2026-11-11, steps 2–11:
  `Primary` exists with `browserWindows[].visible: false` throughout, while the
  output page renders, starts, locks, advances and clears; `presentButton.on`
  stays `false`. The GPU desktop run also records `Primary` `visible:false` at
  `parity/reports/evidence/observe-outputs-2026-11-11-host/02-present.json`.
- **What actually happens:** on one display a Present click creates the output
  page and a hidden window. The output still renders from that page, and the
  Present control stays off because `outputDisplay` is derived from the reported
  visible state (`src/frontend/utils/receivers.ts:119-124`). The output window is
  only evidence of an output; it is not evidence of a window on screen.
- **Consequence:** a contract that asserts Present makes a window appear fails
  on a single display, and a harness must capture the output page rather than
  assume a mapped window. Do not use a page screenshot as proof of a display.
- **Fix:** added the 2026-11-11 observed section and corrected the present edge
  case in `outputs/output-window.md`. `parity/README.md` already stated this and
  was left unchanged.

## A-006 — The reference directory is no longer all `code`

- **Status:** corrected in `README.md`, `outputs/index.md`, `show/index.md` and
  `WHAT-IS-THIS.md` on 2026-11-11.
- **Where:** `README.md` said "Claims labelled `observed` | 0" and "The reference
  was run to capture the screenshots, not to exercise each behaviour";
  `outputs/index.md` said "Nothing here is `observed`, so ... no behaviour on
  these pages may enter a required contract without a run"; `show/index.md` said
  "every claim ... is read from source; nothing was run" and "Nothing here is
  `observed`"; `WHAT-IS-THIS.md` said "Nothing is labelled `observed` yet."
- **Reference:** `show/presenting.md` has carried `observed` end-of-show claims
  since A-004 (2026-11-09), and the 2026-11-11 `outputs-basic` run adds observed
  present/start/lock/advance/clear behaviour in
  `parity/reports/evidence/observe-outputs-2026-11-11-workspace/`.
- **What actually happens:** `observed` claims exist and may become requirements;
  the rest of the outputs area is still `code` and does not gain that permission
  from a neighbouring observed claim.
- **Consequence:** the blanket "nothing is observed" note would wrongly block the
  observed output behaviour from a contract, or wrongly suggest the whole area is
  run-verified. Neither is true.
- **Fix:** updated the `observed` row and the current-state paragraph in
  `README.md`; added the `observed` label row and a pointer to the run in
  `outputs/index.md`; updated the status line in `WHAT-IS-THIS.md` and the
  confidence/label notes in `show/index.md`. The detailed claims stay on
  `outputs/output-window.md`.

## A-007 — The output screenshot is a page capture, and its size is not fixed

- **Status:** corrected in `outputs/output-window.md`,
  `show/presenting.md` and `screenshots/README.md` on 2026-11-11.
- **Where:** the `output-window.png` caption in both `output-window.md` and
  `presenting.md` said "The output window at 1920x1080 showing the live slide",
  and `screenshots/README.md` said "the output window is 1920×1080".
- **Reference:** `parity/tools/capture_freeshow_ui.mjs:130-135` captures the new
  window with Playwright's `output.screenshot()`, i.e. a page screenshot, which
  works while the window is hidden. The 2026-11-11 runs recorded the output
  surface as 1919×1079 on a 1920×1080 X11 display and 1920×1080 on a 2560×1440
  display; Chromium shrinks a normal window that exactly matches a display, and
  `OutputLifecycle.ts:293-306` compensates only for offscreen (OSR) windows.
- **What actually happens:** the image is a genuine render of the output page,
  but it is not a frame captured from a mapped window, and 1920×1080 is not a
  stable output size.
- **Consequence:** using the image as evidence that a window appeared, or using
  1920×1080 as the output's fixed size, is wrong.
- **Fix:** relabelled the caption and the screenshot row, and recorded the
  measured sizes.

## How to add an entry

Use the next number, keep the five parts, and cite the pinned commit. If the
contradiction is only between two of our own documents, say which one the
reference supports.
