import { timingSafeEqual } from "node:crypto";
import { apiError } from "./http";
import { findUserByRequest } from "./session";

export { apiError };

/**
 * 문자 판정·키오스크 안내처럼 앱이 쓰는 API의 접근을 확인한다.
 * - 로그인 토큰(Authorization: Bearer)이 있으면 그 계정으로 허용
 * - 예전 앱 호환: X-Device-Token이 환경변수 DEVICE_TOKENS(쉼표 구분)에 있으면 허용 (계정 기능이 퍼지면 제거)
 * 실패하면 401 응답을, 성공하면 null을 돌려준다.
 */
export async function requireDeviceToken(request: Request): Promise<Response | null> {
  if (await findUserByRequest(request)) return null;

  const token = request.headers.get("x-device-token") ?? "";
  const allowed = (process.env.DEVICE_TOKENS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const ok = token !== "" && allowed.some((a) => safeEqual(a, token));
  return ok ? null : apiError(401, "unauthorized", "유효하지 않은 기기 토큰입니다.");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
