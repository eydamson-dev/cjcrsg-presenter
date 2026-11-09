# Action catalogue

- **ID:** `actions.types`, `functions.actions`, `sys.action-data`
- **Area:** drawer
- **Online docs:** <https://freeshow.app/docs/actions> · <https://freeshow.app/docs/api>
- **Pinned code:** ff784eb (1.6.8-beta.3)
- **Confidence:** `code`

> Every row below was read from the pinned source. Where a row says "delegates
> to X", the call and the callee name were read; X's own behaviour was not opened
> unless a second reference is given. See Open questions for the handler families
> left at that level.

## How this table was generated

- The **UI registry** is `src/frontend/components/actions/actionData.ts`. It held
  **93** entries at the pin (one per `^    [a-z_0-9]+: {` line).
- The **handler table** is `API_ACTIONS` in
  `src/frontend/components/actions/api.ts:214-443`. It held **164** handlers.
- The action picker shows a handler only when it also has a registry entry, plus
  the special `wait` (`src/frontend/components/actions/CreateAction.svelte:81-125,94`).
  So: 92 registry ids exist in `API_ACTIONS`, `wait` does not, and 72 handlers are
  API-only.
- English labels are from `public/lang/en.json` (the `actions`, `preview`, `clear`,
  `tabs`, `edit`, `settings` and `animate` blocks). Where a key has no entry at the
  pin, the key is shown and the row says so.
- "Flags" lists the registry flags that change behaviour: `common` (offered in the
  short list), `canAddMultiple`, `red` (destructive styling), `slideId` (legacy
  slide action key), and `incompatible` (mutually exclusive with the listed ids).
- "Ref" is `src/frontend/components/actions/api.ts:<line>` unless another file is
  named. Registry refs are `actionData.ts:<line>`.

## Registry actions (93)

