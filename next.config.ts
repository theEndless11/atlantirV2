import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
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