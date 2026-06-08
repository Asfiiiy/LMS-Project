import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disable to prevent double rendering in development

  generateBuildId: async () => {
    return Date.now().toString();
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error'] }
      : false
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'http', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.cloudinary.com', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', pathname: '/**' },
      { protocol: 'https', hostname: 'lms.inspirelondoncollege.com', pathname: '/**' }
    ]
  },
  
  // Production optimizations
  compress: true, // Enable gzip compression
  poweredByHeader: false, // Remove X-Powered-By header for security
  
  // Headers for better caching and security
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
