# Calibration — 2026-11-09

Purpose: measure the noise floor before any visual threshold is chosen. Two
captures of the same slide, same machine, same browser, minutes apart.

## Method

`parity/tools/capture_freeshow.mjs`:

1. Open the FreeShow remote (5510) with the fixture project loaded.
2. Select the `Parity Fixture` show.
3. Screenshot the `.slide` preview element.
4. Wait 700 ms, screenshot again.
5. Compare raw RGBA bytes channel by channel (via `sharp`).

## Result

| | |
| --- | --- |
| Capture size | 286 × 186 (53,196 px) |
| Differing channels | **0** |
| Max channel delta | **0** |
| Mean channel delta | **0** |
| Comparable | yes |

Raw: `/tmp/parity-capture/calibration.json` (captures `slide-a.png`, `slide-b.png`).

## What this means

Static content in Chromium on this machine is **bit-identical across runs**. A
zero-tolerance pixel comparison is therefore viable for same-engine captures,
and any non-zero difference is real change rather than noise.

That sets the visual gate for the Chromium target: no noise allowance is needed
for static slides. Moving elements (clocks, timers, video) get masked regions
instead of a tolerance, since a tolerance would hide real drift.

## Caveats

1. **This is the remote's slide preview, not a full output window.** The
   preview uses the same slide components and CSS, so it is representative, but
   the real output path should be calibrated once the stage layout is configured.
2. **Same engine only.** This says nothing about Chromium vs WebKit. The WebKit
   comparison still needs its own calibration, and that is where differences are
   expected to appear.
3. **One size, one machine, one GPU.** Font rendering can differ with scale
   factor and GPU state; the run is at 1400×900, scale factor 1.

## Next

Calibrate the WebKit side once the renderer exists (Experiment 2), then use the
difference between the two floors to set the WebKit gate.
