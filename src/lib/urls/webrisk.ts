import type { UrlModelResult } from "./schema";

/**
 * Google Web Risk(상업용 위험 사이트 목록) 조회. WEB_RISK_API_KEY가 없으면 건너뛴다.
 * 실패하거나 늦으면 null을 돌려주고 다음 단계(Claude)로 넘어간다.
 */
export async function lookupWebRisk(url: string): Promise<UrlModelResult | null> {
  const key = process.env.WEB_RISK_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({ uri: url, key });
  for (const t of ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"]) params.append("threatTypes", t);
  try {
    const res = await fetch(`https://webrisk.googleapis.com/v1/uris:search?${params}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.error("webrisk error", res.status);
      return null;
    }
    const data = (await res.json()) as { threat?: { threatTypes?: string[] } };
    const types = data.threat?.threatTypes ?? [];
    if (types.includes("SOCIAL_ENGINEERING")) {
      return {
        verdict: "malicious",
        category: "phishing",
        reason: "가짜 인터넷 주소로 신고된 곳이에요. 아무것도 넣지 마세요.",
      };
    }
    if (types.length) {
      return {
        verdict: "malicious",
        category: "malware",
        reason: "위험한 프로그램을 퍼뜨리는 곳으로 신고된 주소예요. 열지 마세요.",
      };
    }
    return null;
  } catch (err) {
    console.error("webrisk failed", err instanceof Error ? err.message : err);
    return null;
  }
}
