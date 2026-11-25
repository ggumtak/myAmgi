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
| `GET /ui/**` | myAmgi UI bundle. Looks in the OTA directory first (if its version is valid and newer than the built-in one), then the built-in bundle. `/ui/` serves `index.html`. |
| `GET /_app/**`, `GET /<official route>` | Official Anki SvelteKit pages from the backend artifact (`backend/sveltekit`): `deck-options`, `graphs`, `card-info`, `congrats`, `change-notetype`, `image-occlusion`, `import-anki-package`, `import-csv`, `import-page`. |
| `GET /_anki/**` (static) | Official `backend/js`, `backend/css` (reviewer.js, reviewer.css, MathJax). |
| `POST /_anki/<camelCaseMethod>` | Raw protobuf request → backend method `<method>Raw(byte[])` → raw protobuf response. Errors: status 500, body = UTF-8 message. Frontend-service methods the backend does not implement are answered by the host (see `HostServer`). |
| `GET /media/<file>` | A file from `collection.media`. URL-decoded once. Supports `Range` (audio/video seeking), correct MIME type, `Cache-Control: no-cache` with `Last-Modified`. Path traversal rejected. |
| `GET /media/__amgi_frame.html` | The card frame document from the UI bundle (`card-frame.html`). Cards render inside an iframe with this URL so that relative media references in card HTML resolve to `/media/...`, and deck scripts/styles stay isolated from the app UI. |
| `POST /api/host/<name>` | JSON in, JSON out. Host functions, below. Errors: non-2xx with `{"error": "<Korean message>", "detail": "<stack or code>"}`. |
| `GET /api/host/events` | Server-sent events: `progress` (sync/import/export), `back` (Android back button), `open-file` (a file was opened with the app), `sync-state`. |
| `POST /api/host/upload?name=<file>` | Streams the request body to a temp file; returns `{"path": "..."}` for import calls. |
| `GET /api/host/download?path=<temp path>&name=<file>` | Streams a host-created export file (only from the host's export temp dir). |

### Host functions (`/api/host/<name>`)

UI state must not rely on `localStorage`: the port (and therefore the origin) changes between launches.

- `info` → `{appVersion, build, flavor, platform: "android"|"desktop", eink, device, uiVersion, backendVersion}`
- `prefs.get` `{}` → all UI preferences as one JSON object; `prefs.set` `{key: value, ...}` (merged, persisted by the host)
- `collection.status` → open/closed, path, size, last error
- `sync.status`, `sync.login {user, password, endpoint?}`, `sync.logout`, `sync.run {mode: "normal"|"upload"|"download"}`, `sync.abort`
  (AnkiWeb protocol via the backend; the host handles "full sync required" by returning `{"needsFullSync": true}` so the UI asks the owner for a direction; media sync runs after collection sync, progress over events)
- `backup.create`, `backup.list`, `backup.restore {name}` (`.colpkg` files in the host backup dir, automatic backup before every full download / colpkg import / restore)
- `import.file {path, name}` → classifies `.apkg` / `.colpkg` / text and returns the UI route to continue with
- `export.package {deckId?, withScheduling, withMedia, legacy}` / `export.collection {withMedia}` → `{path, name}` then the shell saves or shares it
- `platform.share {path, name}`, `platform.openExternal {url}`, `platform.tts {text, lang, rate}`, `platform.ttsStop`, `platform.clipboardWrite {text}`, `platform.exit`
- `hanja.lookup {text, sentence?}` (Android: opens the owner's Hanja app through `hanja://lookup`)
- `update.status`, `update.check`, `update.apply` (APK on Android, OTA UI bundle everywhere)
- `log.get` → recent host log + last errors, for the "오류 로그 복사" button

Anything not listed that needs the engine goes through `/_anki/<method>` directly from the UI.

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
