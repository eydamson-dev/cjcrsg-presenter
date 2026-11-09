# Smart (STT, LLM, scripture)

- **ID:** `smart.stt`, `smart.llm`, `smart.scripture`
- **Area:** advanced
- **Online docs:** <https://freeshow.app/docs/smart>
- **Pinned code:** ff784eb
- **Confidence:** `code`

## Summary

Smart mode listens to a microphone, transcribes speech locally with the Nemotron
model, optionally passes the transcript through an LLM, and turns what it hears
into scripture suggestions — or, above a chosen confidence, straight to the
output. It is off by default and marked experimental in the UI.

## What the user sees

Settings → **Smart** starts with a red **EXPERIMENTAL!** label and an enable
switch. When enabled it shows **Transcription** (engine status and a microphone
dropdown) and **Scripture** → **Auto present** (Always ask / If confident / If
high confidence / If medium confidence). A floating AI ring/chat/transcript UI
sits over the app while it is active.

Screenshot: `../screenshots/advanced-smart-settings.png` — not yet captured.
Shot list:

1. Settings → Smart, disabled state (the two info tips), 1440×900.
2. Settings → Smart, enabled, model downloaded, microphone list populated.
3. The LLM provider options popup with the five providers.
4. The floating confidence meter while a suggestion is showing.
5. The Auto present dropdown open, showing the four options.

## `smart.stt`

How it behaves:

- The `ai` store defaults to `{}`, so Smart is **off** until enabled.
  `code` — `src/frontend/stores.ts:419`.
- Enabling it opens the model manager popup, which is where the model is
  downloaded. `code` — `src/frontend/ai/components/settings/SmartSettings.svelte:17-21`.
- There is exactly one engine: `resolveSttEngine()` returns `nemotron` unless the
  settings name another. `code` — `src/frontend/ai/stt/stt.ts:8-10`;
  the engine dropdown is commented out in `STTOptions.svelte:57-78`.
- The model is NVIDIA Nemotron 3.5 streaming transducer, int8, multilingual,
  pinned to revision `cba1c96…` with per-file SHA-256, about 682 MB, plus
  `silero_vad.onnx`. `code` — `src/electron/ai/setup/models/nemotron.ts:7-23`.
- Intel macOS (`darwin-x64`) is refused: `sherpa-onnx-node` does not work there.
  `code` — `src/electron/ai/setup/models/nemotron.ts:31-35`;
  error surfaced at `src/electron/ai/setup/LocalModelManager.ts:58-61`.
- The model and binary live under `app.getPath("userData")/bin/<engine>/…`, not
  in the data folder. `code` — `src/electron/ai/setup/LocalModelManager.ts:21,40-47`.
- The microphone list comes from the browser's audio devices; if none is stored,
  the system default input is resolved and saved. `code` —
  `src/frontend/ai/components/settings/STTOptions.svelte:44-55`.
- Listening start goes through `Main.AI_LISTEN_START` with the engine and its
  options; transcripts arrive in 350 ms debounced chunks with an 8-word overlap
  and a 120-word cap, keeping the last 10 000 characters.
  `code` — `src/frontend/ai/stt/stt.ts:49-59`,
  `src/frontend/ai/stt/transcript.ts:26-27,74-75,98-118`.

State and persistence:

| What | Where it lives | When it is written | Survives restart |
| --- | --- | --- | --- |
| Smart settings (`enabled`, `stt`, `llm`, `scripture`) | `settings.json` → `ai` | On save | Yes, machine-local |
| Model files | `userData/bin/nemotron/models` | On download | Yes, not moved with the data folder |

Settings:

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Smart | `ai.enabled` | off | Master switch |
| Engine | `ai.stt.engine` | `nemotron` | Only supported engine |
| Microphone | `ai.stt.micDeviceId` | system default | Input device |
| Engine options | `ai.stt.engineOptions[nemotron]` | none | Language, model path, interpretation mode (`src/types/ai/AiSettings.ts:20-31`) |

## `smart.llm`

How it behaves:

- Providers: `ollama`, `anthropic`, `openai`, `google`; the UI adds `none`
  (default), labelled "None". `code` — `src/electron/ai/llm/llmProviders.ts:8-13`,
  `src/frontend/ai/components/popups/LlmOptions.svelte:24-30`.
- With `provider === "none"` no LLM manager is created at all, and detection runs
  on speech-to-text alone. `code` — `src/frontend/ai/llm/llmManager.ts:36-48`;
  `LlmOptions.svelte:110-111`.
- Ollama is hard-coded to `http://127.0.0.1:11434`, fetches models from
  `/api/tags`, and falls back to `gemma3:4b` when no model is set.
  `code` — `src/electron/ai/llm/providers/ollama.ts:5,9,11-19,33-48`.
  The docs' recommended model is "Gemma 3 4B" (`source/docs/smart.md:31`).
