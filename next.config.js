/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Facebook/WhatsApp suelen exigir extensión de imagen en og:image
      { source: '/og-image.png', destination: '/opengraph-image' },
      { source: '/twitter-image.png', destination: '/twitter-image' },
    ]
  },
  async headers() {
    return [
      {
        // Branding assets: no-cache so favicon/icon/OG updates propagate immediately.
        // The browser will revalidate on every request but can still use 304 Not Modified.
        source: '/(favicon\\..+|icon-\\d+\\.png|apple-touch-icon\\.png|og-image\\.png|twitter-image\\.png|manifest\\.json)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
      {
        // Dynamic OG/Twitter image endpoints (generated at runtime)
        source: '/(opengraph-image|twitter-image)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
