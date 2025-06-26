/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    outputFileTracingRoot: '../',
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@sparticuz/chromium/bin/**/*',
      ],
    },
    serverComponentsExternalPackages: ['@sparticuz/chromium'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    domains: ['localhost', 'eyeuitester.vercel.app'],
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    
    // Exclude the Sparticuz Chromium binary from being processed by webpack
    if (isServer) {
      config.externals = [...(config.externals || []), '@sparticuz/chromium'];
    }
    
    return config;
  },
}

export default nextConfig
