import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // 로컬 개발용 내장 Postgres(WASM)는 번들하지 않고 그대로 불러온다
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
