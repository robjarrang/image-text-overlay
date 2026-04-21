/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    dangerouslyAllowSVG: true,
  },
  compress: true,
  serverExternalPackages: ['sharp'],
  turbopack: {},
  async headers() {
    return [
      {
        // Allow the app to be framed by SFMC Content Builder and
        // related Salesforce properties. Modern browsers honour CSP
        // `frame-ancestors`; the legacy X-Frame-Options header was
        // removed because its only legal values are DENY/SAMEORIGIN
        // (ALLOWALL is non-standard and Chromium ignores it).
        //
        // If you need to add another embedding host, append it here
        // — wildcards work for sub-domains.
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://*.exacttarget.com https://*.marketingcloudapps.com https://*.salesforce.com https://*.force.com" },
        ]
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" }
        ]
      }
    ]
  },
  webpack(config) {
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