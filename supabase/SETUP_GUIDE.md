# myAmgi Supabase 무료 동기화 설정 가이드 (5대 기기 연동)

**태블릿 + 스마트폰 2대 + PC(웹) + 이노스페이스원 코멧(E-Ink)** 총 5대의 기기를 Supabase 무료 플랜으로 실시간 동기화하는 방법입니다.  
한 번만 설정해 두면, 이후 추가 기기는 **1초 기기 연동 코드(`MYAMGI1:...`)** 복사/붙여넣기 한 번으로 바로 연결됩니다.

---

## 1. Supabase 무료 프로젝트 생성

1. [Supabase](https://supabase.com/)에 접속해 **Start your project** → GitHub 계정으로 로그인합니다.
2. **New project**를 클릭하고 아래처럼 입력합니다.
   - **Organization**: 기본 조직 선택 (없으면 생성)
   - **Name**: `myamgi-sync` (원하는 이름)
   - **Database Password**: 안전한 비밀번호 입력 (기록해 두면 좋음)
   - **Region**: **Northeast Asia (Seoul)** (`ap-northeast-2`) 권장
3. **Create new project**를 누르고 프로젝트가 준비될 때까지 1~2분 기다립니다.

---

## 2. SQL Editor에 `0001_init.sql` 실행

1. Supabase 대시보드 왼쪽 메뉴에서 **SQL Editor** 아이콘(`>_`)을 클릭합니다.
2. **New query**를 누릅니다.
3. 저장소의 [`supabase/migrations/0001_init.sql`](./migrations/0001_init.sql) 파일 내용을 **전체 복사**해 SQL Editor에 붙여넣습니다.
4. 오른쪽 아래 **Run** 버튼(또는 `Ctrl+Enter` / `Cmd+Enter`)을 누릅니다.
5. `Success. No rows returned` 메시지가 나오면 완료입니다.
   - 이 SQL은 **여러 번 실행해도 안전(Idempotent)** 하며, 4개 테이블(`amgi_user_settings`, `amgi_collections`, `amgi_sync_items`, `amgi_media_manifest`), RLS 보안 정책, 비공개 미디어 버킷(`amgi-media`)을 한 번에 생성합니다.

> **권장 설정 (이메일 인증 끄기)**:  
> 개인 전용 동기화 계정을 바로 만들려면 대시보드 **Authentication → Providers → Email**로 이동해 **Confirm email**을 **OFF**로 바꾸고 **Save**를 누르세요. 회원가입 즉시 로그인됩니다.

---

## 3. Project URL & anon key 복사

1. 왼쪽 메뉴에서 **Project Settings(톱니바퀴) → API** (또는 **Data API** / **API Keys**)로 이동합니다.
2. 아래 두 값을 복사합니다.
   - **Project URL**: 예) `https://abcdefghijklmno.supabase.co`
   - **Project API keys → `anon` (`public`)**: `eyJ...`로 시작하는 긴 문자열 (또는 `sb_publishable_...`)

> **주의**: `service_role` 키는 절대 앱이나 웹에 넣지 마세요. 반드시 `anon` 키만 사용합니다.

---

## 4. 첫 기기 로그인 후 1초 기기 연동 코드(`MYAMGI1:...`)로 5대 연결

### (1) 첫 번째 기기 설정 (예: 메인 스마트폰 또는 PC)
1. myAmgi 앱(또는 PC 웹 PWA)에서 **설정 → 동기화**로 들어갑니다.
2. 위에서 복사한 **Supabase URL**과 **Anon Key**를 입력합니다.
3. 사용할 **이메일 / 비밀번호**로 **회원가입(또는 로그인)** 합니다.
4. 첫 동기화를 실행해 덱/카드/설정을 올립니다.
5. **동기화 화면 → "기기 연동 코드 복사"** 버튼을 누릅니다.
   - 클립보드에 `MYAMGI1:...` 형태의 코드가 복사됩니다.

### (2) 나머지 4대 기기 1초 연결 (태블릿, 보조 폰, PC, 코멧)
1. 나머지 기기(태블릿, 두 번째 폰, PC 웹, 이노스페이스원 코멧)에서 myAmgi를 엽니다.
2. **설정 → 동기화 → "기기 연동 코드 붙여넣기"** 입력란에 `MYAMGI1:...` 코드를 붙여넣고 **연결**을 누릅니다.
3. URL, Anon Key, 계정 정보가 한 번에 적용되며 즉시 동기화가 시작됩니다!

> **보안 팁**: `MYAMGI1:...` 코드에는 접속 정보와 로그인 토큰/자격 정보가 들어 있으므로 메신저나 메모장에 오래 남겨두지 말고, 5대 연결이 끝나면 클립보드를 비워 두세요.

---

## 5. 트러블슈팅 FAQ

### Q1. 회원가입/로그인 시 "Email not confirmed" 오류가 나요.
- Supabase 대시보드 **Authentication → Providers → Email → Confirm email**이 켜져 있으면 인증 메일을 눌러야 로그인됩니다.
- 개인용으로 바로 쓰려면 **Confirm email**을 끄고(**OFF**) 저장하거나, **Authentication → Users**에서 해당 계정의 우측 메뉴(`...`) → **Confirm user**를 눌러 수동 인증하세요.

### Q2. 무료 플랜 용량 한도는 얼마나 되나요? 어떻게 관리하나요?
- Supabase 무료(Free) 플랜 기준:
  - **Database**: 500 MB (카드/노트/복습 기록 텍스트는 보통 수만 장이어도 수십 MB 수준)
  - **Storage (`amgi-media`)**: 1 GB (오디오/이미지 미디어 파일 및 컬렉션 스냅샷)
  - **Egress**: 월 5 GB
- **용량 절약 팁**:
  - 오디오/이미지가 매우 큰 덱은 WebP/MP3 등 가벼운 포맷으로 변환 후 `.apkg`를 가져오면 1 GB 안에 충분히 들어갑니다.
  - 필요 없는 오래된 덱은 삭제 후 동기화하면 변경 항목으로 반영됩니다.
  - 일주일 이상 프로젝트를 전혀 사용하지 않아도(최신 동기화 기록이 있으면 활성 유지) 대시보드에서 재개(Restore) 버튼 한 번으로 복구할 수 있습니다.

### Q3. 이노스페이스원 코멧(E-Ink)에서 동기화가 느리거나 안 돼요.
- 코멧은 Wi-Fi 절전 모드가 강하게 동작하므로, 대용량 `.apkg` 첫 동기화 시에는 충전기를 연결하거나 화면 꺼짐 시간을 늘려 두고 동기화하세요.
- 첫 전체 동기화 이후에는 **증분 동기화(`amgi_sync_items`)**로 바뀐 카드와 복습 로그만 주고받으므로 몇 초 만에 끝납니다.

### Q4. 다른 기기에서 카드를 수정했는데 반영이 안 돼요.
- 양쪽 기기의 시간이 크게 어긋나 있지 않은지 확인하세요 (`updated_at` 기준 최신 변경 우선, LWW).
- 강제로 최신 상태를 맞추려면 동기화 화면에서 **지금 동기화**를 눌러 수동 동기화를 실행하세요.