| # | ID | Name | Input | What it does | Flags | Ref |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id_select_project` | Open project | `id` | delegates `selectProjectById(id)` | incompatible `index_select_project`; registry 3 | api 216 |
| 2 | `index_select_project` | Open project at index | `index` | delegates `selectProjectByIndex(index)` | registry 4 | api 217 |
| 3 | `next_project_item` | Next project item | — | delegates `selectProjectShow("next")` | registry 5 | api 219 |
| 4 | `previous_project_item` | Previous project item | — | delegates `selectProjectShow("previous")` | registry 6 | api 220 |
| 5 | `index_select_project_item` | Open project item at index | `index` | delegates `selectProjectShow(index)` | registry 7 | api 221 |
| 6 | `name_start_project_item` | Start project item by name | `strval` | delegates `startProjectItemByName(value)` | registry 8 | api 222 |
| 7 | `mark_active_as_played` | Mark as played | `toggle` | `markItemsAsPlayed("active", value)` | registry 9 | api 223 |
| 8 | `unmark_all_as_played` | Reset all mark as played | — | `markItemsAsPlayed("all", false)` | registry 10 | api 224 |
| 9 | `id_select_show` | Open show | `start_show` | delegates `selectShowById(id)` | registry 13 | api 227 |
| 10 | `name_select_show` | Open show with name | `strval` | delegates `selectShowByName(value)` | registry 14 | api 228 |
| 11 | `start_show` | Start show (`preview._start`) | `start_show` | `startShowSync(id)`; when a slide carries it, `updateOut` starts the show instead of outputting the slide | `common`; `slideId: startShow` | api 229; showActions 324-329 |
| 12 | `set_template` | Set template on active show | `id` | `setTemplate(id)`; refuses when the show is locked | registry 16 | api 235; apiHelper 667-679 |
| 13 | `set_next_slide_timer` | Next slide timer | `numval` | `setNextSlideTimer(value)` sets `nextTimer` on **every** slide of the active layout and `end: true` on the last slide when the value is non-zero | registry 17 | api 236; apiHelper 625-665 |
| 14 | `change_slide_timeline_speed` | Change slide timeline speed | `percentage` | `slideTimelineSpeedMultiplier.set(value ?? 1)` | registry 18 | api 237 |
| 15 | `transpose_show_up` | Transpose up | — | `formatText(transposeText(getPlainEditorText(id), +1), id)` | registry 19 | api 238 |
| 16 | `transpose_show_down` | Transpose down | — | same with `-1` | registry 20 | api 239 |
| 17 | `next_slide` | Next slide | — | `OutputHelper.advanceOutputs("next")` | incompatible next/previous/random/index/name/group | api 242 |
| 18 | `previous_slide` | Previous slide | — | `OutputHelper.advanceOutputs("previous")` | incompatible as above | api 243 |
| 19 | `random_slide` | Play random slide | — | `randomSlide()` — picks a different index in the current show, skips when locked | registry 25 | api 244; showActions 278-309 |
| 20 | `index_select_slide` | Play slide at index | `index` | delegates `selectSlideByIndex({showId,layoutId,index})`; API index is 1-based (decremented in `triggerAction`, api 453-454) | registry 26 | api 245 |
| 21 | `name_select_slide` | Play slide with name | `strval` | delegates `selectSlideByName(value)` | registry 27 | api 246 |
| 22 | `id_select_group` | Play specific group | `id` | delegates `gotoGroup(id)` | registry 28 | api 247 |
| 23 | `disable_slide` | Disable slide | `disable_slide` | delegates `disableSlide({showId,layoutId,index,value?})`; `value` omitted = toggle | `canAddMultiple` | api 248; api 130-135 |
| 24 | `restore_output` | Restore output | — | `restoreOutput()` — puts back the cached output and restarts cached audio/metronome | incompatible all clears | api 251; clear 59-84 |
| 25 | `clear_all` | Clear all | — | `clearAll(true)`; the `true` is the "button" flag, which **skips** the guard that stops Escape from clearing while a popup/selection/edit is open | `red`; incompatible restore/individual clears | api 252; clear 13-15 |
| 26 | `clear_background` | Clear background | — | `clearBackground()`; also fires `background_cleared` | `common`, `red`, `slideId: clearBackground` | api 253 |
| 27 | `clear_slide` | Clear slide | — | `clearSlide()` (keeps a cached previous slide); fires `slide_cleared` | `common`, `red` | api 256; clear 98-126 |
| 28 | `clear_overlays` | Clear overlays | — | `clearOverlays()`; keeps locked overlays, clears effects | `common`, `red`, `slideId: clearOverlays` | api 257; clear 144-156 |
| 29 | `clear_overlay` | Clear specific overlay | `id` | `clearOverlay(id)`; removes it from overlays and effects on every active output | `red` | api 258; clear 128-142 |
| 30 | `clear_audio` | Clear audio | — | `clearAudio("", {clearPlaylist: true, commonClear: true})` | `common`, `red`, `slideId: clearAudio` | api 259 |
| 31 | `clear_next_timer` | Clear next slide timer | — | `clearTimers()` — clears the transition and slide/overlay timers | `red` | api 260; clear 158-181 |
| 32 | `clear_scene` | Clear scene | — | `clearScene(id?)`; fires `scene_cleared` (not a registered activation) | `red` | api 261; output/clear 191-201 |
| 33 | `clear_drawing` | Clear drawing | — | `clearDrawing()` sets the paint-clear flag | `red` | api 262; clear 183-189 |
| 34 | `start_camera` | Start camera | `camera` | delegates `startCamera({name,id,groupId})` | `common` | api 265 |
| 35 | `start_screen` | Start screen | `screen` | delegates `startScreen({name,id})` | `common` | api 266 |
| 36 | `toggle_playing_media` | Toggle playing media | — | `togglePlayingMedia(null, false, true)` | registry 46 | api 268 |
| 37 | `id_start_effect` | Start effect | `id` | delegates `selectEffectById(id)` | `common`, `canAddMultiple` | api 276 |
| 38 | `id_select_overlay` | Start overlay | `id` | delegates `selectOverlayById(id)` | `common`, `canAddMultiple` | api 279 |
| 39 | `start_scene` | Start scene | `id` | `startScene(id)` — outputs the scene content to the bound/active outputs, then runs `scene.action` | `canAddMultiple` | api 287; output 513-555 |
| 40 | `start_webrtc_stream` | output.start_streaming (WebRTC) | `id` | delegates `startStreaming(id?)` | registry 55 | api 288 |
| 41 | `stop_webrtc_stream` | output.stop_streaming (WebRTC) | `id` | delegates `stopStreaming(id?)` | `red` | api 289 |
| 42 | `start_rtmp_stream` | output.start_streaming (RTMP) | `id` | delegates `startRtmpStreaming(id?)` | registry 57 | api 290 |
| 43 | `stop_rtmp_stream` | output.stop_streaming (RTMP) | `id` | delegates `stopRtmpStreaming(id?)` | `red` | api 291 |
| 44 | `start_output_recording` | Start recording | `id` | `toggleOutputRecording({...id, value: true})` | registry 59 | api 292 |
| 45 | `stop_output_recording` | Stop recording | — | `toggleOutputRecording({value: false})` | `red` | api 293 |
| 46 | `lock_output` | Toggle output lock | `output_lock` | delegates `toggleLock({value, outputId})` | `canAddMultiple` | api 294 |
| 47 | `toggle_output_windows` | Toggle output windows | `toggle` | `toggleOutputs(null, {state: value})` | incompatible `toggle_output` | api 295 |
| 48 | `toggle_output` | Toggle output window | `toggle_output` | `toggleOutputs([id], {state: value})` | `canAddMultiple`; incompatible `toggle_output_windows` | api 296 |
| 49 | `change_output_style` | Change output style | `change_output_style` | `changeOutputStyle({outputId, styleId})`; runs before the output when the style has no background layer | `common`, `canAddMultiple`, `slideId: outputStyle` | api 298; showActions 200-211 |
| 50 | `change_transition` | Change transition | `transition` | `updateTransition({id,type,duration,easing})` | removed from the action editor (`CreateAction.svelte:63`) | api 300 |
| 51 | `change_stage_output_layout` | Change stage output layout | `stage_output_layout` | delegates `changeStageOutputLayout({outputId,stageLayoutId})` | `common`, `canAddMultiple` | api 299 |
| 52 | `id_select_stage_layout` | Change stage connections layout | `id` | delegates `moveStageConnection(id)` | registry 71 | api 303 |
| 53 | `change_volume` | Change volume | `volume` | delegates `updateVolumeValues({volume, channelId, useDB})` | `canAddMultiple` | api 310 |
| 54 | `mute` | `actions.mute` (no en.json entry at this pin) | `mute` | delegates `muteChannel({id, value})`; id defaults to main | `canAddMultiple` | api 311 |
| 55 | `start_audio_stream` | Start audio stream | `id` | `AudioPlayer.start(id, {name: ""})` | `common`, `slideId: audioStream` | api 312 |
| 56 | `toggle_audio_recording` | Toggle audio recording | `toggle_channel_recording` | delegates `toggleAudioRecording({id, value})` | `canAddMultiple` | api 313 |
| 57 | `toggle_icecast` | `actions.toggle_specific` + "Icecast" | `toggle` | `toggleIcecast({value})` | registry 78 | api 314 |
| 58 | `start_playlist` | Start playlist | `id` | `AudioPlaylist.start(id)` | `common`; incompatible `playlist_next` | api 315 |
| 59 | `playlist_next` | Next track in playlist | — | `AudioPlaylist.next()` | incompatible `start_playlist` | api 317 |
| 60 | `start_metronome` | Start metronome | `metronome` | `startMetronome({tempo, beats, metadataBPM})` | registry 81 | api 318 |
| 61 | `start_audio_effect` | Start audio effect | `audio_effects` | `playAudio(data)` | `common`, `canAddMultiple` | api 319 |
| 62 | `start_microphone` | Start microphone | `microphone` | `AudioMicrophone.start(id, {name})` | `common` | api 320 |
| 63 | `stop_microphone` | Stop microphone | `microphone` | `AudioMicrophone.stop(id)` | `common`, `red` | api 321 |
| 64 | `id_start_timer` | Start timer | `id` | `startTimerById(id)`; toggles pause when already running | `common`, `canAddMultiple`; incompatible pause/stop | api 326; timers 174-190 |
| 65 | `start_slide_timers` | Start timers on active slide | — | `playSlideTimers({showId,slideId,overlayIds})`; on a slide, overlay ids are collected from the slide (actions.ts 118-127) | `common`, `slideId: startTimer` | api 327 |
| 66 | `pause_timers` | Pause timers | — | `pauseAllTimers()` sets `paused` on every active timer | `common` | api 328; timers 167-172 |
| 67 | `stop_timers` | Stop timers | — | `stopTimers()` (keeps PCO Live entries) | `common`, `red`, `slideId: stopTimers` | api 329 |
| 68 | `start_timeline` | Start timeline | — | `startTimeline("show")` | registry 96 | api 339 |
| 69 | `stop_timeline` | Stop timeline | — | `stopTimeline("show")` | registry 97 | api 340 |
| 70 | `pause_timeline` | Pause timeline | — | `pauseTimeline("show")` | registry 98 | api 341 |
| 71 | `set_timeline_time` | Set timeline time | `seconds` | `setTimelineTime("show", seconds * 1000)` | registry 99 | api 342 |
| 72 | `change_variable` | Change variable | `variable` | `changeVariable(data)` — see `functions.md` step 28 for the key semantics | `common`, `canAddMultiple` | api 345; apiHelper 415-486 |
| 73 | `change_draw_zoom` | Change draw zoom | `draw_zoom` | delegates `changeDrawZoom({size,x,y})` | registry 104 | api 348 |
| 74 | `emit_action` | Emit data | `emitter` | `emitData({emitter, template, templateValues, data})` — OSC/HTTP/MIDI message | `common`, `canAddMultiple` | api 357; emitters 90-114 |
| 75 | `interaction_start` | `tabs.interactions: inputs.start` (key path) | `interactions` | `startInteraction(id)` — creates the Firebase session | registry 112 | api 360 |
| 76 | `interaction_stop` | `tabs.interactions: media.stop` | `interactions` | `stopInteraction(id)` — saves history, deletes the node | registry 113 | api 361 |
| 77 | `interaction_next` | `tabs.interactions: media.next` | `interactions` | `getInteraction(id)?.next()` — reveals an answer first, else advances | `canAddMultiple` | api 362 |
| 78 | `interaction_previous` | `tabs.interactions: media.previous` | `interactions` | `getInteraction(id)?.previous()` | `canAddMultiple` | api 363 |
| 79 | `obs_set_scene` | OBS Studio: Set scene | `obs_scene` | `obsSetScene(scene)` → `SetCurrentProgramScene` | registry 118 | api 366; obsTalk 202-206 |
| 80 | `obs_start_livestream` | OBS Studio: Start livestream | — | `obsStartLivestream()` → `StartStream` | registry 119 | api 367; obsTalk 208-212 |
| 81 | `obs_stop_livestream` | OBS Studio: Stop livestream | — | `obsStopLivestream()` → `StopStream` | `red` | api 368; obsTalk 214-218 |
| 82 | `obs_start_recording` | OBS Studio: Start recording | — | `obsStartRecording()` → `StartRecord` | registry 121 | api 369; obsTalk 220-224 |
| 83 | `obs_stop_recording` | OBS Studio: Stop recording | — | `obsStopRecording()` → `StopRecord` | `red` | api 370; obsTalk 226-230 |
| 84 | `spotify_play` | Spotify: media.play | — | delegates `spotifyPlay()` | registry 125 | api 373 |
| 85 | `spotify_pause` | Spotify: media.pause | — | delegates `spotifyPause()` | registry 126 | api 374 |
| 86 | `spotify_fade_out` | Spotify: media.fade_out | — | delegates `fadePause()` | registry 127 | api 375 |
| 87 | `spotify_next` | Spotify: media.next | — | delegates `skipNext()` | registry 128 | api 376 |
| 88 | `spotify_previous` | Spotify: media.previous | — | delegates `skipPrev()` | registry 129 | api 377 |
| 89 | `smart_toggle_stt` | `actions.toggle_specific` + "STT" | `toggle` | `toggleSttListening(value)` → `triggerFunction("toggle_stt_listening:on|off|toggle")` | registry 132 | api 380; apiHelper 950-957 |
| 90 | `toggle_log_song_usage` | Log song usage to a file | `toggle` | sets `special.logSongUsage`; strings `"true"`/`"false"` accepted | registry 135 | api 384; apiHelper 959-967 |
| 91 | `run_action` | Run action | `id` | `runActionId(id, "api")` — runs another action's triggers | `canAddMultiple` | api 388 |
| 92 | `toggle_action` | Toggle action | `toggle_action` | `toggleAction({id, value})` sets `enabled`; no id = no-op | `canAddMultiple` | api 389; actions 164-175 |
| 93 | `wait` | Wait (`animate.wait`) | `number` | sleeps `number` seconds inside the trigger list; cancelled by `stopAllActionTimeouts`; not an API handler | `common`, `canAddMultiple` | actions 95-111, 23-28 |

