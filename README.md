# myAmgi

개인 맞춤형 Anki(`.apkg`) 기반 플래시카드 학습 앱입니다.  
스마트폰·태블릿·이노스페이스원 코멧(E-Ink)·PC 웹 PWA까지 **최대 5대 기기를 무료 Supabase 클라우드로 동기화**하며 학습할 수 있습니다.

---

## 내려받기

- GitHub 릴리스의 **`latest`(다운로드 페이지)** 에는 설치 파일만 있습니다.
  - 휴대폰·태블릿 → `myAmgi-Pro-<빌드번호>.apk`
  - 코멧(E-Ink) → `myAmgi-Comet-<빌드번호>.apk`
- 한 번 설치하면 그다음부터는 앱이 스스로 업데이트합니다.
- **`update-files`** 릴리스는 앱 자동 업데이트용 파일(델타 패치 `.patch`, `ota-manifest.json`, `ota__*`)을 두는 곳입니다. 직접 받을 필요가 없습니다.
- **`apk-history`** 릴리스는 델타 패치를 만들 때 쓰는 이전 빌드 보관소입니다. 이것도 직접 받을 필요가 없습니다.

---

## 빌드 에디션 비교: Pro vs Comet

두 버전 모두 `arm64-v8a` 전용 경량 APK로 빌드됩니다.

| 구분 | `myAmgi-Pro` | `myAmgi-Comet` |
| --- | --- | --- |
| **대상 기기** | 일반 Android 스마트폰 / 태블릿 | **이노스페이스원 코멧(Comet)** 등 E-Ink 리더기 |
| **화면/렌더링** | 부드러운 전환 애니메이션, 다크/라이트 자동 모드 | E-Ink 고대비 흑백 최적화, 잔상 방지, 애니메이션 최소화 |
| **조작 방식** | 터치 + 2버튼 학습 + 볼륨키/블루투스 리모컨 | E-Ink 물리 버튼/터치 최적화 + 2버튼 학습 |
| **패키지 구조** | `pro` productFlavor | `comet` productFlavor |

---

## 핵심 기능

### 1. 2버튼 학습 & 빠른 단축 조작
- 복잡한 4버튼(Again/Hard/Good/Easy) 대신 직관적인 **2버튼 학습 모드(모름 / 암기 완료)** 기본 제공 (설정에 따라 표준 모드 전환 가능).
- **볼륨 키 / 블루투스 리모컨 / 키보드 단축키**로 화면을 가리지 않고 빠르게 정답 확인 및 채점.

### 2. 한자(Hanja) 즉시 조회 연동
- 카드 내부의 한자(`hanja/anki-tap.js`)를 탭하면 뜻/음과 부수 정보를 즉시 팝업으로 확인할 수 있습니다.
- 대형 카드 편집기(`editor/large-editor.html`) 및 커스텀 카드 스타일(`card/card-base.css`) 지원.

### 3. 5대 기기 무료 Supabase 동기화
- **대상**: 태블릿 + 스마트폰 2대 + PC(Web PWA) + 이노스페이스원 코멧 등 5대 이상 자유롭게 연결.
- **무료 인프라**: Supabase Free Tier(DB 500MB + Storage 1GB) 활용.
- **1초 기기 연동 코드**: 첫 기기에서 로그인 후 `MYAMGI1:...` 코드를 복사해 나머지 기기에 붙여넣기만 하면 URL·키·계정 정보가 즉시 연동됩니다.
- **증분 + 스냅샷 하이브리드 동기화**:
  - `amgi_collections`: 전체 `.apkg` / 컬렉션 스냅샷 메타데이터
  - `amgi_sync_items`: 덱·노트타입·노트·카드·복습 로그(`revlog`) LWW 증분 동기화
  - `amgi_media_manifest` & `amgi-media` 비공개 버킷: 미디어 SHA-256 중복 제거 업로드/다운로드
  - `amgi_user_settings`: 기기 간 학습 설정 동기화
- 자세한 설정 방법은 [`supabase/SETUP_GUIDE.md`](./supabase/SETUP_GUIDE.md)를 참고하세요.

### 4. 2단계 초고속 업데이트 (OTA 핫패치 + 바이너리 델타 패치)
- **1단계 — OTA 에셋 핫패치 (`tools/make_ota_manifest.py`)**:
  - `card/card-base.css`, `card/card-bridge.js`, `hanja/anki-tap.js`, `editor/large-editor.html` 변경 시 APK 재설치 없이 `ota-manifest.json`으로 즉시 반영합니다.
- **2단계 — APK 바이너리 델타 패치 (`tools/apk_patch.py`)**:
  - `AMGPAT01` 포맷으로 이전 Pro/Comet 빌드 대비 변경된 바이트만 `.patch`로 내려받아 기기에서 기존 APK와 결합·SHA-256 검증 후 업데이트합니다(전체 APK 대비 65% 미만일 때만 생성).

### 5. PC 웹 PWA (`web/`)
- 별도 설치 없이 브라우저에서 학습·카드 관리·Supabase 동기화를 그대로 사용할 수 있는 React/Vite 기반 PWA입니다.
- `main` 브랜치의 `web/**` 변경 시 GitHub Pages(`https://<username>.github.io/myAmgi/`)로 자동 테스트·빌드·배포됩니다.

---

## 프로젝트 구조

```text
myAmgi/
├── app/                          # Android 앱 (Pro / Comet productFlavors)
├── web/                          # PC 웹 PWA (Vite + React)
├── supabase/
│   ├── migrations/0001_init.sql  # 멱등(Idempotent) 테이블·RLS·스토리지 버킷 SQL
│   └── SETUP_GUIDE.md            # 5대 기기 무료 Supabase 연동 가이드
├── tools/
│   ├── apk_patch.py              # AMGPAT01 바이너리 델타 패치 생성/적용 도구
│   ├── make_ota_manifest.py      # OTA 핫패치 매니페스트 및 에셋 생성기
│   └── test_tools.py             # Python 도구 단위 테스트
└── .github/workflows/
    ├── build.yml                 # Pro/Comet APK 빌드, arm64 검증, latest·update-files 릴리스 게시
    └── deploy-web.yml            # Web PWA 테스트 및 GitHub Pages 배포
```

---

## 개발 및 검증

### Python 업데이트 도구 테스트
```bash
python3 -m unittest -v tools/test_tools.py
```

### OTA 매니페스트 수동 생성 예시
```bash
python3 tools/make_ota_manifest.py \
  --assets-dir app/src/main/assets \
  --out-dir dist/ota \
  --version 1 \
  --repo ggumtak/myAmgi
```
