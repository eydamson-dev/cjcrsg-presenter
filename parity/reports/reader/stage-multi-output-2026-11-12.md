# Reader report — stage + multiple outputs (observed run)

Date: 2026-11-12
Reference: FreeShow `ff784eb388c7baef60d67e6d4e7c504f4322bca3`
(`package.json` version `1.6.8-beta.3`), `commitMatchesPin: true`. The reference
checkout is read-only; this report only relabels claims the run established.

Scope: record the `observed` claims from a fresh reference run of the
**stage + multiple outputs** Tier 1 slice, and upgrade exactly those claims from
`code` to `observed` on the reference pages. The run was already done and
committed; this report does not re-run anything.

Evidence: `parity/reports/evidence/observe-stage-multi-output-2026-11-12-workspace/`
— scenario `stage-multi-output`, 14/14 steps, `failed: []` (`run.json`).

## Features covered

| Feature | Page updated | What became `observed` |
| --- | --- | --- |
| `out.multiple` | `outputs/multiple-outputs.md` | several outputs at once, each its own window; a command fans out to active normal outputs; disabling one destroys its window and leaves the others untouched |
| `out.multiple.select` | `outputs/multiple-outputs.md` | title bar per tile; plain title-bar click toggles `active`; last active normal output snaps back and toasts |
| `out.stage-window` | `outputs/multiple-outputs.md` | stage output renders the layout (page reports `stageArea:true`), not the slide; always active (title-bar button offers no output lock, clicking leaves it active) |
| `stage.items` | `remote/stage.md` | `slide_text` `slideOffset` 0 = current, 1 = next, shown simultaneously |

`parity/features/outputs.yaml` gained three `observed` entries (`out.multiple`,
`out.multiple.select`, `out.stage-window`) and its header now names the
`stage-multi-output` run.

## Label counts

Upgraded this pass: **9** claims `code` → `observed` (the three `out.multiple`,
three `out.multiple.select`, two `out.stage-window`, one `stage.items` claims as
listed by the orchestrator). Each is annotated on its page and cited to the run.

Claims that **stayed `code`** (the run did not observe them):

- `out.multiple.specific` — slide/textbox output bindings (not exercised).
- `out.multiple.select` — Ctrl/Cmd-click to select one output, and the title-bar
  right-click context menu (only plain clicks were driven).
- `out.stage-window` — the fan-out *exclusion mechanism* (`output.ts:699-703`);
  the run observed the stage *mirroring* its source output on advance, which is
  consistent with exclusion but does not isolate it.
- `stage.items` — the negative (`previous`) `slideOffset` and the
  skip-disabled-slides lookup rule (only offsets 0 and 1 were seeded).
- `stage.url` and `stage.layouts` editing UI (grid, New layout, disable,
  password, source-output dropdown) — the run drives output *windows*, not the
  stage web client or the layout editor.

No `doc` or `unknown` claims were touched.

## Page corrections

None. The `code` claims on both pages were **confirmed**, not contradicted, by
the run, so this is a relabel (upgrade), not a correction. No audit entry was
added (`audit.md` next free number remains `A-008`).

## Evidence for the visual caveat

The output *windows* were created hidden (`visible:false`) and Playwright's
`page.screenshot` timed out on llvmpipe for all three outputs (32 capture
problems in `run.json`). Each output is therefore evidenced by its DOM text
(`NN-<step>.json` → `outputs[]`, including the `stageArea` flag) and the
controller screenshot showing the preview tiles — not by an output PNG. This is
recorded on the pages' Observed sections and the run's README "does not show".
`out.window`'s existing "an output page can render while the window is hidden"
finding (A-005) holds here too.

## Recommended coverage for contracts/scenarios (for the scenario author)

- Fan-out: start/advance with 0, 1, 2 active normal outputs, and with one bound
  slide (the branch this run did not reach).
- Selection: Ctrl/Cmd-click select-one, and the title-bar right-click menu
  (Toggle / Move to front / Hide from preview).
- Stage: `slideOffset` negative (previous), and the skip-disabled-slides rule
  (a disabled slide between the live and the next).
- Disable/enable: whether a re-enabled output repaints the current slide or
  keeps its last `out.slide` (the run recorded it but did not assert it — the
  source did not establish which).