## API-only handlers (72)

These exist in `API_ACTIONS` but have no registry entry, so they cannot be picked in
the action editor. They are reachable over the HTTP/REST/WebSocket/OSC API, and some
are used internally (marked).

| # | ID | Input | What it does | Ref |
| --- | --- | --- | --- | --- |
| 1 | `name_select_project` | `value` | `selectProjectByName(value)` | 218 |
| 2 | `change_layout` | `{showId, layoutId}` | `changeShowLayout(data)` | 230 |
| 3 | `set_plain_text` | `{id, value}` | `formatText(value, id)` | 231 |
| 4 | `set_show` | `{id, value}` | `setShowAPI(id, value)` | 232 |
| 5 | `rearrange_groups` | `{showId, from, to}` | `rearrangeGroups(data)` | 233 |
| 6 | `add_group` | `{showId, groupId}` | `addGroup(data)` | 234 |
| 7 | `show_live_source` | `{id, type?, outputId?}` | `setOutput("background", {id, type}, …)` — NDI/OMT source on a background | 255 |
| 8 | `play_media` | `{path, index?, data?}` | `playMedia(data)` | 267 |
| 9 | `toggle_media_loop` | — | `toggleMediaLoop()` | 269 |
| 10 | `toggle_media_mute` | — | `toggleMediaMute()` | 270 |
| 11 | `get_media_loop_state` | — | `getMediaLoopState()`; a getter without the `get_` filter prefix, still unlisted in the UI | 271 |
| 12 | `video_seekto` | `{id?, seconds}` | `videoSeekTo(data)` | 272 |
| 13 | `index_select_overlay` | `index` | `selectOverlayByIndex(index)` | 277 |
| 14 | `name_select_overlay` | `value` | `selectOverlayByName(value)` | 278 |
| 15 | `start_scripture` | `{id?, reference, play?}` | `startScripture(data)`; reference syntax is parsed at 699-707 | 282 |
| 16 | `scripture_next` | — | `triggerFunction("scripture_next")` | 283 |
| 17 | `scripture_previous` | — | `triggerFunction("scripture_previous")` | 284 |
| 18 | `id_select_output_style` | `{id}` | `changeOutputStyle({styleId: id})`; the registry entry is commented out (`actionData.ts:64`) | 297 |
| 19 | `play_audio` | `{path, …}` | `playAudio(data)` | 306 |
| 20 | `pause_audio` | `{path, …}` | `pauseAudio(data)` | 307 |
| 21 | `stop_audio` | `{path, …}` | `stopAudio(data)` | 308 |
| 22 | `audio_seekto` | `{id?, seconds}` | `audioSeekTo(data)` | 309 |
| 23 | `name_start_playlist` | `value` | `startPlaylistByName(value)` | 316 |
| 24 | `name_start_timer` | `value` | `startTimerByName(value)`; name is a closest match, `{...}` dynamic values allowed (timerTick 41-48) | 325 |
| 25 | `timer_seekto` | `{id?, seconds}` | `timerSeekTo(data)` | 330 |
| 26 | `timer_seek_add` | `{id?, seconds}` | `timerSeekAdd(data)` | 331 |
| 27 | `edit_timer` | `{id, key, value}` | `editTimer(data)`; numeric coercion for `start`/`end` (apiHelper 400-411) | 332 |
| 28 | `id_pause_timer` | `{id}` | `pauseTimerById(id)`; registry entry commented (`actionData.ts:92`) | 333 |
| 29 | `name_pause_timer` | `value` | `pauseTimerByName(value)` | 334 |
| 30 | `id_stop_timer` | `{id}` | `stopTimerById(id)`; registry entry commented (`actionData.ts:93`) | 335 |
| 31 | `name_stop_timer` | `value` | `stopTimerByName(value)` | 336 |
| 32 | `sync_content_provider` | — | `contentProviderSync()` | 351 |
| 33 | `send_midi` | `API_midi` | `sendMidi(data)`; marked DEPRECATED in favour of `emit_action` | 355 |
| 34 | `send_rest_command` | `{url, method, contentType, payload}` | `sendRestCommandSync(data)`; DEPRECATED | 356 |
| 35 | `close` | — | `save(true)` — saves and closes the app | 383 |
| 36 | `name_run_action` | `value` | `runActionByName(value, "api")`; closest-match on name | 387 |
| 37 | `add_to_project` | `{projectId, id, data?}` | `addToProject(data)` | 392 |
| 38 | `create_show` | `{text, name?, category?}` | `convertText({noFormatting: true, open: false, …})` | 395 |
| 39 | `create_project` | `{name, id?}` | `createProject(data)` | 396 |
| 40 | `delete_project` | `{id}` | `deleteProject(id)` | 399 |
| 41 | `remove_project_item` | `{id, index}` | `removeProjectItem(data)` | 400 |
| 42 | `rename_project` | `{id, name}` | `renameProject(data)` | 403 |
| 43 | `get_shows` | — | `getShows()` | 406 |
| 44 | `get_show` | `{id}` | `getShow(data)` | 407 |
| 45 | `get_show_layout` | `{id}` | `getShowLayout(data)` | 408 |
| 46 | `get_projects` | — | `getProjects()` | 409 |
| 47 | `get_project` | `{id}` | `getProject(data)` | 410 |
| 48 | `get_plain_text` | `{id}` | `getPlainText(id)` | 411 |
| 49 | `get_groups` | `{id}` | `getShowGroups(id)` | 412 |
| 50 | `get_output` | `{id?}` | `getOutput(data)` | 414 |
| 51 | `get_output_slide_text` | — | `getOutputSlideText()` | 415 |
| 52 | `get_output_group_name` | — | `getOutputGroupName()` | 416 |
| 53 | `get_dynamic_value` | `{value, ref?}` | `replaceDynamicValues(value, ref)` | 417 |
| 54 | `get_playing_video_duration` | — | `getPlayingVideoDuration()` | 419 |
| 55 | `get_playing_video_state` | — | `getPlayingVideoState()` | 420 |
| 56 | `get_playing_video_time` | — | `getPlayingVideoTime()` | 421 |
| 57 | `get_playing_video_time_left` | — | duration − time | 422 |
| 58 | `get_playing_audio_duration` | — | `getPlayingAudioDuration()` | 423 |
| 59 | `get_playing_audio_time` | — | `getPlayingAudioTime()` | 424 |
| 60 | `get_playing_audio_time_left` | — | duration − time | 425 |
| 61 | `get_playing_audio_data` | — | `getPlayingAudioData()` | 426 |
| 62 | `get_variables` | — | `getVariables()` | 428 |
| 63 | `get_variable` | `{id?, name?}` | `getVariable(data)` | 429 |
| 64 | `get_timers` | — | `getTimersDetailed()` | 431 |
| 65 | `get_actions` | — | `getActions()` | 433 |
| 66 | `get_playlists` | — | `getPlaylists()` | 435 |
| 67 | `get_playlist` | `{id?}` | `getPlayingPlaylist(data)` | 436 |
| 68 | `get_slide` | `{showId?, slideId?}` | `getSlide(data)` | 437 |
| 69 | `get_thumbnail` | `{path, …}` | `getThumbnail(data)` | 439 |
| 70 | `get_slide_thumbnail` | `{showId?, layoutId?, index?}` | `getSlideThumbnail(data)` | 440 |
| 71 | `get_pdf_thumbnails` | `{path, …}` | `getPDFThumbnails(data)` | 441 |
| 72 | `get_cleared` | — | `getClearedState()` — `{all, background, slide, overlays, audio, slideTimers}` | 442; apiHelper 683-695 |

