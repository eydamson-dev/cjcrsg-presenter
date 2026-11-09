# Output drift over ten minutes — 2026-11-09

Experiment 3's criterion was "A/V drift < 40 ms over 10 min". This measures the
closest thing the app can currently expose: **how far the outputs' media clocks
move apart** while playing the same clip.

## Method

- The real app, four output windows on a 10-minute 1080p30 VP9 clip. Preview
  shows the next slide, so three surfaces decode: Audience, Stage, Confidence.
- The probe samples each output every 2 s. `parity/tools/measure_drift.py`
  interpolates the Audience's media time at each other output's sample instant —
  a nearest-sample comparison would carry a sample interval of error — and
  reports the offset at the first and last comparison.
- **Offset** is not drift: outputs open a fraction of a second apart, so each has
  a constant offset (Stage −298 ms, Confidence −792 ms). **Drift** is how much
  that offset changed over the run.

## Numbers

| Comparison | Samples | Duration | Offset start | Offset end | **Drift** |
| --- | --- | --- | --- | --- | --- |
| Stage vs Audience | 296 | 592 s | −298.4 ms | −292.6 ms | **5.8 ms** |
| Confidence vs Audience | 298 | 595 s | −791.8 ms | −790.2 ms | **1.6 ms** |

Against the 40 ms target: inside it, by roughly an order of magnitude.

Raw: `evidence/media/drift10m/summary.json`, `probe.log`.

## What this is not

- **Not A/V sync.** No audio clock was compared. Two media elements inside one
  output are the WebView's responsibility; audio *across* outputs is the case
  this measurement speaks to, and only for video clocks.
- **Not synchronised starts.** The offsets are real: outputs do not begin on a
  shared instant. A multi-room deployment would need a start gate; today the
  windows open in sequence.
- **VP9 on WebKitGTK**, three surfaces, one machine, software decode. WebView2
  and hardware decode are unmeasured.
- **Sampling, not instrumentation.** The probe reads `currentTime`; the
  interpolation is only as good as the 2 s cadence. Sub-millisecond claims would
  be dishonest; "single-digit milliseconds over ten minutes" is what the data
  supports.

## Witnessed along the way

The same run confirmed the 10-minute frame result: 296–298 samples, no stalls,
both comparisons spanning the full clip.
