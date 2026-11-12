# Reader report — disabled slides, output bindings, lock scopes and layers (observed runs)

Date: 2026-11-12
Reference: FreeShow `ff784eb388c7baef60d67e6d4e7c504f4322bca3`
(`package.json` version `1.6.8-beta.3`), `commitMatchesPin: true` in all three
runs. The reference checkout is read-only. This report relabels only the claims
the runs established; it does not re-run anything and does not touch
`parity/tools/` or `parity/fixtures/`.

Scope: the post-run half of stage 1 for the navigation/output-control slice whose
pre-run spec is `parity/reports/reader/nav-output-controls-observation-spec.md`.
The spec's In/Out tables were the checklist: everything it marked IN and the runs
asserted is upgraded; everything it marked OUT, and anything the runs did not
assert, stays `code`/`unknown`.

Evidence:

- `parity/reports/evidence/observe-nav-disabled-slides-2026-11-12-xvfb/` —
  scenario `nav-disabled-slides`, 12/12 steps, `failed: []` (`run.json`). One
  1920×1080 X11 display, controller viewport 1600×900, single default output.
  Fixture `Parity Nav`: five flat slides, layout entries 0 and 3 `disabled`.
- `parity/reports/evidence/observe-nav-output-bindings-2026-11-12-xvfb/` —
  scenario `nav-output-bindings`, 11/11 steps, `failed: []`. Two normal outputs
  (`primary`, `secondary`). Fixture `Parity Bindings`: an item bound to `primary`
  on entry 0, slide bindings `["primary"]` (entry 1),
  `["primary","Secondary"]` (entry 3), `["ghost-output"]` (entry 4).
- `parity/reports/evidence/observe-lock-and-layers-2026-11-12-xvfb/` —
  scenario `lock-and-layers`, 14/14 steps, `failed: []`. Two normal outputs.
  Fixture `Parity Locks`: slide 0 with a `logo.png` background, a
  `placeUnderSlide` overlay and a normal overlay; slide 1 empty.

Every behaviour below is cited to a `NN-<step>.json` `assertions[]` entry, not to
the run's README prose.

## Features covered

| Feature | Page updated | What became `observed` |
| --- | --- | --- |
| `show.slides.disabled` | `show/presenting.md` | the controller marker (class, computed `opacity: 0.2`, Enable button on exactly the disabled cards); Space-start skips entry 0; next skips a disabled entry; previous skips it in reverse; clicking a disabled card plays it (two different entries); a played disabled slide still advances normally |
| `out.multiple.specific` | `outputs/multiple-outputs.md` | a slide binding targets exactly the bound outputs; an advance skips a slide bound elsewhere; the per-item (textbox) output filter; a stored output **name** resolves as binding identity; a bound slide reaches an inactive output; a stale binding falls back to the active outputs |
| `out.lock` | `outputs/output-window.md` | the global lock blocks a slide-card click; it blocks the per-layer F3; it does **not** block the per-output lock toggle; `Clear all` skips an inactive output |
| `out.layers` | `outputs/output-window.md` | layer presence with content on both pages; the document order background → underlay (below the slide) → slide → ordinary overlay; the controller's per-layer enabled/disabled state with content in three layers |

`parity/features/show.yaml` was created with the `show.slides.disabled` entry;
`parity/features/outputs.yaml` gained `out.multiple.specific` and its `out.lock`
and `out.layers` entries were refreshed, with the two new runs named in the file
header.

## Label counts

Upgraded this pass: **20** claims/bullets from `code`/`unknown` to `observed`,
each cited on the page to a run directory + step file:

- `show.slides.disabled` — 6: controller marker (`05-disabled-markers.json`),
  start skip (`06-start-skips-disabled.json`), next skip
  (`08-next-skips-disabled.json`), previous skip
  (`09-previous-skips-disabled.json`), click plays a disabled card on two entries
  (`10-click-disabled-plays.json`, `11-click-first-disabled-plays.json`),
  advance-from-disabled (`12-advance-from-disabled.json`).
- `out.multiple.specific` — 7: baseline fan-out of an unbound slide
  (`05-start.json`), bound target (`06-click-bound-slide.json`), advance skip
  (`07-advance-skips-bound.json`), item filter (`05-start.json`), name identity
  (`09-bound-slide-to-inactive-output.json`), bound-reaches-inactive (same step),
  stale-binding fallback (`11-stale-binding.json`).
- `out.lock` — 4: click guard (`09-lock-blocks-click.json`), F3 guard
  (`10-lock-blocks-f3.json`), per-output toggle unguarded
  (`11-lock-allows-output-lock.json`), clear skips the inactive output
  (`13-clear-skips-inactive-output.json`, confirmed by
  `14-reselect-and-play.json`).
- `out.layers` — 3: layer presence with content (`06-layer-order.json`),
  document order incl. the underlay slot (`06-layer-order.json`), controller
  per-layer state (`07-layer-buttons.json`).

Claims that **stayed `code`/`unknown`** (the runs did not observe them):

- `show.slides.disabled` — the right-click Disable/Enable menu and the group-view
  parent → child propagation (the flag was seeded), the `startShow` and show-button
  start paths, group navigation, slide timers skipping disabled entries,
  number-key/direct jumps, and per-arrangement enable/disable (one layout only).
