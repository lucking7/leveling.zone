/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The /ip/query redirect reads useSearchParams without a Suspense boundary.
    missingSuspenseWithCSRBailout: false,
    serverComponentsExternalPackages: ['maxmind'],
  },
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
};

module.exports = nextConfig;
