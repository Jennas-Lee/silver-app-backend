import { connection } from "next/server";
import { hasGuardian, requireUser, toPublicUser } from "@/lib/session";

/**
 * 내 계정 정보 (앱 시작 시 토큰이 아직 유효한지 확인하는 데도 쓴다).
 * 어르신은 hasGuardian이 false면 보호자 연결 화면만 쓸 수 있다.
 */
export async function GET(request: Request) {
  await connection();
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const user = toPublicUser(auth.user);
  if (auth.user.role !== "senior") return Response.json({ user });
  return Response.json({ user: { ...user, hasGuardian: await hasGuardian(auth.user.id) } });
}
