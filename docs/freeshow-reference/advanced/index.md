# Advanced, tips and formats

- **Area:** advanced
- **Online docs:** [Data storage](https://freeshow.app/docs/data) · [Smart](https://freeshow.app/docs/smart) · [CCLI Reporting](https://freeshow.app/docs/advanced/ccli-reporting) · [Styling](https://freeshow.app/docs/styling) · [Keyboard Shortcuts](https://freeshow.app/docs/shortcuts) · [FAQ](https://freeshow.app/docs/faq) · [.show](https://freeshow.app/docs/format-show) · [.project](https://freeshow.app/docs/format-project) · [.fsb](https://freeshow.app/docs/format-bible)
- **Pinned code:** ff784eb
- **Confidence:** `code` where a page cites source; `doc` where only the online docs state it; `unknown` where neither established it.

## What this area is

Configuration and persistence that sit outside a single show: where FreeShow
keeps its data and what travels with it, the optional Smart transcription/LLM
features, the CCLI usage log, the real keyboard map, the styling advice, and the
three on-disk file formats.

## Label mapping

This directory uses the labels from `../README.md` (`code`, `doc`, `unknown`).
`docs/decisions.md` D13 names the same states `inferred`, `observed`, `unknown`;
**`code` here is D13's `inferred`** — read from source, not run. Nothing in this
area is `observed`: FreeShow was not exercised for behaviour; it was run only to capture screenshots.

## Row map

| ID | Feature | Detail page | Confidence |
| --- | --- | --- | --- |
| data.paths | Data and show paths | `data-storage.md#datapaths` | `code` |
| data.folders | Data subfolders | `data-storage.md#datafolders` | `code` |
| data.config-in-data | Settings in data path | `data-storage.md#dataconfig-in-data` | `code` |
| data.backup | Backup/restore everything | `data-storage.md#databackup` | `code` |
| data.import-export-settings | Import/export settings | `data-storage.md#dataimport-export-settings` | `code` |
| data.profiles | Profiles | `data-storage.md#dataprofiles` | `code` |
| data.kiosk | Kiosk mode | `data-storage.md#datakiosk` | `doc` (no code found) |
| data.log | Log file | `data-storage.md#datalog` | `code` |
| data.hwaccel | Hardware acceleration | `data-storage.md#datahwaccel` | `code` |
| data.updates | Auto-update | `data-storage.md#dataupdates` | `code` |
| smart.stt | Smart transcription | `smart.md#smartstt` | `code` |
| smart.llm | Smart LLM | `smart.md#smartllm` | `code` |
| smart.scripture | Smart scripture | `smart.md#smartscripture` | `code` |
| ccli.logging | CCLI usage logging | `ccli.md#cclilogging` | `code` |
| ccli.export | CCLI report | `ccli.md#ccliexport` | `code` |
| tips.styling | Styling advice | `styling-and-faq.md#tipsstyling` | `doc` |
| tips.shortcuts | Keyboard shortcuts | `shortcuts.md` | `code` |
| tips.faq | FAQ | `styling-and-faq.md#tipsfaq` | `doc` + `code` per answer |
| fmt.show | `.show` | `formats.md#fmtshow` | `code` |
| fmt.project | `.project` | `formats.md#fmtproject` | `code` |
| fmt.bible | `.fsb` | `formats.md#fmtbible` | `code` |

## Pages

| Page | Covers |
| --- | --- |
| `data-storage.md` | Data root, subfolders, Config folder, backup/restore, profiles, kiosk, log, hardware acceleration, updates |
| `smart.md` | Speech-to-text (Nemotron), LLM providers, auto-presenting scripture |
| `ccli.md` | Opt-in usage logging, the toggle action, export file and JSON shape |
| `shortcuts.md` | The actual key map, the in-app list, differences from the published table |
| `styling-and-faq.md` | Styling advice, and the code behaviour the FAQ asserts |
| `formats.md` | `.show`, `.project`, `.fsb`: shape, required/optional fields, round trip |

## Carried-forward warnings

- **`settings.user_data_location` no longer exists as a control.** The toggle is
  commented out and the flag is force-set (`data-storage.md`).
- **Kiosk mode has no implementation at this commit**, including the
  `DISABLE_KIOSK_MODE` escape file the FAQ documents.
- **The published shortcut table is not the key map.** Duplicate keys (Ctrl+D,
  Ctrl+I) are context-dependent, and several shortcuts exist only in one panel.
- **The published `.show` format is the import shape, not the on-disk shape.**
  FreeShow writes `[id, show]` and accepts both.

## How the claims were obtained

By reading the pinned source and the mirrored docs. Nothing was exercised for behaviour (the app was run only for screenshots), so no claim
is `observed`. Where a behaviour depends on Electron or on a file actually being
written, the page says so and leaves it in Open questions.
