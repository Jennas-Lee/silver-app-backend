import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { anthropic } from "@/lib/anthropic";
import { buildClassifyUserText, CLASSIFY_SYSTEM_PROMPT } from "./prompt";
import { ClassifyResult, type ClassifyRequest } from "./schema";

const MODEL = process.env.MESSAGES_MODEL ?? "claude-opus-5-5";
// 메시지가 올 때마다 호출되므로 속도와 비용을 위해 기본값은 low.
const EFFORT = (process.env.MESSAGES_EFFORT ?? "low") as "low" | "medium" | "high";

export class ClassifyRefusalError extends Error {}
export class ClassifyParseError extends Error {}

export async function classifyMessage(req: ClassifyRequest): Promise<ClassifyResult> {
  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    // 사기 문자 내용 때문에 안전 분류기가 거절하면 서버에서 다른 모델로 자동 재시도
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: EFFORT,
      format: betaZodOutputFormat(ClassifyResult),
    },
    system: CLASSIFY_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildClassifyUserText(req) }],
  });

  console.log(
    JSON.stringify({
      event: "messages_classify",
      model: response.model,
      stop_reason: response.stop_reason,
      verdict: response.parsed_output?.verdict,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    }),
  );

  if (response.stop_reason === "refusal") {
    throw new ClassifyRefusalError(response.stop_details?.category ?? "refusal");
  }
  if (!response.parsed_output) {
    throw new ClassifyParseError(`stop_reason=${response.stop_reason}`);
  }
  return response.parsed_output;
}
