import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { withSentryConfig } from "@sentry/nextjs";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sentry/nextjs", "@sentry/node"],
  experimental: {
    webpackMemoryOptimizations: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
      config.resolve.alias = {
        ...config.resolve.alias,
        [path.resolve(projectRoot, "instrumentation.sentry.ts")]: path.resolve(
          projectRoot,
          "lib/dev/noop-module.ts",
        ),
      };
    }
    return config;
  },
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
        {
          key: "Service-Worker-Allowed",
          value: "/",
        },
      ],
    },
  ],
  rewrites: async () => [
    {
      source: "/firebase-messaging-config.js",
      destination: "/api/firebase-messaging-config",
    },
  ],
};

const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  disableLogger: true,
};

export default process.env.NODE_ENV === "production"
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;
