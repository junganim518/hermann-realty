# 헤르만부동산 프로젝트

부천 원미구 헤르만공인중개사사무소의 상가/사무실 매물 관리 웹 서비스.

## 기본 정보

- **도메인**: hermann-realty.com / hermann-realty.vercel.app
- **GitHub**: junganim518/hermann-realty
- **배포**: Vercel
- **사장님 연락처**: 010-8680-8151

## 기술 스택

- Next.js 14.2.29 (App Router)
- Supabase (PostgreSQL, ID: foekadrgwbbautitcbsq)
- Cloudflare R2 (이미지 저장)
- 카카오맵 API (지도)
- Daum Postcode (주소검색)
- 건축물대장 API

## 디렉토리 구조

```
app/
├── page.tsx                          # 메인
├── properties/page.tsx               # 전체매물
├── map/page.tsx                      # 지도검색
├── item/view/[id]/page.tsx           # 매물 상세 (클라이언트 컴포넌트)
├── item/view/[id]/layout.tsx         # 매물 상세 레이아웃 — generateMetadata + schema.org JSON-LD (RealEstateListing)
├── recent/page.tsx                   # 최근 본 매물
├── favorites/page.tsx                # 즐겨찾기
└── admin/
    ├── page.tsx                      # 관리자 대시보드
    ├── analytics/page.tsx            # 방문자 통계
    ├── properties/[new|edit]/        # 매물 등록/수정
    ├── customers/                    # 손님 관리
    ├── contracts/                    # 계약 관리
    ├── landlords/[new|edit|page]     # 임대인 관리
    └── trash/page.tsx                # 휴지통 (소프트 삭제된 매물 복구/영구삭제)

components/
├── PropertyCard.tsx                  # 매물 카드 (즐겨찾기 하트) — showPrivateBusinessName prop: 관리자 화면에서 비공개 상호명도 🔒 회색으로 표시
├── FavoriteButton.tsx
├── PageViewTracker.tsx               # 방문자 추적 (봇 필터)
└── MobileTabBar.tsx                  # 모바일 하단 탭

lib/
├── supabase.ts
├── favorites.ts                      # 즐겨찾기 (localStorage)
├── recentlyViewed.ts                 # 최근 본 매물
├── phoneFormat.ts                    # 전화번호 자동 하이픈
├── isBot.ts                          # 봇 감지 (35개 패턴)
└── propertyFilter.ts                 # 매물 필터 함수 (matchRange, matchAreaRange, matchFloor)
```

## DB 스키마 (Supabase)

### properties (매물)

- id (UUID, PK)
- property_number (TEXT) — 매물번호
- address, building_name, dong_ho (TEXT)
- business_name (TEXT), business_name_public (BOOLEAN)
- transaction_type (TEXT) — 월세/전세/매매
- deposit, monthly_rent, maintenance_fee, premium (BIGINT)
- theme_type (TEXT) — 콤마 구분 (26개: 추천매물·사옥형및통임대·대형상가·대형사무실·무권리상가·프랜차이즈양도양수·1층상가·2층이상상가·역세권매물·신축매물·저렴한매물·코너매물·메인상권·즉시입주·대로변매물·노출좋음·인기매물·카페·사무실·음식점·병원·학원·뷰티·편의점·헬스장·유흥/주류)
  - 검색 필터 목록(17개): `FILTER_THEMES` 상수 (lib/themeUtils.ts) — properties/map 페이지 공용
  - 새 테마 추가 시 `ALL_THEMES` + `FILTER_THEMES` 둘 다 확인 필요
- status (TEXT) — 거래중/보류/거래완료
- is_sold (BOOLEAN) — 하위호환용
- deleted_at (TIMESTAMPTZ, NULL 허용) — 소프트 삭제 (NULL=정상, 값 있음=휴지통)
- view_count (INTEGER)
- last_contacted_at (TIMESTAMPTZ) — 마지막 통화 체크일
- landlord_id (UUID, FK)
- landlord_name, landlord_phone (TEXT) — 하위호환
- tenant_name, tenant_phone (TEXT)
- extra_contacts (JSONB)
- created_at, updated_at (TIMESTAMPTZ)

