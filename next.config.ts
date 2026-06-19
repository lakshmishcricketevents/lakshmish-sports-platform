import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.20.185.229', 'localhost', '127.0.0.1'],
  turbopack: {},
  webpack: (config) => {
    config.watchOptions = {
      ...(config.watchOptions || {}),
      ignored: ['**/node_modules/**', '**/data/**']
    };
    return config;
  }
};

export default nextConfig;
