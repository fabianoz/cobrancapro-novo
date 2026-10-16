/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    // node-fetch v2 optionally requires 'encoding' which is not installed.
    // This is safe to ignore — it's only used for charset conversion which
    // Node.js handles natively. Prevents build warnings on Netlify.
    config.resolve.alias = {
      ...config.resolve.alias,
      encoding: false,
    };

    // On the server, use the native node-fetch. On the client, provide an
    // empty fallback so it never ends up in the browser bundle.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'node-fetch': false,
        fs: false,
        net: false,
        tls: false,
        http: false,
        https: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
