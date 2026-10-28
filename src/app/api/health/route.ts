import { connection } from "next/server";

export async function GET() {
  // 요청 시점에 실행되도록 (빌드 때 정적으로 굳지 않게)
  await connection();

  return Response.json({
    status: "ok",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    time: new Date().toISOString(),
  });
}
