import { z } from "zod";
import { getDb, schema } from "@/db";
import { apiError, issuesToMessage, readJson } from "@/lib/http";
import { maskPii } from "@/lib/pii";
import { requireUser } from "@/lib/session";

const Record = z.object({
  id: z.string().min(1).max(64),
  receivedAt: z.string().datetime(),
  source: z.string().max(20),
  sender: z.string().max(100),
  body: z.string().max(4000),
  action: z.enum(["HIDDEN", "WARNED"]),
  category: z.string().max(50),
  reason: z.string().max(500),
});
const Body = z.object({ records: z.array(Record).min(1).max(100) });

/**
 * 어르신 휴대폰의 차단·경고 기록을 올린다 (보호자가 볼 수 있게).
 * 같은 ID를 다시 올려도 한 번만 저장된다. 본문은 서버에서도 개인정보를 가린다.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request, "senior");
  if (auth.error) return auth.error;
  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "invalid_request", issuesToMessage(parsed.error.issues));

  const db = await getDb();
  const saved = await db
    .insert(schema.guardRecords)
    .values(
      parsed.data.records.map((r) => ({
        id: r.id,
        seniorId: auth.user.id,
        receivedAt: new Date(r.receivedAt),
        source: r.source,
        sender: r.sender,
        bodyMasked: maskPii(r.body),
        action: r.action,
        category: r.category,
        reason: r.reason,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: schema.guardRecords.id });

  return Response.json({ received: parsed.data.records.length, saved: saved.length });
}
