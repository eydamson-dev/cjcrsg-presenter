# MIDI actions

- **ID:** `midi.actions`, `midi.defaults`
- **Area:** cloud-and-transfer
- **Online docs:** <https://freeshow.app/docs/midi>
- **Pinned code:** ff784eb
- **Confidence:** `code`. No MIDI device was attached or simulated.

## Summary

Any action can be given a MIDI trigger: a note-on, note-off or control-change
message on a chosen input device, channel and number. A small set of action IDs has
a built-in default so that "Channel 1 = show, 3 = clear, 4 = style, 5 = index"
works without configuring each action by hand.

## What the user sees

- The Actions drawer lists actions. Clicking one runs it immediately
  (`src/frontend/components/drawer/pages/Actions.svelte:87-98`).
- In the action editor, **More options** exposes **Activate by MIDI signal**
  (`src/frontend/components/main/popups/Action.svelte:490-512`), which opens the
  MIDI value editor (`src/frontend/components/actions/MidiValues.svelte`).
- The editor's fields (`MidiValues.svelte:108-152`): **Input** device,
  **Use default values**, **Auto values** (capture the next incoming message),
  **Type** (`noteon`, `noteoff`, `control`), **Note** (with a note name such as
  `C(3)`), **Velocity**, **Channel** 1–16, and for control messages
  **Controller** and **Value**.
- **Use default values** is only shown when the action's first trigger has a default
  (`MidiValues.svelte:120-122`) and fills the values from the table below
  (`MidiValues.svelte:95-103`).
- Slide-specific MIDI actions are edited through the slide MIDI popup
  (`src/frontend/components/main/popups/SlideMidi.svelte`), which also calls
  `midiInListen` on save (`SlideMidi.svelte:54`).

Screenshot: `../screenshots/cloud-and-transfer-midi.png` — not yet captured.

Shot list (reference at ff784eb, main window, 1280×800):

1. Actions drawer with a MIDI-triggered action visible.
2. Action editor, **More options**, "Activate by MIDI signal" chosen, with the
   Input / Use default values / Type / Note / Velocity / Channel fields.
3. The same editor for **Next slide**, showing "Use default values" on and the
   fields disabled.
4. A control-change MIDI trigger, showing Controller and Value instead of Note.

## How it behaves

### Defaults

`defaultMidiActionChannels` (`src/frontend/components/actions/midi.ts:63-86`). All
use `noteon`, velocity `-1` (meaning "ignore velocity", `midi.ts:100-101`).

| Channel | Action ID | Note | Default exists for this action |
| --- | --- | --- | --- |
| 1 | `next_slide` | 0 | yes |
| 1 | `previous_slide` | 1 | yes |
| 1 | `next_project_show` | 2 | **no action with this ID** |
| 1 | `previous_project_show` | 3 | **no action with this ID** |
| 1 | `goto_group` | 4 | **no action with this ID** |
| 3 | `clear_all` | 0 | yes |
| 3 | `clear_background` | 1 | yes |
| 3 | `clear_slide` | 2 | yes |
| 3 | `clear_overlays` | 3 | yes |
| 3 | `clear_audio` | 4 | yes |
| 3 | `clear_next_timer` | 5 | yes |
| 4 | `change_output_style` | 0 | yes |
| 5 | `index_select_project` | 0 | yes |
| 5 | `index_select_project_show` | 1 | **no action with this ID** |
| 5 | `index_select_slide` | 2 | yes |

The four IDs in bold match no entry in the action catalogue
(`src/frontend/components/actions/actionData.ts`); the current equivalents are
`next_project_item` (line 5), `previous_project_item` (line 6),
`id_select_group` (line 28) and `index_select_project_item` (line 7), none of which
has a default. So picking "use default values" on those actions leaves the values
unchanged (`Action.svelte:208-211` only merges when the key exists).

### Triggering

1. `midiInListen` walks the `actions` store, skips disabled actions and actions
   without `midi`, and registers the input device with the main process
   (`midi.ts:14-24`). It runs whenever the actions store changes
   (`src/frontend/utils/listeners.ts:406-408`) and after saving an action
   (`Action.svelte:289`).
2. The main process opens one JZZ input port **per action ID** and forwards note
   on/off (status nibble `0x90`/`0x80`, or a message string containing "Note") and
   control change (`0xB0`) with a one-based channel
   (`src/electron/utils/midi.ts:73-108`). An already-open port is not reopened
   (`midi.ts:75`).
3. The renderer matches the incoming message against the stored values: type, note
   (or controller) and channel must match, unless the message is marked `bypass` or
   the computed index is `0` (`midi.ts:109-115`).
4. `bypass` is used when a show-linked action is clicked in the drawer
   (`Actions.svelte:90-93`).
5. On a match, `runAction(action, { midiIndex: index })` runs every trigger in the
   action; the index is injected into the trigger's data (`src/frontend/components/actions/actions.ts:46`, `89-91`).
6. For show-linked actions the incoming message can also start a specific slide:
   the renderer scans the show's layouts for `slide.actions.receiveMidi === action.id`
   and presents that slide (`midi.ts:128-149`).
