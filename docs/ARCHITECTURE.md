# myAmgi architecture (decided 2026-11-25)

myAmgi is a personal, single-user Anki client for the owner's devices: Android phone/tablet (`pro`),
Innospace Comet e-ink reader (`comet`), and a PC. It must behave exactly like Anki, because it *is* Anki
underneath: scheduling, FSRS, search, import/export, sync and statistics all come from the official Anki
Rust backend (`io.github.david-allison:anki-backend-*:0.1.77-anki26.09.4`). We never re-implement engine logic.

## Why this shape

- The earlier hand-written native Kotlin UI could not be run or tested outside a physical device, so defects
  only showed up on the owner's tablet. A web UI served by a local host can be driven end-to-end by Playwright
  against the real engine on a development machine.
- One UI for Android and PC, with the same engine on both.
- UI changes ship as an OTA bundle; a new APK is only needed for native changes.

## Modules

| Path | What | Depends on |
| --- | --- | --- |
| `core/` | Pure Kotlin/JVM (no Android APIs). Engine wrapper (`AnkiEngine`), loopback `HostServer`, routing, media serving, sync/import orchestration, `Platform` interface for things only the shell can do. | `anki-backend-core` |
| `app/` | Android shell. One WebView activity pointed at the host server, `Platform` implementation (file chooser, share, TTS, intents, installer), the exported ContentProvider used by the owner's Hanja app, APK/OTA updater. Flavors `pro` and `comet`. | `core`, `anki-backend-android` |
| `desktop/` | JVM launcher for PC and the **development/test host**. Starts `HostServer` with the desktop native library from `anki-android-backend-testing`, then opens the browser. | `core`, `anki-android-backend-testing` |
| `web/` | The UI: Vite + React + TypeScript. Talks only to the host server. Built output is bundled into the APK assets and the desktop jar, and published as the OTA bundle. | — |

The old native screens in `app/` stay until their web replacement ships, then are deleted.
The old browser-only engine in `web/src/engine`, `web/src/db`, `web/src/importers`, `web/src/sync` is retired:
it was a separate scheduler and could not match Anki.

## Host server contract (`core`)

Binds `127.0.0.1` on a random free port (a fixed port can be requested for development).

Security: the shell opens `http://127.0.0.1:<port>/?t=<token>`; the server answers with a `Set-Cookie: amgi_t=<token>;
HttpOnly; SameSite=Strict` redirect to `/ui/`. Every other request must carry that cookie (or header `X-Amgi-Token`),
and a `Host` header of `127.0.0.1:<port>` or `localhost:<port>`; otherwise `403`. No CORS headers.

