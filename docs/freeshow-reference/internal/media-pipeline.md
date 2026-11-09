# Media pipeline

- **Area:** internal
- **Online docs:** [Media](https://freeshow.app/docs/media),
  [NDI](https://freeshow.app/docs/ndi), [Output stream](https://freeshow.app/docs/outputstream)
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

Media is handled in the Electron main process and delivered to outputs through
several paths: direct file playback, captured frames (screens and cameras), NDI,
OMT and RTMP/WebRTC streaming. Thumbnails and provider media have their own cache.

## Capture

`src/electron/capture/`:

| File | Role |
| --- | --- |
| `CaptureHelper.ts` | Chooses and starts a capture source |
| `CaptureOptions.ts` | Source and format options |
| `SenderCapture.ts` | Sender side of a capture stream |
| `senderWorker.ts`, `senderWorkerHost.ts`, `SenderThread.ts` | Worker process that produces frames |
| `FrameServer.ts` | Serves frames to consumers |
| `PreviewStream.ts` | Preview frames for the UI |
| `streamFrames.ts` | Shared frame transport |
| `StreamReceiverHost.ts`, `streamReceiverProcess.ts` | Receives frames |

## NDI and OMT

| Path | Files | Notes |
| --- | --- | --- |
| NDI | `src/electron/ndi/NdiSender.ts`, `NdiReceiver.ts`, `ndiWorker.ts`, `talk.ts` | Stream name is `FreeShow NDI` plus ` - <output name>` (`NdiSender.ts:93`) |
| OMT | `src/electron/omt/OmtSender.ts`, `OmtReceiver.ts`, `omtWorker.ts` | Open Media Transport alternative, not described in the docs |

NDI is enabled per output; the published docs say it is not supported on Linux
and that the default frame rate is 30 fps.

## Streaming and recording

`src/electron/streaming/`:

- `RtmpStreamer.ts`, `RtmpBridge.ts` — RTMP output.
- `ffmpegManager.ts` — bundled ffmpeg process management.
- `encoderProfiles.ts`, `encoderDetection.ts` — encoder choice.
- `WebRtcHost.ts` — WebRTC output.
- `OutputRecording.ts` — records an output.

The output stream client (port 5513) is a separate path: it records the output
window and sends frames to connected devices, so the output window must be active.

## Thumbnails and cached media

- Thumbnails are cached under `media-cache` in the app data path, falling back to
  the system temp folder (`src/electron/data/thumbnails.ts:143-151`).
- Provider media is cached in `protected-cache`, encrypted at rest, with a 30-day
  maximum age (`src/electron/data/protected.ts:16-18,24-30`).

## Consequences for a port

- NDI, OMT and RTMP are host integrations, not presentation logic. They can be
  deferred without changing slide behaviour, but the output's frame production
  must exist first.
- The output stream client depends on an active output window; it is not a
  headless frame generator.
- The name of an NDI stream is observable to OBS and therefore part of parity.

## Open questions

- Frame format, colour space and timing per path were not traced.
- Which encoder is selected on a given machine is runtime-dependent and was not
  measured.
