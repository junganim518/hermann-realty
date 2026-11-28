import localFont from 'next/font/local';

// 오피스텔 소개 페이지 전용 폰트 — next/font/local로 자체 호스팅(외부 CDN 호출 없음).
// Google Fonts의 Noto Sans KR / Noto Serif KR을 한글(가~힣, 자모) + 라틴 + 자주 쓰는 기호로만
// 추려서(한자 등 불필요한 CJK 글리프 제외) 미리 받아둔 WOFF2 파일(./fonts/*.woff2, 총 ~4MB)을 쓴다.
// next/font/google은 이 글꼴이 유니코드 범위별로 수십~100개 파일로 쪼개져 내려오는데, 빌드 환경에
// 따라 그 대량 동시 다운로드가 실패하는 경우가 있어 더 안정적인 로컬 방식으로 전환함.
// CSS 변수로만 노출해서 OfficetelLanding 루트 래퍼 안에서만 적용되고 전역 폰트(Pretendard)에는 영향 없음.
export const notoSansKR = localFont({
  src: [
    { path: './fonts/NotoSansKR-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/NotoSansKR-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/NotoSansKR-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--of-font-sans',
  display: 'swap',
  preload: false,
});

export const notoSerifKR = localFont({
  src: [
    { path: './fonts/NotoSerifKR-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/NotoSerifKR-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--of-font-serif',
  display: 'swap',
  preload: false,
});
