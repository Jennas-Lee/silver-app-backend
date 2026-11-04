import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { anthropic } from "@/lib/anthropic";
import type { NormalizedUrl } from "./normalize";
import { buildUrlUserText, URL_SYSTEM_PROMPT } from "./prompt";
import { UrlModelResult } from "./schema";

const MODEL = process.env.URLS_MODEL ?? "claude-opus-5-5";
// 어르신이 주소를 열 때마다 기다리므로 속도 우선
const EFFORT = (process.env.URLS_EFFORT ?? "low") as "low" | "medium" | "high";

/** Claude로 주소를 판정한다. 판정하지 못하면 null */
export async function classifyUrl(u: NormalizedUrl, hints: string[]): Promise<UrlModelResult | null> {
  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: EFFORT, format: betaZodOutputFormat(UrlModelResult) },
    system: [{ type: "text", text: URL_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUrlUserText(u, hints) }],
  });

  console.log(
    JSON.stringify({
      event: "urls_classify",
      model: response.model,
      stop_reason: response.stop_reason,
      verdict: response.parsed_output?.verdict,
      input_tokens: response.usage.input_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      output_tokens: response.usage.output_tokens,
    }),
  );
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return response.parsed_output;
}
