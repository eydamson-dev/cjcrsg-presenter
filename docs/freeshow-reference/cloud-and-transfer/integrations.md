# Integrations

- **ID:** `integration.bible`, `integration.planningcenter`, `integration.churchapps`, `integration.pixabay`, `integration.unsplash`
- **Area:** cloud-and-transfer
- **Online docs:** <https://freeshow.app/docs/integrations>
- **Pinned code:** ff784eb
- **Confidence:** `code`. No provider was contacted during this pass.

## Summary

Five online services are documented. All five need a network connection while in
use. Three have an account flow (Planning Center, ChurchApps, and API.Bible only
through a bundled key); two (Pixabay, Unsplash) need no account at all because the
application ships its own API keys.

## What the user sees

Settings > **Connection** tab (`settings.connection`, `public/lang/en.json:1359`)
holds the account connections (`src/frontend/components/settings/tabs/Connection.svelte:283-307`):

- **Connect to Planning Center**
- **Connect to ChurchApps**
- (code-only extras: **APlay** and **OnStage**, `Connection.svelte:301-307`)

Scripture versions are chosen in the Scripture drawer's import popup, **API** tab
(`src/frontend/components/main/popups/ImportScripture.svelte:95-99`).
Pixabay and Unsplash are tabs in the Media drawer's **Online** section
(`src/frontend/components/drawer/media/Media.svelte:34-35`, `546-552`).

Screenshot: `../screenshots/cloud-and-transfer-integrations.png` — not yet captured.

Shot list (reference at ff784eb, main window, 1280×800):

1. Settings > Connection with nothing connected — the provider buttons.
2. Settings > Connection with Planning Center connected.
3. Media drawer > Online > Pixabay, one search result row.
4. Scripture import popup, API tab, a few versions.

## How it behaves

### API.Bible (`integration.bible`)

1. The version list is requested from a ChurchApps proxy,
   `https://api.churchapps.org/content/bibles`, via the bundled `json-bible`
   package; on failure it retries against API.Bible directly with a bundled key
   (`src/frontend/components/drawer/bible/scripture.ts:27-36`).
2. Selecting a version stores **metadata only** in the `scriptures` store:
   `{ name, api: true, id: sourceKey, metadata: { copyright }, attributionRequired, attributionString }`
   (`ImportScripture.svelte:70-80`). No text is written to disk.
3. Text is fetched per request through `JsonBibleApi`, with an in-memory cache
   (`scripture.ts:42-62`). Offline, the fetch throws and the version produces no
   content; there is no local copy to fall back to (`code`, from the absence of a
   write path).
4. Local `.fsb` bibles go through `Main.BIBLE` and the separate local path
   (`ImportScripture.svelte:101-112`, `scripture.ts:88-117`).
5. The docs' "over 200 versions" (`source/docs/integrations.md:12`) is not a number
   the code can confirm: the count is whatever the list endpoint returns (`unknown`).

### Planning Center (`integration.planningcenter`)

1. **Connect to Planning Center** starts OAuth 2 with PKCE against
   `https://api.planningcenteronline.com`, redirect
   `http://localhost:5501/auth/complete` (`src/electron/contentProviders/planningCenter/connect.ts:40`, `63-130`).
   The scope used is `services`; the provider declares `calendar`, `check_ins`,
   `giving`, `groups`, `people`, `publishing`, `services`
   (`PlanningCenterProvider.ts:35`).
2. The token is stored through `setContentProviderAccess("planningcenter", scope, data)`
   (`connect.ts:119`), refreshed with the refresh token (`141-163`), and a failed
   refresh falls back to a full login (`165-173`).
3. A connected token is required for the startup load (`connect.ts:209-212`).
   The load walks every service type, or only the folders selected in settings
   (`request.ts:388-410`; folder ids from `Connection.svelte:124`).
4. Plans are requested with `filter=future`; plans with `items_count === 0` are
   skipped, and plans more than **one week** ahead are dropped
   (`src/electron/contentProviders/planningCenter/request.ts:470-496`). This is the
   docs' "within one week on startup" (`source/docs/integrations.md:19`), confirmed
   in code.
