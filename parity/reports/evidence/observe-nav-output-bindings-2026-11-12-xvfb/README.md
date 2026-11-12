# Observed: specific-output bindings in the reference

What the pinned reference does when a slide or item is bound to chosen outputs:
only the bound outputs receive it, and an advance skips a slide bound elsewhere.
The run also settles two places where the source contradicts the page.

| | |
| --- | --- |
| Reference | FreeShow `1.6.8-beta.3` at `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (`commitMatchesPin: true`) |
| Driver | `parity/tools/observe_reference.mjs`, scenario `nav-output-bindings` |
| Run | 2026-11-12, Xvfb display `:90`, two normal outputs (`Primary`, `Secondary`) |
| Result | `11/11` steps, `failed: []` (`run.json`); 5 output-screenshot timeouts on the second window (recorded, not step failures) |
| Fixture | seeded `Parity Bindings`: five slides; item bound to `primary` on entry 0; slide bindings `["primary"]` (entry 1), `["primary","Secondary"]` (entry 3, id + name), `["ghost-output"]` (entry 4, stale) |

## What each step recorded (`observed`)

| Step | Observed |
| --- | --- |
| `start` | **both** pages show `Bind one`; **`Primary` also shows `Bind one, primary only`, `Secondary` does not** — the per-item output filter works |
| `click_bound_slide` | clicking entry 1 (bound `["primary"]`) puts `Bind two` on `Primary`; `Secondary` still shows `Bind one` (two stable reads ≥400 ms apart) — the bound-target `setOutput` |
| `advance_skips_bound` | one Space moves both to `Bind three`: `Primary` advances from entry 1, `Secondary` jumps entry 0 → 2, skipping the slide bound to another output |
| `bound_slide_to_inactive_output` | clicking entry 3 (bound `["primary","Secondary"]`) while `Secondary` is inactive puts `Bind four` on **both** pages — the bound branch does not consult `active` |
| `stale_binding` | clicking entry 4 (bound to a nonexistent `ghost-output`) puts `Bind five` on **both** pages — an unresolved binding falls back to the active outputs |

## Contradictions settled (against the page)

- `multiple-outputs.md:149-151` says a stale binding "sends nothing". **Observed:
  it falls back to the active outputs** (`output.ts:152-153`).
- `multiple-outputs.md:217-219` asks whether a bound slide still reaches a locked
  output; the parenthetical assumed the locked one is skipped. **Observed: the
  bound branch ignores `active` and writes to both** (`output.ts:151-155` vs
  `:699-714`).

Both are recorded as `A-012` material. A contract must not encode the page's
wording.

Raw artefacts: `steps.json`, `NN-<step>.json`, `NN-<step>-controller.png` /
`-output.png`, `run.json`, `seed.json`, `run.log`, `electron.log`.

## What this run does not show

- **The binding UI** (slide right-click "Specific outputs", `bind_item`) — the
  fields were seeded; the menu is not driven.
- **Bindings on stage outputs**, and the "project moved" migration beyond the
  stale-id case — out of scope.
- Pixels: the second output's window screenshots time out on llvmpipe; every
  claim rests on the two pages' DOM text.