## What the dispatch does before any handler runs

`triggerAction` (`api.ts:447-464`): an OSC-style path is converted first
(`apiOSC.ts:48-62`); an `index` argument is decremented because the API is 1-based;
an unknown id logs `Missing API ACTION` and returns; a `returnId` in the request
causes the handler's return value to be sent back to the caller. The UI path never
goes through this function — it calls the same handlers through `API_ACTIONS`
directly (`actions.ts:135`), so the 1-based index adjustment does **not** apply to
actions run inside the app.

## Registry versus API

| Observation | Evidence |
| --- | --- |
| 93 registry entries; 164 API handlers; 92 ids in both; `wait` in the registry only | counts in the two files; `CreateAction.svelte:94` |
| `wait` is special-cased and has no handler | `actions.ts:95-111` |
| `send_midi` and `send_rest_command` are commented out of the registry and marked deprecated, but remain in the API | `actionData.ts:107-108`; `api.ts:355-356` |
| `id_select_output_style`, `id_pause_timer`, `id_stop_timer` were removed from the registry and remain in the API | `actionData.ts:64,92-93` |
| `clear_all` from an action bypasses the Escape-key guard | `clear.ts:13-15`; `api.ts:252` |
| `set_next_slide_timer` writes to every slide in the layout, not one | `apiHelper.ts:625-631` |
| `change_transition` is in the registry but removed from the picker | `CreateAction.svelte:63` |
| The registry carries `slideId` legacy keys for 9 actions (`start_show`, `clear_background`, `clear_overlays`, `clear_audio`, `start_slide_timers`, `stop_timers`, `change_output_style`, `start_audio_stream`, `send_midi`) that predate `slideActions` | `actionData.ts:15,34,36,38,88,90,65,76,107` |

