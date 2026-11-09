# Cloud sync (ChurchApps)

- **ID:** `cloud.setup`, `cloud.sync`, `cloud.merge`, `cloud.media`, `cloud.readonly`, `cloud.conflict`
- **Area:** cloud-and-transfer
- **Online docs:** <https://freeshow.app/docs/cloud>
- **Pinned code:** ff784eb
- **Confidence:** `code`. The cloud backend was not run, so anything that depends on
  the server (not the client) is `unknown`.

## Summary

FreeShow stores a zip of the user's data in a ChurchApps (B1.Church) *serving
team*, and merges it with local data on open, on autosave and on close. It is the
documented way to move a whole installation between computers without carrying
JSON files by hand.

## What the user sees

Settings > **Files** > **Cloud** (`src/frontend/components/settings/tabs/Files.svelte:280-332`).

- **Connect to ChurchApps** button while no account is connected
  (`Files.svelte:283-288`). It opens a browser login (`ChurchAppsConnect.ts:162`)
  and returns to `http://localhost:5502/auth/complete` (`ChurchAppsConnect.ts:110-111`).
- With a connection: **Sync now** (`Files.svelte:294-297`), **Enable sync**
  (`Files.svelte:301-305`; the string is "Automatic sync on startup and close",
  `public/lang/en.json:958`), **Change team** when the account is in more than one
  team (`Files.svelte:307-309`), **Device name** (`Files.svelte:313`),
  **Read-only** (`Files.svelte:316`), **Media sync folder** plus a folder picker
  (`Files.svelte:322-326`) and **Restore sync state from a week ago**
  (`Files.svelte:330-332`).
- A status indicator in the top-left of the main window shows "Syncing to cloud"
  and "Sync completed" (`src/frontend/components/main/StatusIndicator.svelte:11-14`,
  strings at `public/lang/en.json:972-973`).
- On first connection, if the team already holds data, a popup asks **Merge**,
  **Read-only**, **Upload** or **Download** (`src/frontend/components/main/popups/CloudMethod.svelte:12-21`;
  labels at `public/lang/en.json:964-970`).

Screenshot: `../screenshots/cloud-and-transfer-cloud-sync.png` — not yet captured.

Shot list (reference at ff784eb, main window, 1280×800 unless stated):

1. Settings > Files, cloud **not** connected — shows the single Connect button.
2. Settings > Files, cloud connected — shows Sync now, Enable sync, Device name,
   Read-only, Media sync folder, Restore.
3. The **CloudMethod** popup after connecting to a team that already has data —
   all four options visible.
4. Top-left status indicator during a sync and after it completes.

## How it behaves

### Connect

1. The Connect button calls the ChurchApps content provider with scope `plans`
   (`Files.svelte:285`, scope at `src/electron/contentProviders/churchApps/ChurchAppsProvider.ts:40`).
   The provider starts an Express server on port **5502** and opens
   `https://admin.b1.church/login?...` (`ChurchAppsConnect.ts:109-164`).
2. Teams come from the membership API, `GET /groups/my/team`, authenticated with
   the `plans` scope (`src/electron/cloud/ChurchAppsSyncManager.ts:31-34`).
3. One team is selected automatically; several produce the choose-team popup
   (`src/frontend/utils/cloudSync.ts:71-80`).
4. On selection the app stores `{ id: "churchApps", enabled: true, deviceName, team }`
   in `cloudSyncData` (`cloudSync.ts:91-100`) and probes the team's cloud object
   with a `HEAD` request (`CloudMethod` is shown only when data exists,
   `cloudSync.ts:102-108`; the HEAD is `ChurchAppsSyncManager.ts:42-62`).
5. "First connection" then calls `syncWithCloud(true)`, which **saves and backs up
   locally and returns without talking to the cloud** (`cloudSync.ts:134-139`).
   The first real sync is the next trigger; because no cloud zip exists yet, that
   run uploads local data (`src/electron/cloud/syncManager.ts:92-96`).
6. Choosing a method also only stores `cloudMethod` and calls `syncWithCloud(true)`
   (`CloudMethod.svelte:30-33`); the method is consumed by the next real sync.