7. Edge case: a MIDI action attached to shows is **deleted from the actions store**
   if no slide in those shows references it (`midi.ts:31-51`).

### Velocity, channel and index

- Channel is one-based everywhere the user sees it: parsed as `(status & 0x0f) + 1`
  (`electron/utils/midi.ts:91`), stored 1–16 (`MidiValues.svelte:152`), and shifted
  down by one only when sending (`electron/utils/midi.ts:38-39`).
- For `index_*` actions the velocity is the index, one-based: velocity 1 selects
  index 0, and any positive index is decremented before use (`midi.ts:122-124`).
- Control-change messages use the control **value** as the index
  (`midi.ts:103-105`).
- Velocity `-1` means "do not filter on velocity" (`midi.ts:100-101`); this is what
  every default uses.
- A velocity of 0 is treated as note-off by MIDI hardware, so index 0 cannot be
  selected by velocity; the code lets an index of 0 through the mismatch check to
  compensate (`midi.ts:107-115`).
- An index action with no usable velocity shows the toast `toast.midi_no_velocity`
  and falls back to index 0 (`midi.ts:117-120`).

### Legacy values

Actions saved before 1.1.6 keep `action.action` and `action.values`; they are
converted on load, and the old zero-based channel is incremented
(`midi.ts:152-169`).

### Output

MIDI output exists for emitters (`sendMidi`, `electron/utils/midi.ts:32-63`), but the
`send_midi` action is commented out of the catalogue
(`actionData.ts:107`); emitters reach it through the emitter system, which is
outside this page.

## State and persistence

| What | Where it lives | When it is written | Survives restart |
| --- | --- | --- | --- |
| Actions, including `midi` | `actions` store, saved as `SYNCED_SETTINGS.midiIn` (`src/frontend/utils/save.ts:272`) | on action save, then on app save | yes, and cloud-synced (`syncManager.ts:62`) |
| MIDI per slide | show `midi` key and `slide.actions.receiveMidi` (`Action.svelte:291-297`; `midi.ts:36`, `140-141`) | on the slide/action save | yes, with the show |
| Open input ports | main-process memory (`electron/utils/midi.ts:72-85`) | on listen/stop | no |

## Settings

There are no globally stored MIDI settings in the traced code. Each action owns its
`midi` object: `{ input, type, values: { note, velocity, channel } | { controller, value, channel }, defaultValues }`
(`src/frontend/components/actions/api.ts:175-177`).

## Code

- `src/frontend/components/actions/midi.ts:14-150` — listener registration, defaults, matching, index handling.
- `src/electron/utils/midi.ts:73-113` — device ports and message parsing.
- `src/frontend/components/actions/MidiValues.svelte` — the editor and default switch.
- `src/frontend/components/main/popups/Action.svelte:208-211`, `553-556` — default merge and MIDI panel.
- `src/frontend/components/actions/customActivation.ts:38` — `midi_signal_received` activation.
- `src/frontend/components/actions/actionData.ts` — the action IDs defaults must match.

## Online docs

- <https://freeshow.app/docs/midi> — gives the channel summary and the list of
  actions per channel (`source/docs/midi.md:18-63`), which the table above confirms
  except for the four orphaned IDs.

## Doc vs code

- `doc` says: "FreeShow has some default values for all of the actions"
  (`source/docs/midi.md:14`). Code does: defaults exist for 11 usable action IDs
  (`midi.ts:63-86`), out of the whole catalogue in `actionData.ts`.
- `doc` lists **Next show**, **Previous show** and **Go to group** on channel 1
  (`source/docs/midi.md:28-38`). Code does: the default entries named
  `next_project_show`, `previous_project_show` and `goto_group` match no action ID
  (`midi.ts:67-69` vs `actionData.ts:5-7`, `28`), so those actions have no default.
- `doc` lists **"Project item"** under channel 5 (`source/docs/midi.md:62`). Code
  does: the default key is `index_select_project_show` (`midi.ts:84`), while the
  action is `index_select_project_item` (`actionData.ts:7`); no default applies.
- `doc` says a channel-5 action triggers "the first if no velocity is set"
  (`source/docs/midi.md:59`). Code does: it shows a toast and uses index 0
  (`midi.ts:117-120`), which is the same visible result but also warns.
- `doc` says clicking an existing action triggers it (`source/docs/midi.md:10`).
  Code does: yes, but a show-linked action is triggered through `receivedMidi` with
  `bypass: true`, while other actions call `runAction` directly
  (`Actions.svelte:87-98`).

## Open questions

- Whether MIDI input works in the packaged app: `package.json` lists only `jzz`
  (`package.json:142`) and the listener runs in the Electron main process, where a
  JZZ backend may not exist. A run with a real device would establish it (`unknown`).
- Whether a note-off with velocity 0 is reported as `noteon` or `noteoff` depends on
  JZZ's message string; the code comments say both are possible
  (`electron/utils/midi.ts:95-100`) — `unknown` without a device.
- The exact set of actions that can appear in the MIDI editor is filtered by the
  action UI, not by `midi.ts`; whether any action type is excluded there is untraced
  (`unknown`).
- Whether two actions on the same device and same note both fire: the renderer
  matches per action (`midi.ts:89-126`), so it should; needs a run.
