import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverActions: {
    bodySizeLimit: '10mb',
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
};

export default nextConfig;
