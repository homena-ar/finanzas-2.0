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
}

module.exports = nextConfig
