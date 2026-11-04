import { and, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { classifyUrl } from "./classify";
import { normalizeUrl } from "./normalize";
import { applyRules, isSharedHost } from "./rules";
import type { UrlCheckResult, UrlModelResult } from "./schema";
import { lookupWebRisk } from "./webrisk";

const DAY = 24 * 60 * 60 * 1000;
/** 판정을 다시 쓰는 기간. 위험한 곳은 오래, 안전한 곳은 짧게 (사기꾼이 나중에 바꿀 수 있음) */
const TTL = { malicious: 30 * DAY, suspicious: 3 * DAY, safe: 3 * DAY } as const;

/** 주소 하나를 판정한다: 저장된 판정 → 규칙 → Google Web Risk → Claude */
export async function checkUrl(raw: string): Promise<UrlCheckResult> {
  const u = normalizeUrl(raw);
  if (!u) {
    return { url: raw, host: null, verdict: "unknown", category: "none", reason: "인터넷 주소가 아니에요.", source: "invalid", cached: false };
  }
  const result = (r: UrlModelResult, source: UrlCheckResult["source"], cached = false): UrlCheckResult => ({
    url: raw,
    host: u.host,
    ...r,
    source,
    cached,
  });

  const rules = applyRules(u);
  if (rules.decided) return result(rules.decided, "rule");

  const key = isSharedHost(u.host) ? u.display : u.host;
  const db = await getDb();
  const [saved] = await db
    .select()
    .from(schema.urlVerdicts)
    .where(and(eq(schema.urlVerdicts.key, key), gt(schema.urlVerdicts.expiresAt, new Date())))
    .limit(1);
  if (saved) {
    const { verdict, category, reason, source } = saved;
    return result({ verdict, category: category as UrlModelResult["category"], reason }, source as UrlCheckResult["source"], true);
  }

  let verdict: UrlModelResult | null = null;
  let source: "webrisk" | "model" = "webrisk";
  verdict = await lookupWebRisk(`${u.isIp ? "http" : "https"}://${u.display}`);
  if (!verdict) {
    source = "model";
    try {
      verdict = await classifyUrl(u, rules.hints);
    } catch (err) {
      console.error("urls classify failed", err instanceof Error ? err.message : err);
    }
  }
  if (!verdict) {
    return { url: raw, host: u.host, verdict: "unknown", category: "none", reason: "지금은 확인하지 못했어요.", source: "error", cached: false };
  }

  const values = { ...verdict, source, checkedAt: new Date(), expiresAt: new Date(Date.now() + TTL[verdict.verdict]) };
  await db
    .insert(schema.urlVerdicts)
    .values({ key, ...values })
    .onConflictDoUpdate({ target: schema.urlVerdicts.key, set: values })
    .catch((err) => console.error("url verdict save failed", err));
  return result(verdict, source);
}
