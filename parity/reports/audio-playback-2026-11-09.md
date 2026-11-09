# Audio playback — 2026-11-09

A defect, its fix, and the first measurement that audio actually plays in the
app.

## The defect

Imported media items defaulted to `muted: true`. That is right for video — a
WebView only autoplays muted media — but for an **audio** item it means the file
exists to be silent. Every imported MP3/WAV would have played to nobody.

**Fix.** The default now depends on the kind: audio is audible unless the item
says `muted: true`; video stays muted unless it says otherwise. An authored flag
always wins.

## Measured

A 10 s 440 Hz WAV as a media item, imported, bundled, then played by the real
app with the probe attached:

```text
t=1.693  network=1  paused=false  error=null
t=3.693
t=5.708
t=7.713
t=9.712
```

`currentTime` advances across the clip with `paused: false` and no error, so
WebKitGTK allows audible autoplay from this page. That was the open question:
many browsers block unmuted autoplay without a gesture, and an output window has
no gesture to give.

`totalVideoFrames` is 0, as expected for an audio element — the probe reports
both `<video>` and `<audio>` now, and frame counters only mean something for
video.

Raw: `evidence/audio/probe.log` and `audio.show`. The tone is generated, not
committed:

```bash
ffmpeg -f lavfi -i "sine=frequency=440:duration=10" -af "volume=0.15" tone.wav
```

## Tests

- an imported audio item is not muted; an imported video is; an authored
  `muted: true` on audio is honoured.

## Not done

- **No routing.** Audio mixes into the default device; FreeShow's per-channel
  routing and multi-device output are Phase 5.
- **No volume or fade.** The element plays at file volume; FreeShow has fades,
  ducking and a metronome.
- **No A/V drift measurement.** There is still no audio clock compared against
  video over time.
- **WAV only.** MP3/AAC/Opus depend on the WebView's decoders; one format proves
  the path, not the set.
- **WebView2 unmeasured.** Windows audio and its autoplay policy are untested.
