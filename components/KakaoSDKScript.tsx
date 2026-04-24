'use client';

import Script from 'next/script';

export default function KakaoSDKScript() {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? '';
  return (
    <Script
      src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (typeof window === 'undefined') return;
        if (!window.Kakao) return;
        if (!appKey) {
          console.warn('[KakaoSDK] NEXT_PUBLIC_KAKAO_JS_KEY가 설정되어 있지 않습니다.');
          return;
        }
        if (!window.Kakao.isInitialized()) {
          window.Kakao.init(appKey);
          console.log('[KakaoSDK] 초기화 완료');
        }
      }}
    />
  );
}
