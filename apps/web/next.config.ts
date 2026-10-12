import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Load the single root-level .env.local for the whole monorepo
loadEnvConfig(path.resolve(__dirname, "../../"));

// Placeholder values from .env.example (e.g. "your-google-client-id") do not count as configured.
const isReal = (v?: string) => !!v && v.trim() !== "" && !/(\.\.\.|your-|changeme)/i.test(v);
const googleAuthEnabled =
  isReal(process.env["GOOGLE_CLIENT_ID"]) && isReal(process.env["GOOGLE_CLIENT_SECRET"]);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: googleAuthEnabled ? "true" : "false",
  },
  images: {
    remotePatterns: [
      { hostname: "*.googleusercontent.com" },
      { hostname: "avatars.githubusercontent.com" },
      { hostname: "images.unsplash.com" },
      { hostname: "res.cloudinary.com" },
    ],
  },
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@bookflow/database"],
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
