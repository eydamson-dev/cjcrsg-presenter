# Observed: output styles in the reference

What the pinned reference actually does with per-output styles: three normal
outputs sharing one show, each bound to a different style, rendering the same
slide with a different aspect ratio, a different line window, and a different set
of visible layers.

| | |
| --- | --- |
| Reference | FreeShow `1.6.8-beta.3` at `ff784eb388c7baef60d67e6d4e7c504f4322bca3` (`commitMatchesPin: true`) |
| Driver | `parity/tools/observe_reference.mjs`, scenario `styles-multi-output` |
| Run | 2026-11-12, `xvfb-run` virtual display (`:99`, 1920×1080), controller viewport 1600×900 |
| Result | `10/10` steps, `failed: []` (`run.json`) |
| Fixture | seeded styles show `Parity Styles`: slide 1 = four text lines with `logo.png` as its layout background, slide 2 = two lines |
| Seeded | `settings_synced.json` `styles`: `style-lines2` (`lines:2`), `style-43` (`aspectRatio 4:3`), `style-nobg` (`layers:["slide","overlays"]`); outputs `Primary`→`style-lines2`, `Secondary`→`style-43`, `Tertiary`→`style-nobg` |

## What each step recorded

| Step | Observed (`observed`) |
| --- | --- |
| `ready` / `open_project` / `open_show` | controller up; the show opens |
| `present_outputs` | one Present click opens all three outputs; each page names its own seeded output id |
| `start` | all three outputs show slide 1's first page |
| `styles_aspect` | the `aspectRatio`-less output renders **16:9**; the `aspectRatio 4:3` output renders **4:3** on the same output bounds — both content boxes fill the window height, so the 4:3 box is narrower (letterboxed horizontally) |
| `styles_lines_window` | the `lines:2` output shows **exactly lines 1–2** of the four-line slide; the `lines:0` output shows **all four** lines |
| `styles_lines_paging` | one advance moved the `lines:2` output to **lines 3–4** while the `lines:0` output still shows the whole slide and the presentation **stayed on slide 1** — the 2-line output set the shared page size (`getFewestOutputLines`) |
| `styles_layers` | the `layers:["slide","overlays"]` output does **not** render the background layer (no image, no video) but still renders the slide layer's text; the default-layer output renders the slide's image background |
| `styles_attach` | all three outputs still show the same page of the same slide with their own aspect, line window and layer visibility — per-output style applies to shared content |

Raw artefacts: `steps.json` (all 10 records), `NN-<step>.json` (one per step),
`NN-<step>-controller.png`, four `NN-<step>-output.png` (steps 07–10, the one
output whose surface llvmpipe did capture), `run.json`, `seed.json`, `run.log`,
`electron.log`.

## What this run does not show

- **Output PNGs for every output.** 17 `page.screenshot` timeouts are recorded
  (llvmpipe); only the primary output's surface was captured from step 07 on. The
  evidence for each output is its **DOM/geometry state** (`NN-<step>.json` →
  `outputs[]` → `contentBox`, `viewportBox`, `videos[]`, `images[]`, `text`).
- **The Styles settings UI.** The styles were seeded (`settings_synced.json`),
  not edited in Settings > Styles. The live re-render on edit (`refreshOut`) is
  therefore not observed and stays `code`.
- **`showAsFaded` / `lineOpacity` / `fontSizeRatio` / `outputResolutionAsRatio`**
  and deleting a style still referenced by an output — open questions on the
  page, not exercised.
- **Pixel correctness / presets.** One seeded non-default ratio proves the
  mechanism; it is not a sweep of the aspect presets and not a visual diff.