**매물 삭제 정책 (중요)**
- 삭제는 항상 소프트 삭제: `update({ deleted_at: new Date().toISOString() })`
- 완전 삭제 금지 — 휴지통(/admin/trash)에서만 영구 삭제 가능
- **모든 매물 조회 쿼리에 `.is('deleted_at', null)` 필수** — 빠뜨리면 휴지통 매물이 사용자에게 노출됨
- 휴지통 페이지(app/admin/trash/page.tsx): 복구(deleted_at=null) / 영구 삭제(이미지 정리 후 DELETE)
- 매물 복사 시 payload에 `deleted_at: null` 명시적으로 포함

**가격 컬럼**: deposit, monthly_rent, sale_price, maintenance_fee, premium
- **매매**: `sale_price` 사용 (deposit/monthly_rent는 null)
- **전세**: `deposit` 사용 (monthly_rent는 null, sale_price는 null)
- **월세**: `deposit` + `monthly_rent` 사용 (sale_price는 null)
- 등록/수정 폼에서 거래유형 변경 시 입력 칸 즉시 분기 (조건부 렌더링)

### landlords (임대인)

- id (UUID, PK)
- name (TEXT, NULL 허용) — 이름 없이도 등록 가능
- phone (TEXT) — 매칭 기준
- email, address, business_number, memo (TEXT)
- property_address (TEXT) — 직접 등록 임대인의 보유 건물 주소
- property_building_name (TEXT)
- property_dong_ho (TEXT)
- created_at, updated_at

### contracts (계약)

- property_address, property_building_name, property_unit_number (TEXT) — 매물 주소 직접 입력 (property_id FK 미사용, 공동중개 등 시스템 외 매물 대응)
- property_type (TEXT) — 매물종류 (상가/사무실/오피스텔/아파트/건물/기타); properties 테이블과 동일 목록
- landlord_id (FK, nullable) — 임대인 직접 입력 + 자동 매칭 (매물 등록과 동일한 resolveLandlord 로직)
- landlord_name, landlord_phone (TEXT) — 텍스트 직접 저장 (전화번호 없는 임대인 정보 보존용; landlord_id 있어도 함께 저장)
- contract_type (TEXT) — 월세/전세/매매
- tenant_name, tenant_phone, tenant_business_name
- status (TEXT) — **수동 선택 6개**: 진행중/입주완료/만기임박/종료/재계약/묵시적갱신
  - **자동 전환 상태** (진행중/입주완료/만기임박): 날짜 기반 자동 계산 (`effectiveStatus` in lib/contracts.ts)
    - 오늘 < move_in_date → 진행중
    - move_in_date ≤ 오늘 < end_date-60일 → 입주완료
    - end_date-60일 ≤ 오늘 (만기 전후 포함) → 만기임박
  - **수동 고정 상태** (종료/재계약/묵시적갱신): DB 값 그대로 표시 (자동 전환 안 함)
  - DB의 status 값은 그대로, 화면 표시 시에만 `effectiveStatus()` 계산값 사용
  - '만기' 옵션 제거 (기존 데이터는 '종료'로 마이그레이션 완료)
- start_date 컬럼은 DB에 유지되나 UI에서 미사용 (잔금/입주일과 중복으로 제거); formatPeriod는 move_in_date 기준

### customers (손님)

- desired_conditions (JSONB) — 원하는 조건/테마

### customer_recommendations (손님 추천 이력)

### page_views (방문자 통계)