5. Each plan becomes a project of shows; referenced media is queued for download
   (`request.ts:414-420`).

### ChurchApps (`integration.churchapps`)

1. **Connect to ChurchApps** uses OAuth 2 (client id + secret, no PKCE) on port
   **5502**, login at `https://admin.b1.church/login?returnUrl=...`, token endpoint
   `/membership/oauth/token`, scope `plans`
   (`src/electron/contentProviders/churchApps/ChurchAppsConnect.ts:109-165`;
   scope at `ChurchAppsProvider.ts:40`).
2. On startup the provider connects, **uploads missing songs**, then **loads
   service plans** (`ChurchAppsProvider.ts:71-83`).
3. Song upload compares local shows with the server and sends only the missing ones
   (`ChurchAppsExport.ts:75-88`). The candidate shows are those whose category is
   in `contentProviderData.churchApps.syncCategories`, defaulting to `["song"]`
   (`ChurchAppsExport.ts:90-94`; the data is passed from `startup.ts:159`). Songs go
   to `POST /songs/import` in batches of 10 (`ChurchAppsExport.ts:48-62`).
4. Plans are fetched from `GET /plans/presenter` (api `doing`) and expanded into
   projects and shows (`ChurchAppsImport.ts:24-54`). The client applies **no date
   filter**; the docs' "a week ahead" (`source/docs/integrations.md:25`) is
   therefore a server decision (`unknown` whether the server filters).
5. This account is also the cloud-sync provider; see `cloud-sync.md`.

### Pixabay (`integration.pixabay`)

1. Search calls `https://pixabay.com/api/` (images) or `/videos/` with a bundled
   key, `safesearch=true`, 80 results per page (`src/frontend/components/drawer/media/pixabay.ts:8-13`).
2. Results keep the remote URL (`largeImageURL`, or `videos.medium.url`), a preview
   URL, tags as the name, and a credits object (`pixabay.ts:20-24`, `38-49`).
3. Results are cached in memory per query (`pixabay.ts:6`, `10`, `26`).

### Unsplash (`integration.unsplash`)

1. Search calls `https://api.unsplash.com/search/photos/` with
   `client_id`, `content_filter=high`, 30 results (`src/frontend/components/drawer/media/unsplash.ts:12`).
2. Results use `urls.full || urls.regular`, a thumb, and credits with UTM links
   (`unsplash.ts:19-22`, `36-49`).
3. When the image is used, the `trigger_download` URL is fetched once, which is
   Unsplash's API requirement (`src/frontend/components/drawer/media/MediaCard.svelte:142-144`).
4. There is no video endpoint in this file — Unsplash is photos only, though the
   docs mention "images and videos" for the pair (`source/docs/integrations.md:31`).

### Both image providers: what is downloaded

- Until an item is used, only URLs and metadata are held. When the media is shown,
  it is downloaded into `<data>/Online/<url-hash><extension>`
  (`src/electron/data/downloadMedia.ts:214-258`, `287-299`; folder name at
  `src/electron/utils/files.ts:356-370`).
- Downloads are hashed by URL, so the same URL is fetched once per installation
  (`downloadMedia.ts:213-218`).
- API keys are constants decrypted at runtime (`src/frontend/values/keys.ts:7-10`);
  there is no settings field for them.

## State and persistence

| What | Where it lives | When it is written | Survives restart |
| --- | --- | --- | --- |
| API Bible entries (`api: true`) | `scriptures` in `SYNCED_SETTINGS` (`save.ts:261`) | when a version is toggled | yes, and synced |
| Provider tokens | `ACCESS` store (`src/electron/data/store.ts:52`; write at `ChurchAppsConnect.ts:155`, `connect.ts:119`) | login/refresh | yes, machine-local, not synced |
| Planning Center folder selection | `contentProviderData.planningcenter.syncFolderIds` in `SETTINGS` (`save.ts:206`) | when changed | yes, machine-local |
| ChurchApps song categories | `contentProviderData.churchApps.syncCategories` in `SETTINGS` | when changed | yes, machine-local |
| Downloaded online images/videos | `<data>/Online` (`files.ts:356-370`) | first use | yes |
| Imported/local bibles | `<data>/Bibles` (`files.ts:356-370`) | on import | yes |

