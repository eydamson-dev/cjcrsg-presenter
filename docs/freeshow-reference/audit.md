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

## A-008 — `drawer/media.md` said none of its claims were `observed`

- **Status:** corrected in `drawer/media.md` on 2026-11-12.
- **Where:** `drawer/media.md` said "Nothing here is `observed` — FreeShow was
  not exercised for behaviour; it was run only to capture the screenshots."
- **Reference:** the 2026-11-12 `media-behaviour` run
  (`parity/reports/evidence/observe-media-2026-11-12-xvfb/`, 14/14 steps,
  `failed: []`, `commitMatchesPin: true` at
  `ff784eb388c7baef60d67e6d4e7c504f4322bca3`) exercised the drawer click/clear, a
  seeded slide background, the control strip and the next-on-media-finished
  advance, and records them in its `NN-<step>.json` assertions.
- **What actually happens:** four features on the page (`media.play`,
  `media.background`, `media.controls`, `media.next-finished`) now have `observed`
  claims; the rest of the page is still `code`/`unknown`. The blanket note was
  wrong in both directions.
- **Consequence:** the note would either block an observed claim from a contract
  or suggest the whole page is run-verified.
- **Fix:** replaced the note, added the Observed section and per-feature
  confidence lines, and labelled the specific observed bullets.

## A-009 — The `lines:0` output does not page to lines 3–4

- **Status:** corrected 2026-11-12 in the pre-run spec; the reference page was
  already right. No claim in `docs/freeshow-reference/` needed changing.
- **Where:** `parity/reports/reader/media-styles-observation-spec.md` §1,
  `out.styles.lines`, the "What observed means" cell of the shared-paging row:
  "advance the show once; assert the `lines:0` output stays on slide 1 (now
  showing lines 3-4 = the full slide of page 2)".
- **Reference:**
  `parity/reports/evidence/observe-styles-multi-output-2026-11-12-xvfb/08-styles-lines-paging.json`
  (FreeShow `ff784eb388c7baef60d67e6d4e7c504f4322bca3`, `commitMatchesPin: true`):
  the `lines:2` output showed lines 3–4 of slide 1, and the `lines:0` output
  still showed **all four lines**; the assertion reads "the lines:0 output still
  shows the whole slide: its window is null/null, so the page does not change
  it". `outputs/styles.md` already described this correctly.
- **What actually happens:** a `lines:0` output computes a `null/null` window, so
  it renders the whole slide on every page. It does not show "the full slide of
  page 2 = lines 3–4". The presentation stays on slide 1 because the `lines:2`
  output sets the shared page size (`getFewestOutputLines`).
- **Consequence:** a scenario asserting lines 3–4 on the `lines:0` output would
  fail against the reference; the correct expectation is all lines, every page.
- **Fix:** added a post-run correction to the spec, keeping the old prediction
  visible, and recorded the observed statement on `outputs/styles.md`.

## A-010 — The "Enable" button lives in `Icons.svelte`, not `Slide.svelte`

- **Status:** corrected in `show/presenting.md` on 2026-11-12. Label stays `code`
  for the citation; the marker's behaviour became `observed` in the same pass
  from the `nav-disabled-slides` run.
- **Where:** `show/presenting.md` said "disabled slides are dimmed to 0.2 in the
  show view alongside an 'Enable' button
  (`src/frontend/components/slide/Slide.svelte:287`, `562-568`)".
- **Reference:** `src/frontend/components/slide/Slide.svelte:287` carries
  `class:disabled={layoutSlide.disabled}` and `:566-568` is
  `.slide.disabled { opacity: 0.2; }`; neither renders a button. The button is
  `src/frontend/components/slide/Icons.svelte:112-119`, gated on
  `layoutSlide.disabled`, titled with `translateText("actions.enable")` at `:115`
  and calling `removeLayout("disabled")`.
- **What actually happens:** the card class and the 0.2 opacity come from
  `Slide.svelte`; the Enable control is part of the icon strip, which renders only
  when `icons && !altKeyPressed && viewMode !== "simple" && !$focusMode`
  (`Slide.svelte:282-284`). The 2026-11-12 run confirms both halves on the
  controller: cards 0 and 3 carry `disabled`, compute `opacity: 0.2` and expose
  the `Enable` button; cards 1/2/4 do neither
  (`parity/reports/evidence/observe-nav-disabled-slides-2026-11-12-xvfb/05-disabled-markers.json`).
- **Consequence:** a contract that reads the marker off `Slide.svelte` alone, or a
  port that puts the button in the card body, would place it where the reference
  does not. The button is also conditional in a way the class is not: in focus
  mode, or with Alt held, the icon strip is not rendered while the card is still
  dimmed, and in simple/list/lyrics view a disabled entry is filtered out
  entirely (`Slides.svelte:523`), so there is neither a card nor a button.
