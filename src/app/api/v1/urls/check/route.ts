import { apiError, requireDeviceToken } from "@/lib/auth";
import { issuesToMessage, readJson } from "@/lib/http";
import { checkUrl } from "@/lib/urls/check";
import { UrlCheckRequest } from "@/lib/urls/schema";

export const maxDuration = 30;

/**
 * 인터넷 주소가 위험한지 판정한다 (한 번에 최대 10개, 요청한 순서대로 응답).
 * 판정하지 못한 주소는 verdict "unknown" — 앱은 막지 않고 그대로 둔다.
 */
export async function POST(request: Request) {
  const unauthorized = await requireDeviceToken(request);
  if (unauthorized) return unauthorized;

  const parsed = UrlCheckRequest.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "invalid_request", issuesToMessage(parsed.error.issues));

  const results = await Promise.all(parsed.data.urls.map((url) => checkUrl(url)));
  return Response.json({ results });
}
