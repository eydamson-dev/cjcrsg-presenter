# Experiment 2 — renderer parity (first pass)

**Status:** measured. One aspect ratio matched; the vertical comparison needs a
true 16:9 reference, which the FreeShow preview cannot provide.

Date: 2026-11-09. Reference: FreeShow `ff784eb`, fixture
`parity-three-slides.show`, slide 1.

## Method

1. FreeShow remote (5510) loaded headless in Playwright; the selected show's
   `.slide` preview captured, with per-line boxes and computed styles.
2. Our renderer: `cjcrsg-presenter render <file.cjcp> out.html`, then the same
   metrics extracted from the same DOM shape in headless Chromium.
3. Pixel diff at equal width.

Both capture scripts are in `parity/tools/`:
`capture_freeshow_slide.mjs`, `capture_render.mjs`, `compare.mjs`.

## Result — horizontal metrics are identical

| | x | width |
| --- | --- | --- |
| FreeShow, line 1 | 0.277 | 0.4459 |
| Ours, line 1 | **0.277** | **0.4459** |
| FreeShow, line 2 | 0.2799 | 0.4401 |
| Ours, line 2 | **0.2799** | **0.4401** |

Font stack, weight and colour also match: `sans-serif`, 400, `rgb(255,255,255)`.

This is the important part. Glyph advance — the thing that decides where a line
ends and whether it fits — agrees exactly. The port is not approximating the
typography.

## The reference's own layout model

FreeShow's remote preview uses its `Zoomed` component, which lays out at a base
resolution (1920×1080 by default) and scales with
`min(containerWidth / 1920, containerHeight / 1080)`. That is exactly the model
this renderer now uses, so the two are directly comparable.

Two corrections followed from reading it:

- **Line height.** FreeShow's line box is ~112 px at 1080p, not 100. Adopting
  `line-height: 1.12` moved our text from y = 440 to y = 428 in logical space.
- **Letterboxing.** The preview container is 1.538:1, so the slide sits inside it
  with bars; the comparison has to crop to 16:9 first.

## After the correction

| | FreeShow | Ours | Delta |
| --- | --- | --- | --- |
| Line 1 top (px at 286 wide) | 63.9 | 63.75 | 0.15 |
| Line 2 top (px) | 80.3 | 80.4 | 0.10 |
| Line box height (px) | 16.69 | 16.68 | 0.01 |
| Line 1 x / width | 0.277 / 0.4459 | 0.277 / 0.4459 | 0 |

Every text box agrees within **0.15 px**.

## Pixel comparison — inconclusive at this size

Cropped to 16:9 (286×161): **12.0% differing pixels, mean channel delta 10.9**,
after searching ±3 px of vertical alignment for the best match.

That number is not a fidelity score. At 286 px wide the glyphs are ~14 px tall,
so a fraction of a pixel of rasterisation difference — antialiasing, hinting, the
transform's resampling — flips a large share of the ink pixels. The structural
comparison above is the reliable signal at this size; pixels need a full-size
capture.

## What this pass established

- Glyph metrics and horizontal layout match exactly. The renderer's text model
  is correct.
- Our renderer previously **reflowed** while FreeShow **scales a fixed logical
  surface**. That was a real architectural difference, now fixed: slides lay out
  at 1920×1080 and scale to the window via `--slide-scale`.
- FreeShow stores each line as its own element; we now do the same, which is
  what made the metrics comparable at all.
- The remote preview cannot serve as the visual reference: it is 1.538:1, not
  16:9.

## Next

1. Capture a true 16:9 FreeShow output — the Electron main window at 1920×1080,
   or the output stream (5513) — and re-run both captures at the same logical
   size.
2. Only then set a visual threshold. The calibration run showed Chromium is
   bit-identical to itself, so any residual difference will be real.
3. Repeat on a slide with autofit, outline and a background, which is where
   parity is actually at risk.

## Evidence

| File | What it is |
| --- | --- |
| `evidence/experiment-2/freeshow.png` | FreeShow's preview of the fixture slide |
| `evidence/experiment-2/ours.png` | Our render, same width |
| `evidence/experiment-2/diff.png` | Pixel difference, amplified |
| `evidence/experiment-2/*-metrics.json` | Raw boxes and computed styles |

![FreeShow, cropped](evidence/experiment-2/freeshow-cropped.png)

![Ours](evidence/experiment-2/ours-final.png)

![Difference](evidence/experiment-2/diff-cropped.png)