### When a sync runs

- **Open:** `contentProviderSync(startup)` calls `setupCloudSync(startup)`
  (`src/frontend/utils/startup.ts:142-149`), which syncs when
  `cloudSyncData.enabled` and a provider connection exists (`cloudSync.ts:36-49`).
- **Autosave:** only when the autosave trigger fired, the document was not already
  saved, no slide is outputted and no sync is running (`src/frontend/utils/save.ts:303-315`).
  This is narrower than "when Autosave is triggered".
- **Close:** `initializeClosing` saves with `closeWhenFinished: true`, which syncs
  before quitting (`save.ts:337-343`, `save.ts:303-321`). If the "unsaved changes"
  popup is enabled, that popup comes first (`save.ts:339`).
- **Manual:** **Sync now** calls `syncWithCloud()` directly (`Files.svelte:234-236`).
- The renderer waits up to **5 minutes** for the main process
  (`cloudSync.ts:159-160`); the main process keeps going if that expires.

### What is synced

The upload zip is built from a backup pass, not from the show model
(`syncManager.ts:595-618`):

| Included | Source |
| --- | --- |
| Every portable store: `SYNCED_SETTINGS`, `THEMES`, `PROJECTS`, `STAGE`, `OVERLAYS`, `TEMPLATES`, `EVENTS` | `src/electron/data/store.ts:35-41`, `src/electron/data/backup.ts:20-26` |
| `MEDIA.json` (media metadata, not the files) | `backup.ts:29-31` |
| Every file in the Bibles folder as `BIBLE_<name>` | `backup.ts:64-75` |
| Every `Shows/*.show` as `SHOWS/<file>` | `backup.ts:77-88` |
| `changes.json` (device ledger) | `syncManager.ts:601-602` |

Media files themselves are excluded, matching the docs (`source/docs/cloud.md:42`).
Local-only stores (`SETTINGS`, `SHOWS` cache, `HISTORY`, `CACHE`, `USAGE`, `ACCESS`)
are not uploaded (`store.ts:31-52`; `syncManager.ts:116-119` filters `portable || MEDIA`).

### Merge

The cloud zip is downloaded and extracted, then each entry is reconciled
(`syncManager.ts:104-108`, merge at `174-416`):

- **Shows** (`SHOWS/*.show`, and the legacy `SHOWS_CONTENT.json`): reconciled one
  show at a time. Newest `show.timestamps.modified` wins; if both sides exist with
  no timestamp, zip mtime decides (`syncManager.ts:205-244`, `655-679`).
- **PROJECTS**: `projects`, `folders`, `projectTemplates` are merged per key, so
  two devices editing different projects both survive (`syncManager.ts:339-372`).
- **SYNCED_SETTINGS**: collections listed at `syncManager.ts:62` merge per item;
  everything else in that file is "newest whole file wins" (`syncManager.ts:373-388`).
- **OVERLAYS, STAGE, TEMPLATES**: merged per object (`syncManager.ts:58`, `389-407`).
- **EVENTS, THEMES, MEDIA**: not in the per-item list, so the newest whole file
  wins (`syncManager.ts:58`, `298-334`).
- **Bibles**: newest file wins (`syncManager.ts:180-203`).
- **Local-only items** are deleted if the other device recorded a deletion;
  otherwise they are uploaded (`syncManager.ts:400-407`, `419-442`, rules comment
  at `702-709`; ledger in `src/electron/cloud/syncLedger.ts:7-16`).
- After merging, local data is uploaded only if something local changed
  (`syncManager.ts:444-457`).

### Read-only

- **Read-only** sets `cloudMethod = "read_only"` (`Files.svelte:316`), which makes
  `syncData` download and merge but never upload (`syncManager.ts:69-70`, `444-455`).
- Independently, if the cloud was modified more than **30 days** after this
  device's last recorded modification, the run is forced read-only for that run so
  an old local copy cannot overwrite newer cloud data (`syncManager.ts:64`, `150-163`).

### Conflict rule

- Different elements (different shows, projects, templates, overlays) merge, as the
  docs say (`source/docs/cloud.md:56-58`; per-item merge above).