- `out.multiple.specific` — the binding **menus** (`bind_to`, `bind_item`; the
  fields were seeded), textbox bindings driven through the UI, bindings on a stage
  output, a third output, and the "project moved" migration beyond the stale-id
  case. The `isOutputBound` name branch used by the *advance skip* was not
  isolated (name resolution was observed only on the bound-target path).
- `out.lock` — bounds lock (needs a mapped window, a window manager and a drag),
  F1/F2/F4 and the per-layer clear buttons (only F3 was fired), the media toggle,
  scenes, audio start/playlist/mic, remote commands and the guarded API actions,
  and the full list of what the global lock does not guard.
- `out.layers` — the rendered colour, z-index, opacity and filters (no pixels),
  the per-layer clear buttons themselves, scene/audio/timer as output-page layers,
  and visual stacking on a mapped projector.

## Page corrections

Line numbers below are the **pre-edit** ones; the audit entries quote the old
text and the pages themselves now carry the corrected wording.

- **`show/presenting.md:29-30`** cited `Slide.svelte:287, 562-568` for both the
  dimming and the "Enable" button. The button is
  `src/frontend/components/slide/Icons.svelte:112-119` (title
  `translateText("actions.enable")` at `:115`); `Slide.svelte` only carries the
  `disabled` class and the 0.2 opacity. Label stays `code` for the citation.
  Audit **`A-010`**.
- **`outputs/output-window.md:181-182`** said "A layer button is red while the
  layer has content and dark when the layer is clear". The `red` prop is passed
  unconditionally and content is signalled by `disabled`; a disabled button is
  repainted by the `button:disabled` rule. Corrected in the page, with the run
  confirming all five titled while three layers have content. Audit **`A-011`**.
- **`outputs/multiple-outputs.md:149-151`** said a stale binding "sends nothing";
  `11-stale-binding.json` shows both active outputs receiving `Bind five`
  (`output.ts:152-153`). **`:217-219`** asked whether a bound slide reaches a
  locked output and assumed it would not; `09-bound-slide-to-inactive-output.json`
  shows both pages receiving `Bind four` (`output.ts:151-155` vs `:699-714`).
  Both corrected in the page, and the open question closed. Audit **`A-012`**.

One precision on A-011, where the harness note and the step record disagree
slightly: the note said the "disabled + untitled" form holds for Background **and
Overlays**. The code (`ClearButtons.svelte:175`) drops the Overlays title only for
a `lockedOverlay`, and the step record shows an **empty** Overlays group still
titled `Clear overlays [F3]` while disabled (`06-start-skips-disabled.json` in the
disabled-slides run). The page therefore states what the code and the record
show: only Background's title tracks content; the other four keep theirs while
empty.

## Open questions resolved

- `multiple-outputs.md:217-219` — "how do two outputs both bound to the same slide
  behave when one is locked?" **Answered:** the bound branch ignores `active`, so
  the inactive output receives and paints the bound slide (step 09).
- `multiple-outputs.md:149-151` — the stale-binding edge case. **Answered:** it
  falls back to the active outputs (step 11).
- `multiple-outputs.md:144-147` — name-as-identity. **Answered** for the
  bound-target `resolveOutputIds` path (step 09 seeded the name `Secondary`).
- `output-window.md` open question "which actions the global lock does not guard".
  **One more entry observed:** the per-output lock toggle (step 11). The list
  stays open for the rest.
- `output-window.md:204-215` — the boundary "no background, overlay, audio or
  timer content existed". **Answered for presence and order** by the
  lock-and-layers fixture.
- `presenting.md` doc-vs-code — the doc's "keyboard navigation … will skip disabled
  slides … you can still click it". **The click and keyboard halves are now
  observed**; the timer half is not.

## Evidence caveats

- **No output PNGs.** Five page-screenshot timeouts in the bindings run and seven
  in the lock run (second window, llvmpipe) are recorded but are not step
  failures. Behaviour rests on each page's DOM text / layer tree
  (`outputs[]`, `layerTrees`, `showSlides`) plus the controller screenshot, not on
  output frames. This repeats A-005/A-007: the output windows were created hidden.
- **Behaviour, not pixels.** Nothing here establishes visual correctness. The
  layer claim is presence and document order; the "underlay is below the slide on
  a projector" reasoning is still `code` (nothing sets `z-index` on the layer
  roots, which is why document order is used as the proxy).
- **Seeded fields, not menus.** Every binding and every `disabled` flag was seeded
  on the layout entry, which is exactly where the menus write
  (`menuClick.ts:1198-1233`, `show.ts:435-453`), but the menus themselves were not
  driven.

## Recommended coverage for contracts/scenarios

- Read the layer-button state off `disabled`, never off the title, and never off
  the colour without pixels.
- A contract for `out.multiple.specific` must encode the two A-012 behaviours:
  bindings override `active`, and an unresolved binding list means "all active
  outputs", not "none".
- Unobserved and worth a later slice: slide timers skipping disabled entries; the
  right-click Disable/Enable menu and group propagation; number-key jumps on a
  disabled slide; bindings on a stage output; bounds lock on a mapped window.
- The disabled-slide marker's Enable button is localised (`actions.enable`), so a
  scenario should assert the class + computed opacity primarily and treat the
  button title as secondary, recording the locale.

## Note on the reference README

`docs/freeshow-reference/README.md` still carries a fixed `observed` count from
2026-11-11. This pass did not re-tally it; the three new runs are named in the
page headers and in `parity/features/*.yaml` instead. The orchestrator may want
the number replaced by a run list, or re-counted, as a separate edit.
