import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { anthropic } from "@/lib/anthropic";
import { buildUserText, KIOSK_SYSTEM_PROMPT } from "./prompt";
import { KioskGuideModelOutput, type KioskGuideRequest } from "./schema";

const MODEL = process.env.KIOSK_MODEL ?? "claude-opus-5-5";
// 어르신이 키오스크 앞에서 기다리므로 응답 속도를 우선해 기본값은 low.
const EFFORT = (process.env.KIOSK_EFFORT ?? "low") as "low" | "medium" | "high";

export class KioskRefusalError extends Error {}
export class KioskParseError extends Error {}

export async function guideKiosk(req: KioskGuideRequest): Promise<KioskGuideModelOutput> {
  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // 안전 분류기가 거절하면 서버에서 다른 모델로 자동 재시도
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: EFFORT,
      format: betaZodOutputFormat(KioskGuideModelOutput),
    },
    system: KIOSK_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: req.mediaType, data: req.image } },
          { type: "text", text: buildUserText(req) },
        ],
      },
    ],
  });

  console.log(
    JSON.stringify({
      event: "kiosk_guide",
      model: response.model,
      stop_reason: response.stop_reason,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    }),
  );

  if (response.stop_reason === "refusal") {
    throw new KioskRefusalError(response.stop_details?.category ?? "refusal");
  }
  if (!response.parsed_output) {
    throw new KioskParseError(`stop_reason=${response.stop_reason}`);
  }
  return response.parsed_output;
}
