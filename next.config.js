/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Branding assets: no-cache so favicon/icon/OG updates propagate immediately.
        // The browser will revalidate on every request but can still use 304 Not Modified.
        source: '/(favicon\\..+|icon-\\d+\\.png|apple-touch-icon\\.png|og-image\\.png|manifest\\.json)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
