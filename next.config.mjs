/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Move experimental options to root level
  outputFileTracingRoot: process.cwd(),
  outputFileTracingExcludes: {
    '**/*': [
      'node_modules/@sparticuz/chromium/bin/**/*',
      'node_modules/.pnpm/@sparticuz+chromium@*/**/*',
    ],
  },
  serverExternalPackages: ['@sparticuz/chromium'],
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
    config.resolve.fallback = { 
      fs: 'empty',
      net: 'mock',
      tls: 'mock',
      child_process: false,
      dns: 'mock'
    };
    
    // Exclude the Sparticuz Chromium binary from being processed by webpack
    if (isServer) {
      config.externals = [...(config.externals || []), '@sparticuz/chromium'];
      
      // Add custom webpack configuration for server
      config.module.rules.push({
        test: /\.node$/,
        use: 'node-loader',
      });
    }
    
    return config;
  },
}

export default nextConfig
