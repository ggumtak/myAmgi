# myAmgi

개인용 Anki 클라이언트입니다. 안쪽은 공식 Anki 엔진(Rust 백엔드 26.09.4)이라 일정·FSRS·검색·가져오기/내보내기·동기화가
Anki와 똑같이 동작하고, 화면은 하나의 웹 UI(`web/`)를 휴대폰·태블릿·코멧(E-Ink)·PC에서 같이 씁니다.
구조는 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), 화면 규칙은 [`docs/UI_SPEC.md`](docs/UI_SPEC.md)에 있습니다.

## 내려받기

- GitHub 릴리스 **`latest`**(다운로드 페이지)에는 설치 파일만 있습니다.
  - 휴대폰·태블릿 → `myAmgi-Pro-<빌드번호>.apk`
  - 코멧(E-Ink) → `myAmgi-Comet-<빌드번호>.apk`
- 한 번 설치하면 그다음부터는 앱이 스스로 업데이트합니다.
- **`update-files`** 릴리스는 앱이 스스로 쓰는 파일(APK 델타 패치 `.patch`, 화면 번들 `myAmgi-ui-<버전>.zip`과 `ui-manifest.json`)을 두는 곳입니다. 직접 받을 필요가 없습니다.
- **`apk-history`** 릴리스는 델타 패치를 만들 때 쓰는 이전 빌드 보관소입니다.

## 안드로이드 앱 (`app/`)

- 화면은 `HostActivity` 하나입니다. 앱 안에서 도는 로컬 서버(`core`의 `HostServer`, 127.0.0.1, 실행마다 바뀌는 포트와 토큰)가
  웹 UI와 Anki 공식 화면(덱 옵션, 통계 등)을 내주고, 전체 화면 WebView가 그것을 보여 줍니다.
- 휴대폰 기능(공유, 기기에 저장, 파일 고르기, 음성 읽기, 클립보드, 한자 바로보기 연동, 업데이트)은 `AndroidPlatform`이 맡습니다.
- 볼륨키·블루투스 리모컨: 설정에서 켜 두면 볼륨/미디어 키가 화면에 `keydown`(`AudioVolumeUp`, `AudioVolumeDown`, `MediaPlayPause`,
  `MediaTrackNext`, `MediaTrackPrevious` …)으로 전달됩니다. 꺼 두면 볼륨키는 원래대로 소리를 조절합니다.
- 파일 관리자에서 `.apkg`, `.colpkg`, `.txt`, `.csv`를 "myAmgi로 열기"/공유하면 바로 가져오기 화면으로 넘어갑니다.
- 데이터 위치: 컬렉션 `filesDir/anki_collection/`(이전 빌드와 같음), 앱 설정·백업·임시 파일 `filesDir/amgi-host/`, 화면 번들 `filesDir/ui-ota/`.
- 제품 버전: `pro`(휴대폰·태블릿)와 `comet`(E-Ink, 기본 테마 `eink`, 화면 효과 없음). 둘 다 `arm64-v8a` 전용입니다.

## 업데이트

- **APK**: 앱이 `latest`의 새 APK를 확인하고, 있으면 `update-files`의 델타 패치(설치된 APK + 변경분)로 다시 만들어 설치합니다.
  패치가 없거나 검증에 실패하면 전체 APK를 받습니다.
- **화면(UI) 번들**: 웹 UI만 바뀐 경우 APK 없이 화면만 바뀝니다. 앱이 켜질 때(6시간에 한 번까지, 조용히)와
  설정 › 업데이트 확인에서 `ui-manifest.json`을 읽고, 새 번들을 받아 크기·SHA-256을 확인하고 안전하게 풀어 검사한 뒤 교체합니다.
  새 화면이 30초 안에 정상적으로 뜨지 않으면 앱에 들어 있는 기본 화면으로 되돌리고 그 버전은 다시 받지 않습니다.
  `minApkBuild`보다 오래된 APK에는 설치되지 않습니다(`tools/ui_min_apk_build.txt`).

## 빌드와 검사

```bash
# 웹 UI (Node 22)
cd web && npm ci && npm run test && npm run build && cd ..

# 안드로이드 (web/dist가 없거나 오래됐으면 Gradle이 npm 빌드를 먼저 돌립니다; -PskipWebBuild로 건너뜀)
./gradlew :core:test testProDebugUnitTest testCometDebugUnitTest assembleProDebug assembleCometDebug

# 릴리스 도구 (APK 델타 패치, 화면 번들)
python3 -m unittest discover -s tools -p "test_*.py"
python3 tools/make_ui_bundle.py --dist web/dist --out-dir dist --version 1.0.123 --repo ggumtak/myAmgi --min-apk-build 12
```

CI(`.github/workflows/build.yml`)는 웹 UI 테스트·빌드(`AMGI_UI_VERSION=1.0.<실행 번호>`), 엔진·앱 단위 테스트, 두 APK 빌드와 검사,
화면 번들 포장, 델타 패치 생성, 릴리스 게시를 차례로 합니다.

## 구조

```text
myAmgi/
├── core/      # 엔진 래퍼 + 로컬 호스트 서버 (순수 JVM)
├── app/       # 안드로이드 셸 (HostActivity, AndroidPlatform, 업데이트, ContentProvider)
├── desktop/   # PC 실행기 겸 개발용 호스트
├── web/       # 화면 (Vite + React + TypeScript)
├── tools/     # apk_patch.py, make_ui_bundle.py, gen_proto.py
└── docs/
```
