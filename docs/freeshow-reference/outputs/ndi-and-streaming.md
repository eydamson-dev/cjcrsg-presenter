# NDI and livestreaming

- **IDs:** `out.ndi`, `out.livestream`
- **Area:** outputs
- **Online docs:** [NDI](https://freeshow.app/docs/ndi),
  [Livestreaming](https://freeshow.app/docs/livestreaming)
- **Pinned code:** ff784eb388c7baef60d67e6d4e7c504f4322bca3
- **Confidence:** `code` for the implementation, `doc` for the Linux support
  claim

## Summary

NDI sends an output over IP as a named stream that OBS or vMix can receive; it
is one capture target among several (OMT, Blackmagic, WebRTC, RTMP, recorder).
"Livestreaming" in the docs is not a FreeShow output type: the recommended route
is NDI into OBS, and FreeShow can additionally drive OBS over its WebSocket.

## <a id="outndi"></a>`out.ndi` — NDI output

**Enabling.** `outputs[id].ndi` is set when an output is created as an NDI
network output (`OutputsTabs.svelte:142`) or toggled in the output's NDI section
(`Outputs.svelte:423-447`). Changing it recreates the window, because capture
mode is fixed at creation (`Outputs.svelte:75-85`). Creating an NDI output also
sets `invisible` and `transparent` (`OutputsTabs.svelte:135-139`), so the usual
NDI output is an offscreen surface, not a window.

**Stream name.** Default `FreeShow NDI - <output name>`
(`NdiSender.ts:92-94`; the settings field shows the same default,
`Outputs.svelte:434`). A custom `ndiData.name` overrides it; the setting warns
that changing name or group needs a restart (`Outputs.svelte:118-138`).

**Group.** `ndiData.groups`, a comma-separated string, default placeholder
`public` (`Outputs.svelte:435`).

**Frame rate.** `ndiData.framerate`, default `"30"`; choices 10, 12, 24, 25, 30,
48, 50, 60 (`Outputs.svelte:235-244,430`). Internally the capture defaults are
30 fps while a receiver is connected and 1 fps while none is
(`CaptureHelper.ts:16-24,39-50`), and the rate is re-read when the connection
count changes (`:86-93`; NdiSender status handler `NdiSender.ts:57-69`). This
matches the docs' "default is 30 fps" (`source/docs/ndi.md:20`).

**Transparent.** `outputs[id].transparent`; a switch in the NDI section, default
on when the output was created as NDI (`Outputs.svelte:439`;
`OutputsTabs.svelte:138`). Transparent frames are packed as UYVA instead of UYVY
(`ndiWorker.ts:116-121,132-135`). The docs call this "send e.g. just the text"
(`source/docs/ndi.md:22`).

**Lifecycle.** `createOutput` creates the NDI sender after the window, using the
resolved name and groups (`OutputLifecycle.ts:142-146`); the sender is destroyed
in `removeOutput` (`:1525`). Capture starts 1200 ms after creation so the page is
ready (`:134-140`), with the NDI flag from the output (`:139`). An output is only
captured for NDI when `output.ndi` is true (`helpers/output.ts:976-1000`).

**Connection status.** The sender reports `status` and `connections`; the main
window stores them in `ndiData`, which drives the blue status dot
(`NdiSender.ts:57-76`; `OutputPreviewLabel.svelte:43,51`).

**Platform support (`doc`).** The docs say NDI "is currently not supported by
Linux" (`source/docs/ndi.md:20`). The code has no platform gate: the NDI addon
is loaded dynamically in the sender worker (`ndiWorker.ts:13-33`) and the Linux
build unpacks it rather than excluding it
(`config/building/electron-builder.yaml:49-51`; the Windows/macOS exclusions are
in `files` at `:30,75`). Whether it actually loads on Linux is `unknown`; see Open
questions.

**Other capture targets in the same section.** OMT, Blackmagic, WebRTC and RTMP
each have their own flag and data, and the same hidden-window pattern
(`src/types/Output.ts:21-33`; `Outputs.svelte:390-421`).

## <a id="outlivestream"></a>`out.livestream` — OBS control

- There is no FreeShow "livestream output". The docs recommend NDI into OBS for
  transparency (`source/docs/livestreaming.md:8`).
- OBS control is opt-in: **Settings → Connection → OBS Studio Controller**, with
  IP (default `localhost`) and port (default `4455`)
  (`Connection.svelte:401-420`). The drawer tab appears only when enabled
  (`FunctionsTabs.svelte:100`).
- The drawer's OBS page connects over `ws://<ip>:<port>` and speaks the
  obs-websocket protocol: op 7 request responses and op 5 events
  (`obsTalk.ts:42-60`; `OBS.svelte:60-159`).
- It exposes: scene list and scene switching, source visibility, scene
  transitions, an audio mixer (mute, per-channel level meters), and
  Start/Stop Streaming and Recording (`OBS.svelte:204-250,255-367`).
- Connection errors are mapped to messages for WebSocket codes 1006, 1001 and
  4009 (`obsTalk.ts:51-60`).
- The same operations exist as actions: Set scene, Start/Stop livestream,
  Start/Stop recording (`actionData.ts:117-122`).
- The docs' setup step "enable the WebSocket server in OBS under Tools →
  WebSocket Server Settings" is `doc` (`source/docs/livestreaming.md:12`); the
  code only consumes the resulting socket.

## Settings

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| NDI on | `outputs[id].ndi` | absent | Creates a sender + capture |
| NDI name | `outputs[id].ndiData.name` | `FreeShow NDI - <name>` | Stream name |
| NDI group | `outputs[id].ndiData.groups` | `""` (`public` placeholder) | NDI group |
| NDI frame rate | `outputs[id].ndiData.framerate` | `"30"` | Sender frame rate |
| Transparent | `outputs[id].transparent` | absent (on for new NDI) | Alpha output |
| Invisible | `outputs[id].invisible` | absent (on for new NDI) | No window |
| OBS enabled | `obsData.enabled` | `false` | Shows the OBS drawer tab |
| OBS IP / port | `obsData.ip` / `obsData.port` | `localhost` / `4455` | WebSocket target |

## Code

- `src/electron/ndi/NdiSender.ts:57-117`
- `src/electron/ndi/ndiWorker.ts:13-33,99-152`
- `src/electron/output/helpers/OutputLifecycle.ts:134-156,1525`
- `src/electron/capture/CaptureHelper.ts:16-50,86-93`
- `src/frontend/components/settings/tabs/Outputs.svelte:423-447`
- `src/frontend/components/settings/tabs/OutputsTabs.svelte:135-145`
- `src/frontend/components/settings/tabs/Connection.svelte:401-420`
- `src/frontend/components/drawer/pages/OBS.svelte:41-250`
- `src/frontend/utils/obsTalk.ts:42-60`
- `src/frontend/components/actions/actionData.ts:117-122`
- `config/building/electron-builder.yaml:30,49-51,75`

## Doc vs code

- `doc` says NDI is not supported on Linux (`source/docs/ndi.md:20`). Code has no
  platform guard and the Linux build unpacks the addon
  (`ndiWorker.ts:13-33`; `electron-builder.yaml:49-51`). Code cannot prove the
  native module loads; recorded as `doc` versus "no gate found".
- `doc` says the stream is `FreeShow NDI - output name`
  (`source/docs/ndi.md:32`). Code's default matches, but a custom name replaces
  the whole string rather than appending (`NdiSender.ts:92-94`).
- `doc` places the Invisible setting "under NDI settings"
  (`source/docs/output.md:98`). It is a general output flag set at creation
  (`OutputsTabs.svelte:135-139`).
- `doc` says livestreaming is done by "sending NDI outputs to OBS"
  (`source/docs/livestreaming.md:8`). The output settings also offer direct
  WebRTC and RTMP streaming (`src/types/Output.ts:29-33`; `Outputs.svelte`
  sections for both), which the livestreaming page does not mention.

## Open questions

- Does the NDI addon load on Linux at this pin? The docs say no, the packaging
  and loader suggest it may; a run on Linux with the NDI runtime installed would
  settle it.
- Whether audio is sent to NDI by default: there is an audio sender
  (`NdiSender.ts:158-169`), but what routes audio into it, and whether it is on
  by default, was not traced.
- Whether a transparent NDI output shows the style background: the output page
  makes the backdrop transparent when `output.transparent`
  (`Output.svelte:336`), which implies the style background colour is not sent,
  but the background *image* path was not checked separately.
