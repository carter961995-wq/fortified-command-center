import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ["leaflet", "react-leaflet", "@react-leaflet/core"],
  serverExternalPackages: ["pdf-lib", "@react-pdf/renderer"],
  env: {
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "true" : "false",
  },
};

export default nextConfig;