- PageViewTracker.tsx로 자동 기록
- 봇 필터링: lib/isBot.ts 사용
- referrer 분류 우선순위 (PageViewTracker.tsx):
  1. utm_source 파라미터 최우선 — 자기 도메인이어도 utm_source 있으면 그걸로 분류
     (AI가 답변에 utm_source=chatgpt.com 붙여서 링크 제공하는 경우 처리)
  2. utm_source 없고 referrer가 자기 도메인(hermann-realty.com/vercel.app/localhost)이면 → 직접접속
  3. 그 외 referrer 키워드로 분류
  - 저장 라벨: `direct` / `naver` / `google` / `kakao` / `daum` / `ai:chatgpt` / `ai:gemini` / `ai:perplexity` / `ai:copilot` / `ai:claude` / `ai:기타` / 원본URL(기타)
  - 표시 라벨 (analyticsUtils.ts): 직접접속 / 네이버 / 구글 / 카카오 / 다음 / AI 검색 / 기타
  - AI 검색 세부: analyticsUtils.getReferrerDetail() → ChatGPT / Gemini / Perplexity / Copilot / Claude
    대시보드 유입경로 모달에서 "AI 검색 · ChatGPT" 형태로 표시. analytics 파이차트는 "AI 검색"으로 묶음
  - 분류 함수 단일화: `categorizeReferrer` (lib/analyticsUtils.ts) → analytics 페이지 + 대시보드 모달 공용

## 임대인 매칭 룰 (중요)

매물 등록/수정 시 임대인을 자동 매칭하는 로직:

**1순위: 주소+동호수 매칭**
- 같은 address + dong_ho를 가진 다른 매물 검색
- 발견 시 confirm: "{주소} {동호수} / {전화번호} 같은 임대인이 있습니다. 보유 매물에 추가할까요?"
- [확인] → 기존 임대인 ID 연결
- [취소] → 2순위로

**2순위: 전화번호 매칭**
- 같은 전화번호 임대인 landlords에서 검색 (정규화: 숫자만 추출)
- 발견 시 confirm: 동일한 문구
- [확인] → 기존 임대인 ID 연결
- [취소] → 신규 등록

**신규 등록**
- 전화번호 있음 → landlords INSERT, ID 연결 + 계약 주소를 landlords.property_address/building_name/dong_ho에도 저장
- 전화번호 없음 → landlords 안 건드림, properties.landlord_name에 텍스트만 저장

**매칭 확정 시 주소 보완**
- 기존 임대인에 매칭 확정 후 → 해당 임대인의 property_address가 비어 있고 계약에 주소 있으면 주소 채워넣기
- 기존 임대인의 property_address가 있으면 덮어쓰지 않음

**매물 수정 시**
- 기존 임대인 정보 변경 없으면 매칭 로직 스킵
- 변경 있으면 위 매칭 로직 다시 실행
- 임대인이 변경되어 기존 임대인의 매물이 0건이 되면 자동 삭제

## 사장님 선호도 (중요)

### 답변 스타일

- **짧고 명료하게** — 길게 설명하면 "간단하게 좀 말해" 라고 함
- **이모지보다 이미지** 선호
- ask_user_input_v0 같은 선택지 형식 사용 안 함, 텍스트로 직접 응답

### 코드/명령어 스타일

- 클로드 코드 명령어는 **한 박스(코드블록)로 정리해서** 제공
- **Git 커밋/푸시 명령어를 명령 끝에 항상 포함**
- 사장님이 직접 터미널에서 git 명령 실행 (클로드 코드가 자동 커밋도 가능)

### 시스템 철학

- **시스템 단순함 추구** — 공동중개 별도 처리 X, 메모 활용
- 관리자 대시보드가 세로로 길어지는 것 싫어함
- 디자인 통일성과 일관성 중시
- 실용성 우선 — 사용자가 안 쓸 기능은 거부

### 결정 사항

- **블로그**: 프롬프트만 생성, 다른 AI(제미나이/ChatGPT)에 복사해서 사용 (Claude API 사용 X)
- **인스타그램**: 안 함
- **유튜브**: 보류
- **호스팅**: Vercel 무료 유지
- **PWA**: 적용 중
- **임대인 매칭**: 전화번호 없는 임대인(회사보유분/관리사무실)도 허용

## 디자인

