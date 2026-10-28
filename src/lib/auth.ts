import { timingSafeEqual } from "node:crypto";

/**
 * 앱이 보내는 `X-Device-Token` 헤더를 확인한다.
 * PoC 단계에서는 환경변수 DEVICE_TOKENS(쉼표로 구분)에 등록된 토큰만 허용한다.
 * 실패하면 401 응답을, 성공하면 null을 돌려준다.
 */
export function requireDeviceToken(request: Request): Response | null {
  const token = request.headers.get("x-device-token") ?? "";
  const allowed = (process.env.DEVICE_TOKENS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const ok = allowed.some((a) => safeEqual(a, token));
  return ok ? null : apiError(401, "unauthorized", "유효하지 않은 기기 토큰입니다.");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function apiError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}
