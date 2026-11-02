import { bearerToken, deleteSession } from "@/lib/session";

/** 로그아웃: 이 토큰을 지운다 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (token) await deleteSession(token);
  return new Response(null, { status: 204 });
}
