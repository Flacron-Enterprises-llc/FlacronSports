/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['source.unsplash.com', 'images.unsplash.com'],
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
  },
}

export default nextConfig