- **Fix:** cited `Icons.svelte:112-119` for the button and `Slide.svelte:287`,
  `:566-568` for the class and opacity in `show/presenting.md`.

## A-011 — A layer button's `red` is unconditional; content is signalled by `disabled`

- **Status:** corrected in `outputs/output-window.md` on 2026-11-12. Label stays
  `code` for the rendered colour; the enabled/disabled state and the titles
  became `observed` in the same pass.
- **Where:** `outputs/output-window.md` said "A layer button is red while the
  layer has content and dark when the layer is clear
  (`ClearButtons.svelte:144-205`, disabled styling at `:246-248`)."
- **Reference:** every layer button receives the `red` prop unconditionally
  (`src/frontend/components/output/preview/ClearButtons.svelte:144,159,175,188,202`).
  What changes with content is `disabled={$outLocked || …cleared}` — Background
  `:144`, Slide `:159`, Overlays `:175` (`overlayCleared && effectsCleared`),
  Audio `:188`, Next timer `:202` — and a disabled button is repainted by
  `.clear button:disabled { background-color: var(--primary) }` at `:246-248`.
- **What actually happens:** the elements do not choose a colour; they set
  `disabled`. The clear *title* is also not a content signal on three of the five:
  Slide, Audio and Next timer carry theirs unconditionally, and Overlays drops its
  title only when an overlay is `locked` (`lockedOverlay`, `:175`), not when the
  layer is empty. Only Background drops its title when cleared or locked (`:144`).
  Runs: with content in three layers all five groups are titled and the first
  three enabled
  (`parity/reports/evidence/observe-lock-and-layers-2026-11-12-xvfb/07-layer-buttons.json`);
  with Overlays empty and Background empty, Overlays was still titled and
  disabled while Background was untitled and disabled
  (`parity/reports/evidence/observe-nav-disabled-slides-2026-11-12-xvfb/06-start-skips-disabled.json`).
- **Consequence:** a port that keys "layer has content" off the title would
  misreport Slide, Audio and Next timer (always titled) and Overlays (titled when
  empty); keying it off `disabled` is the reference's rule. The colour is a CSS
  consequence and must not be asserted without pixels.
- **Fix:** replaced the wording in `outputs/output-window.md` with the
  `disabled`/title rule, cited the per-button lines and the disabled styling, and
  kept the rendered colour `code`.

## A-012 — A bound slide reaches an inactive output, and a stale binding falls back

- **Status:** corrected in `outputs/multiple-outputs.md` on 2026-11-12; the open
  question it answered was closed in the same edit.
- **Where:** `outputs/multiple-outputs.md`, in the page as it stood before this
  edit (its old bindings section, `:149-151`): a binding list that names only
  outputs which no longer exist "makes the slide unbindable from every output:
  `setOutput` resolves to an empty target list and sends nothing"; and its old
  Open questions (`:217-219`) asked how a slide bound to two outputs behaves when
  one is locked, with the parenthetical "the locked one is not active, so
  `setOutput` skips it, but `out.slide` for it may still hold the old slide".
- **Reference:** `src/frontend/components/helpers/output.ts:151-155` —
  `const resolvedBindings = bindings.length ? resolveOutputIds(bindings) : []`
  then `const allOutputIds = resolvedBindings.length ? resolvedBindings :
  getActiveOutputs(get(outputs), true, false, true)`. An unresolved binding list
  is empty, so the *active* outputs are used; and in the bound branch the set is
  used as-is, with no `active` check (`:699-714` filters `active` only for the
  non-bound path). The write loop `:247-318` also has no `active` check.
- **What actually happens:** with two active normal outputs, a slide bound to
  `primary` alone reached `primary` and not `secondary`; a slide bound to
  `["primary","Secondary"]` reached **both** pages even with `secondary`
  deactivated (name struck); a slide bound to the nonexistent `ghost-output`
  reached **both** active pages. Evidence:
  `parity/reports/evidence/observe-nav-output-bindings-2026-11-12-xvfb/06-click-bound-slide.json`,
  `09-bound-slide-to-inactive-output.json`, `11-stale-binding.json`.
- **Consequence:** a contract written from the old page would assert that a stale
  binding sends nothing and that a bound slide is withheld from a locked output;
  both fail against the reference. A bound slide is an explicit override of the
  active set, including the per-output lock.
- **Fix:** rewrote the edge case and the open question with the run citations and
  recorded that the bound branch ignores `active`; the binding *menus* and the
  project-moved migration stay `code`.

## How to add an entry

Use the next number, keep the five parts, and cite the pinned commit. If the
contradiction is only between two of our own documents, say which one the
reference supports.
