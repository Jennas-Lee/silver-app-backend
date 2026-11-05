import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { apiError, requireDeviceToken } from "@/lib/auth";
import { guideKiosk, KioskParseError, KioskRefusalError } from "@/lib/kiosk/guide";
import { KioskGuideRequest, type KioskGuideResponse } from "@/lib/kiosk/schema";

// 이미지 분석 + LLM 응답 대기
export const maxDuration = 60;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export async function POST(request: Request) {
  // 키오스크 도우미는 Standard 이상
  const unauthorized = await requireDeviceToken(request, "standard");
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "요청 본문이 JSON이 아닙니다.");
  }

  const parsed = KioskGuideRequest.safeParse(body);
  if (!parsed.success) {
    const tooBig = parsed.error.issues.some((i) => i.path[0] === "image" && i.code === "too_big");
    return tooBig
      ? apiError(413, "image_too_large", "사진이 너무 큽니다. 긴 변 1024px 이하로 줄여서 보내주세요.")
      : apiError(400, "invalid_request", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }

  try {
    const out = await guideKiosk(parsed.data);
    const res: KioskGuideResponse = {
      sessionId: parsed.data.sessionId ?? randomUUID(),
      speech: out.speech,
      status: out.status,
      target: out.target
        ? {
            label: out.target.label,
            box: [clamp01(out.target.x1), clamp01(out.target.y1), clamp01(out.target.x2), clamp01(out.target.y2)],
          }
        : null,
    };
    return Response.json(res);
  } catch (err) {
    if (err instanceof KioskRefusalError) {
      return apiError(422, "refused", "이 화면은 안내해 드릴 수 없어요.");
    }
    if (err instanceof KioskParseError) {
      console.error("kiosk parse error", err.message);
      return apiError(502, "bad_model_output", "안내를 만들지 못했어요. 다시 시도해 주세요.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      return apiError(429, "rate_limited", "요청이 많아요. 잠시 후 다시 시도해 주세요.");
    }
    if (err instanceof Anthropic.APIError) {
      console.error("anthropic api error", err.status, err.message);
      return apiError(502, "upstream_error", "안내 서버에 문제가 있어요. 다시 시도해 주세요.");
    }
    // API 키 누락 등 설정 문제 포함
    console.error("kiosk guide unexpected error", err);
    return apiError(500, "internal_error", "잠시 문제가 생겼어요. 다시 시도해 주세요.");
  }
}
