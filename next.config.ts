import type { NextConfig } from "next";

/**
 * SKLAD v3.1 — ветвление сборки по BUILD_TARGET:
 *  - server (по умолчанию): output "standalone" — SKLAD_Server.exe (API + UI)
 *  - client: output "export" — статический UI для SKLAD_Client.exe (app://ui);
 *    pageExtensions без ts для api — API-роуты исключаются из экспорта.
 */

const isClient = process.env.BUILD_TARGET === "client";

const nextConfig: NextConfig = isClient
  ? {
      output: "export",
      pageExtensions: ["tsx", "jsx"], // исключает route.ts → API-роуты не попадают в out/
      typescript: { ignoreBuildErrors: true },
      reactStrictMode: false,
    }
  : {
      output: "standalone",
      typescript: { ignoreBuildErrors: true },
      reactStrictMode: false,
    };

export default nextConfig;
