# Understanding — next at the end of a show (DEV-015)

- **Feature:** `nav.bounds.next-at-end`
- **Contract:** `docs/contracts/nav-next-at-end.md` (approved 2026-11-09)
- **Reference:** FreeShow `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (1.6.8-beta.3)
- **Pages read:** `docs/freeshow-reference/show/presenting.md` (§ End of show —
  observed, § Arrow keys/Page/Home/End, § Spacebar, § Settings, § State and
  persistence, § Doc vs code, § Open questions),
  `docs/freeshow-reference/getting-started/project-playlist.md` (§ proj, §
  Settings, § Open questions), `docs/freeshow-reference/WHAT-IS-THIS.md`,
  `USING-THIS.md`
- **Run report:** `parity/reports/reader/next-at-end-2026-11-09.md`
- **Written:** 2026-11-09, before any code change.

## Behaviour to implement, per contract clause

| Contract | Behaviour | Page section | Claims relied on |
| --- | --- | --- | --- |
| B1 | A selected project show distinct from the outputted slide. Both start on the first show with a slide; explicit navigation sets selected to the landed show; a selection-only change bumps the revision with no output change and no transition. | `presenting.md` § End of show — observed, and § Arrow keys… item 7 | The active/selected item moving independently of the output: **observed** (reader report, press 1; screenshot `screenshots/next-at-end-selected.png`). `openProjectItem` only sets `activeShow`, and only `playNext` paths play it: **code** (`OutputHelper.ts:130-194`, `project.ts:35-64`) — used only to explain the observed result, not as the requirement. |
| B2 | Next within a show advances one slide in one press, exactly as now. | `presenting.md` § Arrow keys… item 5; § End of show — observed, press structure | **observed** (reader run "start" → press 1 within a show; the observed table only changes at a show end). The in-show rule is also **code** (`getNextSlide`, `OutputHelper.ts:338-371`). |
| B3 | Next at a show end, setting on: press 1 selects the next show with slides (output unchanged), press 2 outputs its first slide; no wrap; no next show means no change. | `presenting.md` § End of show — observed; § Arrow keys… item 7 | **observed** for the two-press sequence, the unchanged output after press 1, and no change at project end. **observed** (spacebar section) for the same sequence driven by space. The no-wrap condition is **code** (`OutputHelper.ts:136-139`, `:255-264`) and matches the reader's project-end observation. |
| B4 | Setting off: next at a show end does nothing, including at the project end. | `presenting.md` § End of show — observed (off row); § Settings | **observed** (reader "off" run: four presses, no output or header change, capture `off-after-1-main.png`). Default on: **code** (`General.svelte:55`) confirmed by the reader run using the default profile. |
| B5 | Setting `next_item_on_last_slide`, default on, persisted; changing it changes neither output nor selection. | `presenting.md` § Settings, § State and persistence; `project-playlist.md` § Settings | Default/effect: **observed** (on by default in the run; off stops the move). Persistence of the setting itself: the page lists it as a FreeShow setting read from `special.nextItemOnLastSlide` (**code**), and the contract's own persistence requirement is the approved design, not a reference claim. |
| B6 | Controller top-bar control next to Focus: state label, toggles, survives restart, applies immediately and saves. | None on the reference page — the contract's Open questions leave placement to the implementer. | The underlying behaviour is **observed** (B3/B4). The control is a contract requirement, not a claim about FreeShow's UI. `project-playlist.md` § Open questions says where FreeShow edits the setting "was not traced", so the reference gives no placement to copy; the contract fixes it. |
| B7 | Outline marks the live show `current`/`live` and the selected show `selected`, live only when both coincide. | `presenting.md` § End of show — observed ("The captures show the main-window header moving to the next show while the output window still displays the previous slide") | **observed** (reader press-1 capture: header and project selection on Parity Fixture, preview and output on Welcome). The exact badge markup is our controller's existing pattern, not a reference claim. |

## Reference labels summary

- The two-step end-of-show move is `observed` (2026-11-09), which may be a
  requirement.
- The setting's off behaviour is `observed`.
- The default-on and the code path are `code`, and the contract was approved
  with them; the reader's on/off runs use the default and the explicit false.
- Nothing required by the contract is `unknown` or rests only on `doc`. The
  page's `doc` claims ("space goes to the next show") are contradicted by the
  observed run and are not used.

## Open questions and how they touch this work

- `presenting.md` § Open questions does not raise the end-of-show mechanism.
- `project-playlist.md` § Open questions asks where FreeShow edits
  `special.nextItemOnLastSlide`; it identifies no UI to copy. The contract
  chooses a controller top-bar control, so this does not block.
- The reader report asks whether the two-step rule generalises to three shows
  and what the output shows between presses. The contract fixes the
  generalisation (next show with at least one slide, no wrap) and the output
  (unchanged); both follow the observed mechanism.
- Out of scope in the contract: previous at the first slide, and sections as
  selectable items. Our `previous_slide` keeps walking back across show
  boundaries in one press, as today; it does not gain a two-step mirror.
