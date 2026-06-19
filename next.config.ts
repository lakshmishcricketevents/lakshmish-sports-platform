import type { NextConfig } from "next";
import os from "os";

const getLocalNetworkIps = (): string[] => {
  const ips = new Set<string>(["localhost", "127.0.0.1", "0.0.0.0"]);
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          ips.add(iface.address);
        }
      }
    }
  } catch (e) {
    console.warn("Failed to retrieve network interfaces for allowedDevOrigins:", e);
  }
  return Array.from(ips);
};

const nextConfig: NextConfig = {
  allowedDevOrigins: getLocalNetworkIps(),
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

