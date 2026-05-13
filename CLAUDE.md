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
├── item/view/[id]/page.tsx           # 매물 상세
├── recent/page.tsx                   # 최근 본 매물
├── favorites/page.tsx                # 즐겨찾기
└── admin/
    ├── page.tsx                      # 관리자 대시보드
    ├── analytics/page.tsx            # 방문자 통계
    ├── properties/[new|edit]/        # 매물 등록/수정
    ├── customers/                    # 손님 관리
    ├── contracts/                    # 계약 관리
    └── landlords/[new|edit|page]     # 임대인 관리

components/
├── PropertyCard.tsx                  # 매물 카드 (즐겨찾기 하트)
├── FavoriteButton.tsx
├── PageViewTracker.tsx               # 방문자 추적 (봇 필터)
└── MobileTabBar.tsx                  # 모바일 하단 탭

lib/
├── supabase.ts
├── favorites.ts                      # 즐겨찾기 (localStorage)
├── recentlyViewed.ts                 # 최근 본 매물
├── phoneFormat.ts                    # 전화번호 자동 하이픈
└── isBot.ts                          # 봇 감지 (35개 패턴)
```

## DB 스키마 (Supabase)

### properties (매물)

- id (UUID, PK)
- property_number (TEXT) — 매물번호
- address, building_name, dong_ho (TEXT)
- business_name (TEXT), business_name_public (BOOLEAN)
- transaction_type (TEXT) — 월세/전세/매매
- deposit, monthly_rent, maintenance_fee, premium (BIGINT)
- theme_type (TEXT) — 콤마 구분
- status (TEXT) — 거래중/보류/거래완료
- is_sold (BOOLEAN) — 하위호환용
- view_count (INTEGER)
- last_contacted_at (TIMESTAMPTZ) — 마지막 통화 체크일
- landlord_id (UUID, FK)
- landlord_name, landlord_phone (TEXT) — 하위호환
- tenant_name, tenant_phone (TEXT)
- extra_contacts (JSONB)
- created_at, updated_at (TIMESTAMPTZ)

**참고**: properties에 sale_price 컬럼 없음. 가격 컬럼은 deposit, monthly_rent, maintenance_fee, premium 4개.

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

- contract_type (TEXT) — 월세/전세/매매
- tenant_name, tenant_phone, tenant_business_name
- status — 진행중/입주완료/만기임박/만기/재계약/종료

### customers (손님)

- desired_conditions (JSONB) — 원하는 조건/테마

### customer_recommendations (손님 추천 이력)

### page_views (방문자 통계)

- PageViewTracker.tsx로 자동 기록
- 봇 필터링: lib/isBot.ts 사용

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
- 전화번호 있음 → landlords INSERT, ID 연결
- 전화번호 없음 → landlords 안 건드림, properties.landlord_name에 텍스트만 저장

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
