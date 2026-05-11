import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },

  // Ignore TypeScript errors during production build
  typescript: {
    ignoreBuildErrors: true,
  },

  // Ignore ESLint errors during production build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Prevent bundling heavy server-only packages into client
  serverExternalPackages: [
    'pg',
    'mysql2',
    'cassandra-driver',
    'nodemailer',
    'exceljs',
    'langfuse',
    'langfuse-vercel',
    '@opentelemetry/sdk-node',
    '@opentelemetry/resources',
    '@opentelemetry/semantic-conventions',
  ],
}

export default nextConfig