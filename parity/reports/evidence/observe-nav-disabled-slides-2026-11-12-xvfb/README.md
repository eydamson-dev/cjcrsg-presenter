# Observed: disabled slides in the reference

What the pinned reference does with disabled slides: the controller marks them
dimmed with an Enable button, and navigation skips them — while a click plays
them anyway.

| | |
| --- | --- |
| Reference | FreeShow `1.6.8-beta.3` at `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (`commitMatchesPin: true`) |
| Driver | `parity/tools/observe_reference.mjs`, scenario `nav-disabled-slides` |
| Run | 2026-11-12, Xvfb display `:90` (1920×1080), controller viewport 1600×900 |
| Result | `12/12` steps, `failed: []` (`run.json`), 21 screenshots, 0 capture problems |
| Fixture | seeded `Parity Nav`: five flat slides, `Nav one`…`Nav five`; layout entries 0 and 3 `disabled` |

## What each step recorded (`observed`)

| Step | Observed |
| --- | --- |
| `disabled_markers` | the show view draws five cards; exactly cards 0 and 3 carry `disabled`, render at computed `opacity: 0.2`, and expose an `Enable` button; cards 1/2/4 do not |
| `start_skips_disabled` | one Space from an empty output put **`Nav two`** on the output (entry 0 is disabled); `Nav one` never appeared |
| `next_skips_disabled` | one Space skipped the disabled entry 3 and landed on **`Nav five`**; `Nav four` never appeared |
| `previous_skips_disabled` | ArrowLeft skipped back over entry 3 to **`Nav three`**; `Nav four` never appeared |
| `click_disabled_plays` | clicking the body of disabled card 3 put **`Nav four`** on the output — the click path has no disabled check; the card stays `disabled` (playing does not enable it) |
| `click_first_disabled_plays` | clicking disabled card 0 played **`Nav one`** — the skip is not special to entry 0 |
| `advance_from_disabled` | Space from a played disabled slide advances normally to `Nav two` (playing it does not wedge navigation) |

Raw artefacts: `steps.json`, `NN-<step>.json`, `NN-<step>-controller.png` /
`-output.png`, `run.json`, `seed.json`, `run.log`, `electron.log`.

## What this run does not show

- **The right-click menu that writes `disabled`** — the flag was seeded on the
  layout entry; the menu is not driven. The run proves the seeded flag is
  honoured.
- **Group parent → child disable**, slide timers skipping disabled entries,
  number-key/direct jumps, and per-arrangement enable/disable — all out of scope.
- **`startShow` (`showActions.ts:571-574`) is not the path Space takes.** One
  Space from an empty output goes through `OutputHelper.getNextSlide`, the same
  skip loop; the run proves the behaviour, and the citation should name that path.
