import { z } from "zod";
import { getDb, schema } from "@/db";
import { apiError, issuesToMessage, readJson } from "@/lib/http";
import { maskPii } from "@/lib/pii";
import { requireUser } from "@/lib/session";
import { normalizeUrl } from "@/lib/urls/normalize";

const UrlRecord = z.object({
  id: z.string().min(1).max(64),
  visitedAt: z.string().datetime(),
  url: z.string().min(1).max(2000),
  app: z.string().max(50),
  action: z.enum(["BLOCKED", "WARNED"]),
  category: z.string().max(50),
  reason: z.string().max(500),
});
const Body = z.object({ records: z.array(UrlRecord).min(1).max(100) });

/**
 * 어르신 휴대폰에서 막거나 경고한 인터넷 주소를 올린다 (보호자가 볼 수 있게).
 * 같은 ID는 한 번만 저장된다. 주소의 ? 뒤(검색어·로그인 정보 등)는 버리고 개인정보를 가려서 저장한다.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request, "senior");
  if (auth.error) return auth.error;
  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "invalid_request", issuesToMessage(parsed.error.issues));

  const db = await getDb();
  const saved = await db
    .insert(schema.urlRecords)
    .values(
      parsed.data.records.map((r) => {
        const u = normalizeUrl(r.url);
        return {
          id: r.id,
          seniorId: auth.user.id,
          visitedAt: new Date(r.visitedAt),
          host: u?.host ?? "",
          urlMasked: u?.display ?? maskPii(r.url.split(/[?#]/)[0]).slice(0, 300),
          app: r.app,
          action: r.action,
          category: r.category,
          reason: r.reason,
        };
      }),
    )
    .onConflictDoNothing()
    .returning({ id: schema.urlRecords.id });

  return Response.json({ received: parsed.data.records.length, saved: saved.length });
}
