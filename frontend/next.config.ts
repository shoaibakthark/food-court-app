import type { NextConfig } from "next";
import os from "os";

const localIps = Object.values(os.networkInterfaces())
  .flat()
  .filter((iface): iface is os.NetworkInterfaceInfo => Boolean(iface && iface.family === "IPv4"))
  .map((iface) => iface.address);

const allowedDevOrigins = Array.from(
  new Set([
    "localhost",
    "127.0.0.1",
    "172.20.10.2",
    "192.168.0.102",
    ...localIps,
    ...localIps.map((ip) => `${ip}:3000`),
    ...localIps.map((ip) => `${ip}:3001`),
    "172.20.10.2:3000",
    "172.20.10.2:3001",
    "192.168.0.102:3000",
    "192.168.0.102:3001",
  ])
);

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins,
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";
    return [
      {
        source: "/api/py/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