## Open questions

- Handler internals not opened. The following delegation targets were read by name
  only, so their exact effect is `unknown` at this level: the project/show
  selectors (`selectProjectById`, `selectShowByName`, `selectSlideByIndex`,
  `gotoGroup`, `startProjectItemByName`), the media/streaming starters
  (`startCamera`, `startScreen`, `startStreaming`, `startRtmpStreaming`), the audio
  mixers (`updateVolumeValues`, `muteChannel`, `toggleAudioRecording`,
  `startMetronome`, `AudioPlayer`, `AudioPlaylist`, `AudioMicrophone`), the overlay
  and effect selectors, `toggleLock`, `updateTransition`, `changeDrawZoom`, the
  timeline playback functions, the Spotify manager, and all 30 getters. Each needs
  a read of its own module or a run to be specified.
- Which API-only ids are intended to become user-facing: `change_layout`,
  `play_media`, `start_scripture`, `edit_timer`, `close`, `create_show` and the like
  are useful as actions but have no registry entry at this pin.
- `get_media_loop_state` sidesteps the UI's `get_` filter but is still hidden
  because it lacks a registry entry (`CreateAction.svelte:94,102`); whether that is
  intentional is not established.
- `sync_content_provider` takes no input and is not in the registry; whether it is
  meant for the UI or only for Companion is unknown.
- The numbering above is the registry file order; the API section order differs
  (e.g. `change_stage_output_layout` sits in the API's OUTPUT block, `start_scene`
  there too). Ordering has no behavioural meaning beyond the picker's section
  headings.
