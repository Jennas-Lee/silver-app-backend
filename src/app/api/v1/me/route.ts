import { connection } from "next/server";
import { requireUser, toPublicUser } from "@/lib/session";

/** 내 계정 정보 (앱 시작 시 토큰이 아직 유효한지 확인하는 데도 쓴다) */
export async function GET(request: Request) {
  await connection();
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  return Response.json({ user: toPublicUser(auth.user) });
}
