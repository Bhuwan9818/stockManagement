import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Required for xlsx package
  serverExternalPackages: ['pg'],
};

export default nextConfig;
