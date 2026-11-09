# Cloud, integrations and transfer

- **Area:** cloud-and-transfer
- **Online docs:** <https://freeshow.app/docs/cloud> · <https://freeshow.app/docs/integrations> · <https://freeshow.app/docs/midi> · <https://freeshow.app/docs/importing> · <https://freeshow.app/docs/exporting>
- **Pinned code:** ff784eb (FreeShow 1.6.8-beta.3)
- **Confidence:** `code` unless a page says otherwise. Nothing in this area was run.

## Why this area exists

These features reach outside the show model: they open sockets and browsers, read
and write files the user chose, and — in cloud sync — change local data without a
direct user action. A port that only reproduces the dialogs will get the timing,
the merge rules and the file formats wrong. The pages here record those rules.

Four of the five online pages in this area are mostly correct about the visible
surface. The differences that matter are timing (when a sync actually runs),
payload (what a PowerPoint or PDF import really produces), and completeness (the
import menu has more entries than the docs list).

## Pages

| Page | What it covers | Inventory IDs |
| --- | --- | --- |
| `cloud-sync.md` | ChurchApps team storage, triggers, merge, read-only, conflict rule, media sync folder | cloud.setup, cloud.sync, cloud.merge, cloud.media, cloud.readonly, cloud.conflict |
| `integrations.md` | API.Bible, Planning Center, ChurchApps, Pixabay, Unsplash: auth and payloads | integration.bible, integration.planningcenter, integration.churchapps, integration.pixabay, integration.unsplash |
| `midi.md` | MIDI-triggered actions, default maps, velocity/index rules | midi.actions, midi.defaults |
| `importing.md` | Import menu, converters, PDF and PowerPoint paths | import.formats, import.pdf, import.pptx |
| `exporting.md` | Export menu, five formats, PDF options | export.formats |

## Row map and state

| ID | Behaviour | Verdict | Where |
| --- | --- | --- | --- |
| cloud.setup | Connect a B1.Church (ChurchApps) team | `code` | `cloud-sync.md` |
| cloud.sync | Sync on open, autosave, close, manually | `code` | `cloud-sync.md` |
| cloud.merge | Merge local and cloud data | `code` | `cloud-sync.md` |
| cloud.media | Media sync folder and missing-media search | `code` | `cloud-sync.md` |
| cloud.readonly | Never upload local changes | `code` | `cloud-sync.md` |
| cloud.conflict | Different elements merge; same show keeps latest | `code` | `cloud-sync.md` |
| integration.bible | API.Bible versions, online-only | `code` | `integrations.md` |
| integration.planningcenter | OAuth, one week of future services | `code` | `integrations.md` |
| integration.churchapps | OAuth, song upload, service plans | `code` | `integrations.md` |
| integration.pixabay | Image/video search | `code` | `integrations.md` |
| integration.unsplash | Image search | `code` | `integrations.md` |
| midi.actions | Trigger actions from MIDI input | `code` | `midi.md` |
| midi.defaults | Default note/channel per action | `code` | `midi.md` |
| import.formats | Import menu and converters | `code` | `importing.md` |
| import.pdf | PDF as image show | `code` | `importing.md` |
| import.pptx | PowerPoint conversion | `code` | `importing.md` |
| export.formats | Project, show, TXT, PDF, image | `code` | `exporting.md` |

## Known mismatches, at a glance

- The import menu offers **25 buttons**; `importing.md` lists **19 items** and the
  feature inventory says "18 programs and file types". Details in `importing.md`.
- The export menu offers **five formats**; `exporting.md` documents four — "Image"
  is missing from the docs. Details in `exporting.md`.
- `importing.md` says the PowerPoint import takes "just the text"; the code
  converts shapes, colours and text boxes. Details in `importing.md`.
- `exporting.md` says project media "must be transported manually"; the code
  bundles media in the `.project` archive by default. Details in `exporting.md`.
- `midi.md` names "Next show", "Previous show" and "Go to group" on channel 1,
  but the three default entries for those names match no action ID. Details in
  `midi.md`.
- `integrations.md` says Pixabay **and Unsplash** search "images and videos";
  the Unsplash call is photos only. Details in `integrations.md`.

## ID prefixes

`feature-inventory.md` uses `int.` twice: `integration.bible` … `integration.unsplash` mean
*integration* here, while `sys.arch`, `sys.ipc` … `sys.build` in the internal area
mean *internal mechanism*. The IDs are carried unchanged; a contract that cites
one should always name the area as well.

## How the claims were obtained

By reading the pinned source at ff784eb. Nothing in this area was run, so no
claim is `observed`. Screenshots are listed per page as a shot list and are all
"not yet captured"; each page also says what a capture must show to confirm the
code reading.