- **메인 색상**: 블랙 / 골드 (#c47c30 계열)
- **모바일 우선** — 사장님 실무는 주로 모바일에서
- 푸터 좌우 비율: 2:1 (주소 한 줄 표시)

### 관리자 매물 관리 필터 (app/admin/page.tsx)

- **매물종류**: 드롭다운 체크박스 다중 선택 (상가/사무실/오피스텔/아파트/건물/기타) — URL 키 `types=상가,사무실`
- **테마**: 드롭다운 체크박스 다중 선택 (AND 조건) — ALL_THEMES 26개 / 3그룹(매물 특성·위치·조건·업종) — URL 키 `theme=추천매물,카페`
  - **관리자**: ALL_THEMES (26개) / **손님(검색·지도)**: FILTER_THEMES (17개)
  - THEME_GROUPS: 매물 특성(slice 0..8) · 위치·조건(slice 8..17) · 업종(slice 17..)
  - THEME_DISPLAY: 한글 표시명 다른 경우만 별도 매핑 (사옥형및통임대→사옥형 및 통임대 등)
- **거래유형/층수**: 단일 select — URL 키 `tx`, `floor`
- **보증금/월세/면적/권리금**: min~max 직접 입력 (만원/평) — URL 키 `deposit_min`, `deposit_max`, `rent_min`, `rent_max`, `area_min`, `area_max`, `premium_min`, `premium_max`
- 필터 함수: `lib/propertyFilter.ts` (`matchRange`, `matchAreaRange`, `matchFloor`)
  - 면적: DB는 ㎡, 입력은 평 — `matchAreaRange` 내부에서 변환 (÷ 3.3058)
- 드롭다운 바깥 클릭 시 자동 닫힘 (useEffect + ref), Portal 불필요

### 관리자 매물 카드 (app/admin/page.tsx)

- **모바일**: 썸네일(`admin-prop-thumbnail`) + 매물제목(`admin-prop-title`) 숨김, 가로 컴팩트 레이아웃
- **액션 버튼**: 데스크톱은 전체 노출(`admin-prop-desktop-btns`), 모바일은 통화 체크 + ⋮ 더보기(`admin-prop-mobile-btns`)
- **⋮ 더보기 메뉴**: 복사/블로그 글/수정/삭제 — Portal(`createPortal`)로 body에 렌더링 (드롭업/다운 자동)
- **상태 드롭다운**(`거래중 ▼`): 마찬가지로 Portal로 렌더링 — overflow:hidden 부모에 가려지지 않음
- **매물번호/주소 클릭**: `router.push`로 상세 페이지 이동 (cursor: pointer)
- **매물 수정 후 스크롤 복원**: 수정 링크 클릭 시 `sessionStorage.setItem('admin_scroll_position', scrollY)` 저장, 돌아온 후 `properties` + `propImages` 로드 완료 시 복원 (50ms setTimeout)

### 지도 페이지 줌 레벨 (app/map/page.tsx)

- 초기 줌: `level: 7` (세션 저장값 없을 때 기본)
- 최대 확대 한계 `minLevel`: **관리자(로그인) 1 / 손님(비로그인) 5**
  - 맵 초기화는 `minLevel: 5`로 고정, `isAdmin` resolve 후 `map.setMinLevel(isAdmin ? 1 : 5)` 동적 갱신
  - useEffect deps: `[isAdmin, mapReady]`

### 지도 페이지 뒤로가기 상태 복원 (app/map/page.tsx)

- sessionStorage 키: `MAP_STATE_KEY = 'hermann-map-state-v1'`
- 저장 항목: 지도 중심/줌, 드로어 상태, 필터, **클러스터 visibleIds**
- navigation type `'navigate'`(새 진입)일 때만 초기화 — `'back_forward'`(뒤로가기)/`'reload'`(새로고침)은 유지
- 클러스터 선택 상태(`visibleIds`): 매물 데이터 로드 후 `savedVisibleIdsRef`로 복원
- 매물 목록 스크롤: `listRef`(데스크톱) + `mobileListRef`(모바일) sessionStorage 저장/복원, `back_forward` 진입 시에만 복원

### 매물 상세 페이지 하단 영역 (app/item/view/[id]/page.tsx)

- **PC/태블릿**: `detail-aside`가 우측 sticky 패널 — 매물정보+CTA+관리자버튼 모두 표시
- **모바일**: `detail-aside`가 하단 fixed 바 — 매물번호는 하단 액션 바 위에 골드(`#c47c30`) 강조로 표시 (`.mobile-aside-pnum`), 그 아래 **문의하기/공유/즐겨찾기 3개** 버튼
- **관리자 버튼 4개** (매물수정/계약등록/인쇄/삭제): 모바일에서는 aside 숨기고 본문 최하단 `admin-mobile-tools`에 ⋮ 드롭업 메뉴로 표시
  - PC/태블릿은 기존 aside 안 그대로 유지
  - 삭제 로직은 `handleDeleteProperty` 함수로 추출 (aside + 모바일 공용)
  - `showAdminMenu` state로 드롭업 열기/닫기, 바깥 클릭 시 닫힘

### 상호명(business_name) 표시 정책

- **외부(손님용) PropertyCard**: `business_name_public === true`일 때만 🏪 표시
- **관리자 화면(손님 상세 페이지)**: 공개/비공개 무관 항상 표시
  - 공개: 🏪 상호명 `#374151` (진한 색)
  - 비공개: 🔒 상호명 `#92400e` (갈색 — 회색 아님)
  - 적용 위치: 매물 추가 모달 / 맞춤 매물 섹션 / 픽 매물(PropertyCard에 `showPrivateBusinessName` prop)

### 손님 목록 정보 위계 (customers/page.tsx)

- **`name` 컬럼은 UI에서 "찾는 매물"로 표시** (DB 컬럼명은 그대로 `name`)
  - 등록/수정 폼 라벨도 "찾는 매물 *", placeholder "예: 중동 카페자리 찾는 분"
- **데스크톱 테이블 위계**: 찾는매물(16px bold #1a1a1a) > 메모(14px #444) > 연락처(#c47c30 tel:링크) > 나머지(13px #666)
- **모바일 카드 순서**: 찾는매물(16px bold) → 전화번호(15px bold 골드 tel:링크) → 메모(14px #444 3줄) → 관심매물·예산·지역(12px) → 날짜(12px #aaa) → 상세/삭제 버튼
- **연락처**: `formatPhone()` (lib/phoneFormat.ts) 로 표시, `href="tel:숫자만"`

## 자주 발생하는 이슈

### 400 에러 (column does not exist)

- 원인: properties에 없는 컬럼 select
- 주의: sale_price 컬럼 없음, 가격은 deposit/monthly_rent/maintenance_fee/premium

### 임대인 매칭 디버깅

- F12 콘솔에 `[임대인매칭]` 로그 찍힘 (1순위/2순위/신규/최종 결과)
- `[임대인삭제]` 로그도 확인 가능

### 봇 카운팅

- PageViewTracker와 매물 view_count 모두 lib/isBot.ts 사용
- 35개 봇 패턴 (Googlebot, Bingbot, Yeti, 헤드리스 브라우저, HTTP 클라이언트 등)

## 환경 변수 (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://foekadrgwbbautitcbsq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
KAKAO_MAP_JS_KEY=8a478b4b6ea5e02722a33f6ac2fa34b6
NEXT_PUBLIC_KAKAO_JS_KEY=...
CLOUDFLARE_R2_BUCKET_NAME=hermann-realty-images
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_PUBLIC_URL=...
NEXT_PUBLIC_BUILDING_API_KEY=...
```

## 작업 시 주의사항

1. **새 기능 작업 시 CLAUDE.md도 같이 업데이트**
   - DB 스키마 변경
   - 새 결정 사항
   - 새 컴포넌트/유틸 추가

2. **마이그레이션이 필요한 작업은 SQL을 먼저 제공**
   - 사용자가 Supabase SQL Editor에서 실행
   - 그 후 코드 작업 진행

3. **코드 변경 후 항상 커밋**
   - git add (변경한 파일)
   - git commit -m "타입: 설명" (feat/fix/refactor)
   - git push

4. **테스트는 사용자가 직접**
   - 사이트(`npm run dev` 또는 prod)에서 실제 동작 확인
   - F12 콘솔 로그 활용
