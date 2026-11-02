import Anthropic from "@anthropic-ai/sdk";
import { apiError, requireDeviceToken } from "@/lib/auth";
import { classifyMessage, ClassifyParseError, ClassifyRefusalError } from "@/lib/messages/classify";
import { ClassifyRequest } from "@/lib/messages/schema";

export const maxDuration = 30;

export async function POST(request: Request) {
  const unauthorized = await requireDeviceToken(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "요청 본문이 JSON이 아닙니다.");
  }

  const parsed = ClassifyRequest.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "invalid_request", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }

  try {
    return Response.json(await classifyMessage(parsed.data));
  } catch (err) {
    // 판정을 못 하면 앱은 자기 규칙 결과로 처리한다 (docs/api/v1.md)
    if (err instanceof ClassifyRefusalError) {
      return apiError(422, "refused", "이 메시지는 판정할 수 없어요.");
    }
    if (err instanceof ClassifyParseError) {
      console.error("classify parse error", err.message);
      return apiError(502, "bad_model_output", "판정 결과를 만들지 못했어요.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      return apiError(429, "rate_limited", "요청이 많아요. 잠시 후 다시 시도해 주세요.");
    }
    if (err instanceof Anthropic.APIError) {
      console.error("anthropic api error", err.status, err.message);
      return apiError(502, "upstream_error", "판정 서버에 문제가 있어요.");
    }
    console.error("classify unexpected error", err);
    return apiError(500, "internal_error", "잠시 문제가 생겼어요.");
  }
}