- The same show edited on two devices keeps the one with the newest
  `timestamps.modified`; the other copy is overwritten (`syncManager.ts:655-679`).
  This is file-granularity, not slide-granularity.
- When the whole settings file is newer, conflicts inside collections fall back to
  that file (`syncManager.ts:373-377` comment).

### Backup and restore

- After a successful sync, the app uploads a **week-old** local zip to
  `previous.zip` if the existing cloud backup is at least a week old
  (`syncManager.ts:459-474`, `489-516`; upload to `previous.zip` at
  `ChurchAppsSyncManager.ts:224-226`).
- **Restore sync state from a week ago** downloads `previous.zip` and runs the
  normal backup restore over it (`syncManager.ts:531-560`).
- The cloud read is unauthenticated (`ChurchAppsSyncManager.ts:41`, `64`); writes
  use a presigned URL obtained with the user's token (`ChurchAppsSyncManager.ts:147-210`).

### Media sync folder

- Enabling **Media sync folder** copies used local media into the folder
  (`Files.svelte:252-264` calls `BUNDLE_MEDIA_FILES`).
- Default path is `<data root>/Media` (`src/electron/utils/files.ts:812-814`).
  The data root is `Documents/FreeShow` unless changed (`files.ts:372-391`), so the
  docs' "Documents/FreeShow/Media" is right only while the data path is default.
- Files are stored under a per-parent-folder id: parent folder name + hash
  (`files.ts:1148-1182`, `1184-1189`); a file already inside the folder is skipped.
- Missing media lookup checks the original path, then the sync folder, then every
  folder added to the Media drawer (`files.ts:850-860`), matching the docs
  (`source/docs/cloud.md:44-46`).
- Copying happens when a show's media is resolved, not at import time
  (`src/frontend/components/helpers/media.ts:217-221`; audio at
  `src/frontend/audio/audioPlayer.ts:110`).

## State and persistence

| What | Where it lives | When it is written | Survives restart |
| --- | --- | --- | --- |
| `cloudSyncData` (enabled, id, team, deviceName, cloudMethod) | `settings.json` → `cloudSyncData` (`save.ts:196`; default `{}` at `src/electron/data/defaults.ts:70`) | every save | yes |
| Device id used in the ledger | hardware machine id, cached in `config` (`src/electron/utils/helpers.ts:64-77`, `syncManager.ts:732-736`) | first use | yes, per machine |
| `changes.json` ledger | inside the cloud zip only (`syncManager.ts:601-602`) | each upload | yes, in cloud |
| File edit times and merge guard | `cache_sync.json` (`syncManager.ts:304-306`, `444-452`; store at `src/electron/data/store.ts:47`) | each sync | yes |
| Local cloud zips | `<data>/Cloud` (`syncManager.ts:604-606`) | each upload | yes, pruned (`syncManager.ts:634-652`) |
| Weekly backup | cloud `previous.zip` (`ChurchAppsSyncManager.ts:214-226`) | at most weekly | yes, in cloud |
| OAuth token | `ACCESS` store (`store.ts:52`; `setContentProviderAccess` in `ChurchAppsConnect.ts:155`) | on login/refresh | yes, machine-local, not synced |
| Media sync folder path | `config.mediaFolderPath` (`files.ts:815-817`) | when picked | yes, machine-local |

## Settings

| Setting | Key and location | Default | Effect |
| --- | --- | --- | --- |
| Enable sync / "Automatic sync on startup and close" | `cloudSyncData.enabled` | absent (`{}`) | allows open/autosave/close sync (`cloudSync.ts:32`, `36`) |
| Sync method | `cloudSyncData.cloudMethod` | `"merge"` (`cloudSync.ts:132`) | `merge`, `read_only`, `upload`, `replace`; upload/replace reset to merge after the run (`cloudSync.ts:169-174`) |
| Team | `cloudSyncData.team` | none | which ChurchApps team's zip is used |
| Device name | `cloudSyncData.deviceName` | asked from main (`GET_DEVICE_NAME`, `cloudSync.ts:93`) | presence display and identification |
| Read-only | `cloudSyncData.cloudMethod` | off | never upload (`Files.svelte:316`) |
| Media sync folder | `special.cloudSyncMediaFolder` | false (`Files.svelte:322`) | copy used media into the sync folder |
| Media sync folder path | `config.mediaFolderPath` | `<data root>/Media` | where copies go |
| Autosave interval | `settings.autosave` | `15min` (`Files.svelte:268`) | how often the autosave trigger can fire |