## Settings

| Setting | Key and location | Default | Effect |
| --- | --- | --- | --- |
| Planning Center folders | `contentProviderData.planningcenter.syncFolderIds` | all | limits which service types are synced (`request.ts:391-401`) |
| Planning Center auto sync | `contentProviderData.planningcenter.autoSync` | on (`!== false`) | skip startup sync when off (`startup.ts:158`) |
| ChurchApps song categories | `contentProviderData.churchApps.syncCategories` | `["song"]` (`ChurchAppsExport.ts:92`) | which shows are uploaded as songs |
| ChurchApps cloud-only | `special.churchAppsCloudOnly` | off | use ChurchApps only for cloud sync, not as a content provider (`Connection.svelte:110-125`) |

## Code

- `src/frontend/components/drawer/bible/scripture.ts:27-117` — API list, API text, local bibles.
- `src/frontend/components/main/popups/ImportScripture.svelte:70-112` — selecting versions.
- `src/electron/contentProviders/planningCenter/{connect,request}.ts` — OAuth, one-week load.
- `src/electron/contentProviders/churchApps/{ChurchAppsConnect,ChurchAppsExport,ChurchAppsImport}.ts` — OAuth, song upload, plans.
- `src/frontend/components/drawer/media/{pixabay,unsplash}.ts` — search.
- `src/electron/data/downloadMedia.ts:214-299` — download on use.
- `src/frontend/values/keys.ts:7-10` — bundled Pixabay/Unsplash/API.Bible keys.

## Online docs

- <https://freeshow.app/docs/integrations> — adds the B1.Church account prerequisite
  for ChurchApps and the one-week Planning Center window; both are consistent with
  code except where noted below.
- <https://freeshow.app/docs/scripture> — the scripture drawer page, which explains
  collections and templates around the API versions; not covered here.

## Doc vs code

- `doc` says: "Pixabay & Unsplash ... images and videos"
  (`source/docs/integrations.md:31`). Code does: Pixabay searches photos and videos
  (`pixabay.ts:12`), Unsplash searches `/search/photos/` only (`unsplash.ts:12`).
- `doc` says: "over 200 available Bible versions"
  (`source/docs/integrations.md:12`). Code does: whatever the list endpoint returns;
  no count is asserted (`scripture.ts:29-36`) — `unknown` until a run.
- `doc` says: "Go to the 'Connections' tab in the settings"
  (`source/docs/integrations.md:19`, `25`). Code does: the tab label is
  **Connection**, singular (`public/lang/en.json:1359`), and the same tab also holds
  the remote/stage server settings (`Connection.svelte:97-108`).
- `doc` lists five integrations. Code also ships **AmazingLife/APlay**, **OnStage**
  and **Canva** providers (`Connection.svelte:299-307`,
  `src/electron/contentProviders/`), which the integrations page does not mention.
- `doc` does not say that Pixabay/Unsplash results are saved locally; code downloads
  them on first use (`downloadMedia.ts:214-258`).

## Open questions

- Whether the ChurchApps Bible proxy is required for the version list, and what a
  user sees when both the proxy and the direct API fail (`scripture.ts:29-36`,
  `52-61`) — `unknown` without a run.
- Which library supplies `getKey("bibleapi")` and whether that key is shared or
  per-installation (`keys.ts:7-10`) — `unknown` from the frontend file alone.
- The Planning Center provider also exposes live/Pusher helpers (`live.ts`); whether
  any UI reaches them is outside the docs page and untraced (`unknown`).
- Whether the ChurchApps server limits `/plans/presenter` to a week ahead — the
  client does not (`ChurchAppsImport.ts:32-45`) — `unknown`.
