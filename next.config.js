/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    scrollRestoration: true,
    serverComponentsExternalPackages: ['sharp'],
  },
}

module.exports = nextConfig