## Code

- `src/frontend/components/settings/tabs/Files.svelte:280-332` — every cloud control.
- `src/frontend/utils/cloudSync.ts:29-211` — connect, team choice, sync request, status.
- `src/frontend/utils/save.ts:303-321` — sync on autosave and on close.
- `src/electron/cloud/syncManager.ts:69-560` — the merge, upload, guard and restore.
- `src/electron/cloud/syncLedger.ts` — per-item created/deleted ledger.
- `src/electron/cloud/ChurchAppsSyncManager.ts` — S3/CloudFront read, presigned write, weekly backup.
- `src/electron/data/backup.ts:12-88` — what goes into the zip.
- `src/frontend/components/main/popups/CloudMethod.svelte` — merge/read-only/upload/download choice.
- `src/electron/cloud/drive.ts` — legacy Google Drive sync, still present.

## Online docs

- <https://freeshow.app/docs/cloud> — adds the B1.Church ministry/team setup steps
  (`source/docs/cloud.md:10-28`); the code only shows the resulting team list.
- The docs also state the "disconnect and connect again" rule after team membership
  changes (`source/docs/cloud.md:25`), which matches the cached team list in
  `cloudSyncData`.

## Doc vs code

- `doc` says: "First time it will sync right away" (`source/docs/cloud.md:34`).
  Code does: the first call saves and backs up, then returns without a cloud
  request (`cloudSync.ts:134-139`); the upload happens on the next sync because the
  cloud zip is absent (`syncManager.ts:92-96`).
- `doc` says: "A sync will happen automatically each time FreeShow is
  opened/closed, and when 'Autosave' is triggered" (`source/docs/cloud.md:37`).
  Code does: the autosave path also requires unsaved changes, no outputted slide,
  and no sync already running (`save.ts:309-313`).
- `doc` FAQ says different "shows, projects or templates" edited at the same time
  "will be merged" (`source/docs/cloud.md:56-58`). Code does: projects, templates,
  overlays and stage layouts merge per item, but two edits to the *same show* keep
  the newest file (`syncManager.ts:58`, `655-679`). Events and themes are whole-file
  newest-wins (`syncManager.ts:58`).
- `doc` says the media sync folder default is "Documents/FreeShow/Media"
  (`source/docs/cloud.md:46`). Code does: `<data root>/Media` (`files.ts:812-814`),
  which is `Documents/FreeShow/Media` only with the default data path
  (`files.ts:372-391`).
- `doc` says read-only is for "not wanting to risk a device altering the data"
  (`source/docs/cloud.md:50-52`). Code does: read-only is also forced for a run
  when the cloud is 30+ days newer than this device's last modification
  (`syncManager.ts:150-163`).
- Code-only: a legacy **Google Drive** sync still exists (`drive.ts`,
  `Files.svelte:341`) and is not described on the docs page.

## Open questions

- Whether the ChurchApps backend stores `current.zip` per team and how it handles
  concurrent uploads is not in this repository (`unknown`). A run with two clients
  uploading at once would establish it.
- The exact server-side selection for ChurchApps service plans is `unknown`; the
  client asks `/plans/presenter` and does no local date filter
  (`ChurchAppsProvider.ts:67-83`, `ChurchAppsImport.ts:32-45`).
- What the UI shows when port 5502 is already in use: the OAuth listener closes on
  `EADDRINUSE` (`ChurchAppsConnect.ts:117-119`), but the resulting message was not
  traced to a user-facing string (`unknown`).
- Whether the 5-minute renderer timeout leaves a "syncing" status indicator stuck
  when the main process takes longer (`cloudSync.ts:159-160`) — needs a run.
