import { connection } from "next/server";
import { seniorPlan } from "@/lib/plan";
import { hasGuardian, requireUser, toPublicUser } from "@/lib/session";

/**
 * 내 계정 정보 (앱 시작 시 토큰이 아직 유효한지 확인하는 데도 쓴다).
 * 어르신은 hasGuardian이 false면 보호자 연결 화면만 쓸 수 있다.
 * 어르신의 plan은 연결된 보호자들이 함께 쓰는 플랜, planPayer는 구독한 보호자 이름.
 */
export async function GET(request: Request) {
  await connection();
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const user = toPublicUser(auth.user);
  if (auth.user.role !== "senior") return Response.json({ user });
  const [linked, { plan, payer }] = await Promise.all([hasGuardian(auth.user.id), seniorPlan(auth.user.id)]);
  return Response.json({ user: { ...user, hasGuardian: linked, plan, planPayer: payer } });
}
