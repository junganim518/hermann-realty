/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    scrollRestoration: true,
    serverComponentsExternalPackages: ['sharp'],
    // assets/watermark.png은 lib/watermark.js가 fs로 직접 읽음(process.cwd() 기준 상대경로) —
    // Vercel 서버리스 번들에 반드시 포함되도록 명시 (파일 추적이 못 찾는 경우 대비한 안전장치).
    outputFileTracingIncludes: {
      '/api/upload/route': ['./assets/watermark.png'],
    },
  },
}

module.exports = nextConfig
