import { timingSafeEqual } from "node:crypto";
import { apiError } from "./http";
import { bearerToken, requireActiveUser } from "./session";

export { apiError };

/**
 * 문자 판정·주소 판정·키오스크 안내 API의 접근을 확인한다.
 * - 로그인 토큰(Authorization: Bearer)이 있으면 그 계정으로 허용. 어르신은 보호자와 연결되어 있어야 한다.
 * - 개발·평가 스크립트용: 로그인 토큰이 없고 X-Device-Token이 환경변수 DEVICE_TOKENS(쉼표 구분)에 있으면 허용.
 *   앱은 이 토큰을 쓰지 않는다. 운영 서버에서는 DEVICE_TOKENS를 비워 두거나 앱에 없는 값만 둔다.
 * 실패하면 오류 응답을, 성공하면 null을 돌려준다.
 */
export async function requireDeviceToken(request: Request): Promise<Response | null> {
  if (bearerToken(request)) {
    const auth = await requireActiveUser(request);
    return auth.error ?? null;
  }

  const token = request.headers.get("x-device-token") ?? "";
  const allowed = (process.env.DEVICE_TOKENS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const ok = token !== "" && allowed.some((a) => safeEqual(a, token));
  return ok ? null : apiError(401, "unauthorized", "다시 로그인해 주세요.");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