| Route | Behaviour |
| --- | --- |
| `GET /ui/**` | myAmgi UI bundle. Each bundle carries `ui-version.json` = `{"version": "<dotted numbers>", "minBuild": <n>}` at its root (the web build writes it; `minBuild` comes from `web/min-native-build.json`, missing = 0). The OTA directory is used only if it has an `index.html`, a valid version newer than the built-in one, and a `minBuild` not above the running native build (APK `versionCode`; the desktop host does not check); files missing there fall back to the built-in bundle. `/ui/` serves `index.html`. |
| `GET /_app/**`, `GET /<official route>` | Official Anki SvelteKit pages from the backend artifact (`backend/sveltekit`): `deck-options`, `graphs`, `card-info`, `congrats`, `change-notetype`, `image-occlusion`, `import-anki-package`, `import-csv`, `import-page`. |
| `GET /_anki/**` (static) | Official `backend/js`, `backend/css` (reviewer.js, reviewer.css, MathJax). |
| `POST /_anki/<camelCaseMethod>` | Raw protobuf request → backend method `<method>Raw(byte[])` → raw protobuf response. Errors: status 500, body = UTF-8 message. Frontend-service methods the backend does not implement are answered by the host (see `HostServer`). |
| `GET /media/<file>` | A file from `collection.media`. URL-decoded once. Supports `Range` (audio/video seeking), correct MIME type, `Cache-Control: no-cache` with `Last-Modified`. Path traversal rejected. |
| `GET /media/__amgi_frame.html` | The card frame document from the UI bundle (`card-frame.html`). Cards render inside an iframe with this URL so that relative media references in card HTML resolve to `/media/...`, and deck scripts/styles stay isolated from the app UI. |
| `POST /api/host/<name>` | JSON in, JSON out. Host functions, below. Errors: non-2xx with `{"error": "<Korean message>", "detail": "<stack or code>"}`. |
| `GET /api/host/events` | Server-sent events: `progress` (sync/import/export/backup), `back` (Android back button), `open-file` (a file was opened with the app), `sync-state`, `anki-page` `{method, close}` (an embedded official page made a frontend-service call; `close: true` means the UI should close that page, e.g. after deck options were saved). |
| `POST /api/host/upload?name=<file>` | Streams the request body to a temp file in `dataDir/tmp`; returns `{path, name, size}` for import calls. The upload is deleted once its import ran (success or failure): after `import.file` with `replace: true` for `.colpkg`, and after the official pages' `importAnkiPackage` / `importCsv` RPC. Temp uploads/exports older than 1 h are deleted at start and before every new upload/export. |
| `GET /api/host/download?path=<temp path>&name=<file>` | Streams a host-created export file (only from the host's export temp dir). |

### Host functions (`/api/host/<name>`)

UI state must not rely on `localStorage`: the port (and therefore the origin) changes between launches.

- `info` → `{appVersion, build, flavor, platform: "android"|"desktop", eink, device, uiVersion, backendVersion}`
- `prefs.get` `{}` → all UI preferences as one JSON object; `prefs.set` `{key: value, ...}` (merged, persisted by the host; a `null` value deletes the key)
- `collection.status` → open/closed, path, size, last error
- `sync.status` → `{loggedIn, user, endpoint, running, phase, needsFullSync, lastSync, lastError}`, `sync.login {user, password, endpoint?}`, `sync.logout`, `sync.run {mode: "normal"|"upload"|"download"}` → `{ok, needsFullSync, serverMessage, lastSync}`, `sync.abort`
  (AnkiWeb protocol via the backend. "Full sync required" returns `needsFullSync: true` so the UI asks the owner for a direction — except that an empty local collection downloads and an empty server uploads automatically. A backup is taken before any download. Media sync follows unless pref `sync.media` is false. Progress over events. Errors: 401 not logged in / login expired, 409 busy or cancelled, 502 network.)
- `backup.create`, `backup.list`, `backup.restore {name}` → `{ok, safetyBackup}` (`backup-YYYY-MM-DD-HH.MM.SS.colpkg` in `dataDir/backups`, without media like Anki's own backups, kept count = pref `backup.keep`, default 20; automatic backup before every full download / colpkg import / restore)
- `import.file {path, name, replace?}` → `{kind: "apkg"|"colpkg"|"csv", path, route}`; `path` must come from `/api/host/upload`. `route` is the official page to continue with (`/import-anki-package/<encoded path>` or `/import-csv/<encoded path>`). A `.colpkg` replaces the whole collection only with `replace: true` (after an automatic backup); without it the answer is `needsConfirm: true`.
- `export.package {deckId?, withScheduling, withMedia, legacy}` / `export.collection {withMedia}` → `{path, name, size, notes?}` (`name` is the display file name to pass to `/api/host/download?name=`), then the shell saves or shares it
- `platform.share {path, name}`, `platform.openExternal {url}`, `platform.tts {text, lang, rate}`, `platform.ttsStop`, `platform.clipboardWrite {text}`, `platform.exit`
- `hanja.lookup {text, sentence?}` (Android: opens the owner's Hanja app through `hanja://lookup`)
- `update.status`, `update.check`, `update.apply` (APK on Android, OTA UI bundle everywhere). An APK newer than the installed build always wins; otherwise the OTA UI bundle is applied. A remote UI bundle whose `minBuild` is above the installed build is never applied (`uiNeedsApk: true`, `uiMinBuild`, Korean `message`). A second `update.apply` while an APK download runs answers `inProgress: true` with a message. A failed GitHub API call (e.g. the 60/h rate limit) is reported in `error`, not as "up to date".
- `log.get` → recent host log + last errors, for the "오류 로그 복사" button

Anything not listed that needs the engine goes through `/_anki/<method>` directly from the UI.

## Android shell (`app/`)

- `MainActivity` handles `uiMode|screenLayout|smallestScreenSize|density|fontScale` (plus orientation/keyboard) itself: a dark-mode switch or split screen keeps the WebView and its state; the page follows `prefers-color-scheme` and re-sends its bar colours.
- A WebView renderer crash (`onRenderProcessGone`) recreates the WebView and reloads the start URL; the host server and a running sync keep going.
- OTA boot watchdog: only while an OTA UI bundle is active, the shell expects `AndroidShell.uiReady()` within 15 s of the UI page's `onPageFinished`; otherwise it asks once per launch "화면을 불러오지 못했습니다" with "기본 화면으로 복구" (deletes the OTA directory and reloads) or "계속 기다리기".
- `SyncForegroundService` (type `dataSync`) is never stopped with `stopService()`; it answers every start with `startForeground()` and then stops itself when sync is idle. If Android refuses a foreground service (background start), sync continues without the notification.
- Android backup and device transfer are disabled (`allowBackup="false"`, `data_extraction_rules.xml` excludes everything); the app has its own backups and AnkiWeb sync.

## UI ↔ engine RPC (`web/src/anki`)

- `tools/gen_proto.py` extracts the protobuf descriptors from the PyPI wheel `anki==26.9.4` (same version as the backend)
  and produces the protobufjs static module + `.d.ts` committed under `web/src/anki/generated/`. Re-run when the backend version changes.
- `web/src/anki/rpc.ts`: `call(method, RequestType, ResponseType, request)` → `POST /_anki/<method>`; plus thin typed wrappers
  grouped by area (`decks.ts`, `scheduler.ts`, `notes.ts`, `notetypes.ts`, `search.ts`, `stats.ts`, `config.ts`, ...).
- `web/src/host.ts`: typed client for `/api/host/*` and the events stream.
- Engine errors surface as a typed `AnkiError` with the backend's localized message (backend language list is `ko, en`).

## UI rules

- Language: Korean UI text. Code and comments in English.
- Themes: `light`, `dark`, `eink` (pure black on white, no animation or transitions, no shadows, thick borders, large targets, no hover-only affordances).
  `eink` is the default on the `comet` flavor.
- Layout: phone = single column; width ≥ 900px (tablets, PC) = two panes where it helps (deck list + deck overview, browser list + preview).
- Every screen has explicit loading, empty and error states; errors show a Korean message and "오류 로그 복사".
- Navigation is a hash router; Android back = history back, and on the root screen asks the host to exit.
- Keyboard: Anki desktop shortcuts in the reviewer (Space/Enter, 1–4, U/Ctrl+Z undo, E edit, R replay, `*` mark, `-` bury, `@` suspend, Ctrl+1–7 flags); volume keys and Bluetooth remotes are mapped by the shell to the same actions.
- Card rendering uses the official `reviewer.js`/`reviewer.css` from the backend so templates, MathJax, cloze, type-in-answer and audio behave as in Anki.

## Feature parity target (what "everything Anki does" means here)

Engine-backed, reached through official pages: deck options incl. FSRS and all limits, statistics graphs, card info, CSV import, package import options, change note type, image occlusion.
Engine-backed, own UI: deck list with counts, deck create/rename/delete/move/collapse, filtered decks, study overview, custom study, reviewer (4 buttons with intervals, 2-button mode, undo/redo, bury/suspend/flag/mark/forget/set due date, edit during review, audio/TTS, type answer, timer), card browser (search syntax, columns, sort, multi-select actions, preview), note editor (fields, tags, cloze, media attach, change deck/type, duplicate check), note type and template management (large templates supported), tag management, find and replace, check database, check media, empty cards, backups, import/export `.apkg`/`.colpkg`, AnkiWeb sync, preferences.

## Verification

- `./gradlew :core:test` — engine and host server tests on the JVM with the real backend.
- `./gradlew :desktop:run --args="--port 40001 --dir <tmp>"` — development host.
- `web`: `npm run test` (unit) and `npm run e2e` (Playwright against the development host with a seeded collection). Screenshots of each screen in `light`, `dark`, `eink`, phone and tablet sizes are reviewed before shipping.
- CI builds both APK flavors, runs all of the above, and publishes.

## Releases

- Release `latest` (the download page) holds exactly three files: `myAmgi-Pro-<n>.apk` (phone/tablet), `myAmgi-Comet-<n>.apk` (Comet), and the PC package once `desktop/` ships.
- Release `update-files` holds machine files for in-app updates (delta patches, OTA bundle, manifests). `apk-history` keeps older APKs for patch generation.
- `applicationId`, provider authorities and the signing key never change.
- Build mode (`.github/workflows/build.yml`, step "Decide build mode"): a push to `main` is **OTA-only** when tag `latest` (the commit of the published APKs) exists, the run that published it succeeded, every file changed since then matches `web/**`, `docs/**`, `**/*.md`, `tools/visual_qa.py`, `.github/workflows/deploy-web.yml`, and `web/min-native-build.json` is not above the published APK build. OTA-only runs web tests/build and `:core:test`, then uploads only `ui-bundle.zip` and `ui-version.json` to `update-files` (no APK, no tag move, no prune). Anything else, any error, or `workflow_dispatch` input `force_apk` builds and publishes APKs as before.
- `web/min-native-build.json` = `{"minBuild": N}`: raise N to the run number of the main build that ships a native capability the UI starts to rely on (see the comment in `web/vite.config.ts`). APKs built before `minBuild` existed (≤ 15) do not check it.
- Signing: secrets `SIGNING_KEYSTORE_BASE64` etc., else the key in the Actions cache `myamgi-signing-v1`. If neither exists the job fails; a new key is generated only with `workflow_dispatch` input `allow_new_signing_key`. Every APK build prints the certificate SHA-256 fingerprint in the log and job summary.