- API keys are tested before being stored, then written to the `ACCESS` store's
  `secrets.aiProviders` map — app data directory, not the data folder.
  `code` — `src/electron/ai/setup/aiKeys.ts:5-23`;
  `src/frontend/ai/components/popups/LlmOptions.svelte:92-105`.
- The request path is the renderer → `Main.AI_LLM_COMPLETE`, 60 s timeout,
  JSON-parsed response, one request at a time.
  `code` — `src/frontend/ai/llm/llmManager.ts:61-80`.

Settings:

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Provider | `ai.llm.provider` | `none` | Chooses the backend |
| Model | `ai.llm.model` | first model returned, else Ollama `gemma3:4b` | Model id |

## `smart.scripture`

How it behaves:

- **Auto present** maps to one of `ask` (default), `highest`, `high`, `medium`.
  `code` — `src/types/ai/AiSettings.ts:38-41`;
  `src/frontend/ai/components/settings/AutoScriptureOptions.svelte:17-27`.
- The thresholds are strict `>`: highest 95, high 75, medium 50; `ask` never
  auto-plays. `code` — `src/frontend/ai/manager/AiManager.ts:186-198`.
- Guards before auto-play: never at ≤ 50; never a "new translation" match;
  never if the output was manually updated in the last 30 s; never a duplicate
  suggestion below 96.
  `code` — `src/frontend/ai/manager/AiManager.ts:170-191`.
- Only `scripture` matches auto-play; `scripture_version`, lyrics, quotes and
  announcements are WIP and only produce suggestions.
  `code` — `src/frontend/ai/manager/AiManager.ts:129,174-175`.
- Auto-detection refuses API Bibles and tells the user to import a local one;
  the docs make the same recommendation (`source/docs/smart.md:35`).
  `code` — `src/frontend/ai/manager/AiManager.ts:80-85`.
- A content match is also scanned across every other local Bible, and a better
  match is offered as a translation switch.
  `code` — `src/frontend/ai/manager/AiManager.ts:93-107`.
- There is an action to toggle transcription:
  `smart_toggle_stt` with a toggle input (`src/frontend/components/actions/actionData.ts:132`).
  The API equivalent is `toggle_stt_listening` (`src/frontend/components/actions/api.ts`,
  `apiHelper.ts:950-957`).

## Code

- `src/frontend/ai/components/settings/SmartSettings.svelte` — the settings UI.
- `src/frontend/ai/components/settings/STTOptions.svelte` — engine status and mic.
- `src/frontend/ai/components/settings/AutoScriptureOptions.svelte` — confidence.
- `src/frontend/ai/stt/stt.ts` — capture and engine start.
- `src/frontend/ai/stt/transcript.ts` — chunking and confidence averaging.
- `src/frontend/ai/manager/AiManager.ts` — matching and auto-play rules.
- `src/frontend/ai/llm/llmManager.ts`, `llmProviders.ts` — provider plumbing.
- `src/electron/ai/setup/models/nemotron.ts` — model pin and download.
- `src/electron/ai/setup/LocalModelManager.ts` — install locations.
- `src/electron/ai/llm/providers/ollama.ts` — local endpoint.
- `src/types/ai/AiSettings.ts`, `src/types/ai/Ai.ts` — setting and match shapes.

## Online docs

- [Smart](https://freeshow.app/docs/smart) — local-first claim, the Nemotron
  engine, Ollama setup, "auto present if the confidence is above a threshold".
  It does not name the thresholds; the code does (95/75/50).

## Doc vs code

- `doc` says the LLM is "optional" and "currently it's being worked on"
  (`source/docs/smart.md:20`) / the code ships a working provider layer and a
  chat/action surface, and defaults the provider to `none`
  (`src/frontend/ai/llm/llmManager.ts:36-48`).
- `doc` says "you can make it auto present if the confidence is above a certain
  threshold" without numbers (`source/docs/smart.md:39`) / code uses 95 / 75 / 50,
  strictly greater, with a hard floor of 50
  (`src/frontend/ai/manager/AiManager.ts:180-198`).
- `doc` recommends Gemma 3 4B for Ollama / code's fallback model is exactly
  `gemma3:4b` (`src/electron/ai/llm/providers/ollama.ts:9`).

## Open questions

- Whether the LLM actually *raises* match confidence or only classifies the
  transcript was not traced past `llmManager.detectMatch` in
  `AiManager.ts:38-42`. `unknown`; needs a run with an LLM configured.
- Whether the mic stream is stopped when the output window closes or the app
  loses focus was not traced. `unknown`.
- The Nemotron download URL is a Hugging Face revision; whether it stays
  reachable for a given install is not established. `unknown`.
