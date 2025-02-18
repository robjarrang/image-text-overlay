/** @type {import('next').NextConfig} */
const nextConfig = {
  serverRuntimeConfig: {
    NEXT_SHARP_PATH: '/tmp/node_modules/sharp'
  },
  images: {
    domains: ['*'],
    dangerouslyAllowSVG: true,
  },
  compress: true,
  async headers() {
    return [
      {
        // matching all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  },
  webpack(config) {
    // Optimize chunk size
    config.optimization = {
      ...config.optimization,
      minimize: true,
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        maxSize: 100000,
      }
    };
    return config;
  },
}

module.exports = nextConfig;