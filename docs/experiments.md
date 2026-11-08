# Experiments

Three questions that must be answered with measurements before product work
starts. Record results in `parity/reports/` — a conclusion without a number is
an opinion.

## Experiment 1 — Multi-window Dioxus and state recovery

**Question.** Can four independent `VirtualDom`s, each in its own window, share
one authoritative state publisher, and can any of them be closed and reopened
without losing presentation state?

**Why it is first.** Everything else depends on this. If it fails, the
architecture changes now, cheaply — not after porting hundreds of components.

### What is built

```
crates/core     domain stub, show engine (NEXT/PREVIOUS/GOTO), RenderHub
apps/desktop    controller window + N output windows
```

The controller exposes:

- `Open output ▸ Audience / Stage / Preview / Confidence` — each spawns a window
- master `NEXT` / `PREVIOUS` (the same command path a remote client will use)
- a live readout per output: `revision applied / current revision`
- a `Close` button per output, and `Reopen`

Each output window subscribes to `RenderHub`, renders the current slide, and
reports the revision it applied. No output holds a channel of its own.

### Procedure

1. Open all four outputs. Confirm all show revision *n*.
2. Press `NEXT` ten times, at ~2/second. Confirm every output reaches revision
   *n+10*.
3. Close the stage output. Press `NEXT` five times.
4. Reopen the stage output. **It must show the current slide**, not slide *n*.
5. Confirm its applied revision equals the engine revision within one second.
6. Repeat with a window closed across a *transition*, not just a slide change.
7. Leave all four open for 10 minutes; record RSS and CPU per process/WebView.

### Pass criteria

| Criterion | Target |
| --- | --- |
| State propagation, all four outputs | < 50 ms |
| Reopen → correct slide | < 1 s |
| Reopen → applied revision == engine revision | 100% of 20 trials |
| Closing one output changes engine state | Never |
| Closing the last output exits the app | Never |
| Output window steals focus on creation | Never |
| Four windows, static slide | 60 fps |
| Four windows, 10 min idle | no growth after warm-up, CPU < 5% |
| Memory, four outputs | recorded, not assumed |

### Also verify (isolation — easy to forget)

- Each window loads its own stylesheet; a style in one window does not affect
  another.
- `document::eval` issued from the controller cannot mutate an output's DOM.
- A panic in one output's render path does not take down the engine.

### If it fails

| Failure | Response |
| --- | --- |
| Windows leak despite teardown | Weak references audit; drop `WindowCloses` for `WindowHides` and cache the window |
| Recovery is stale or skipped | The `watch` receiver is being cloned after the publish; subscribe before snapshot |
| Reconciliation too slow at slide change | Renderer island: HTML subtree owned by JS, Rust supplies state only |
| Four WebViews exhaust GPU/memory | Reduce to two outputs per process, or native overlay for extra outputs |

---

## Experiment 2 — Renderer parity

**Question.** Can a real FreeShow lyric slide — actual CSS, autofit, outline,
shadow, background — be reproduced in Dioxus RSX at measurable parity?

**Why second.** It answers whether the visual contract survives the port, which
is the single most visible way a rewrite fails.

### Procedure

1. Choose one production slide with: two or more lyric lines, autofit, outline,
   shadow, a background image, and a non-default alignment.
2. Capture the original from the running Electron app at **1920×1080**,
   **1366×768**, **3840×2160** and **1080×1920** (portrait).
3. Port the DOM structure and CSS exactly; render the same slide from the Rust
   app through the same viewport sizes.
4. Diff: pixel, text bounding boxes, computed font size, element positions.
5. Repeat for a slide with an active transition, capturing the midpoint.

### Pass criteria

| Criterion | Target |
| --- | --- |
| Layout differences | No element ≥ 2 px from the original |
| Font size at each viewport | Within 1 px of the original |
| Colour | ΔE < 2 on text and background |
| Outlines/shadows | visually indistinguishable at 100% |
| Visible reflow at slide entry | none |
| Transition duration/curve | matches within one frame |

Any difference that cannot be closed is documented as a known deviation, with a
screenshot, before it is accepted.

---

## Experiment 3 — Video across output windows

**Question.** What does the same 1080p clip actually cost when four WebViews
play it at once?

**Why third.** It decides the media architecture. Everything else about media is
guesswork until this is measured.

### Procedure

1. Play the same 1080p H.264 clip in one, two, then four output windows,
   synchronised to the same start instant.
2. Record: CPU per process, GPU utilisation, RSS, dropped frames, A/V drift over
   10 minutes.
3. Repeat with a 4K clip.
4. Check whether hardware decode is actually engaged (not merely available).

### Pass criteria

| Criterion | Target |
| --- | --- |
| Dropped frames, four windows, 1080p | 0 over 10 min |
| A/V drift | < 40 ms over 10 min |
| CPU, four windows, 1080p | < 60% of the machine |
| Hardware decode engaged | confirmed, not assumed |
| 4K in four windows | measured; acceptable or explicitly out of scope |

### If it fails

Native video overlay for outputs beyond one, or GStreamer with a shared decode
and per-output surface. Do not stream decoded frames into the WebView.

---

## Recording results

`parity/reports/experiment-N-<date>.md`, containing: the commit hash, the
machine (CPU/GPU/driver, X11 or Wayland), the raw numbers, the pass/fail against
each criterion, and the decision taken. Link it from this file.
