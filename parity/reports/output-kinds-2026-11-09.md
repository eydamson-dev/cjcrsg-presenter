# Output kinds — 2026-11-09

The four output windows were four copies of the live slide. Only the stage was
different. Each now shows what its name says.

| Output | Shows | Plays media |
| --- | --- | --- |
| Audience | the live slide | yes |
| Stage | live + next + notes + message + countdown | video muted, no audio |
| Preview | **the next slide** — the operator's look-ahead | no |
| Confidence | the live slide plus a large clock | yes |

FreeShow has no "confidence" output; the stage and preview are its surfaces. The
confidence view is our addition: a speaker-facing screen with the live slide and
the time. It is documented as an extension, not parity.

## Evidence

Rendered by the real components at 1920×1080. Left: Preview while the live slide
is a video — it shows the following slide, not the live one. Right: Confidence,
live video with the clock top-right, clear of the lyrics.

![Preview and confidence](evidence/output-kinds/montage.png)

Reports and raw pages: `evidence/output-kinds/preview/`,
`evidence/output-kinds/confidence/`, plus the two generated HTML files.

## Why preview must not play media

A preview that plays a video is a second decoder for content nobody is watching,
and a second audio source for content the congregation has not seen yet. It is
muted and paused by construction (`play_media: false`).

The stage follows the same rule: its video is muted and it renders no audio
element, so the four outputs decode four pictures but only the audience and the
confidence display can make sound.

## Tests

No new logic: the change is which published state a window projects, and the
renderer already had both. The evidence is the rendered pages; the existing 129
tests still pass.

## Not done

- **Preview is the next slide only**, not a browsable selection.
- **Confidence shows wall-clock time only** — no countdown, no service clock.
- **No per-output configuration.** Which output shows what is fixed by name; the
  UI cannot repurpose one.
