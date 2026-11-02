import { and, desc, eq, lt } from "drizzle-orm";
import { connection } from "next/server";
import { getDb, schema } from "@/db";
import { apiError } from "@/lib/http";
import { requireUser } from "@/lib/session";

/**
 * 보호자가 연결된 어르신의 차단·경고 기록을 본다 (최신순).
 * ?limit=50 (최대 100), ?before=<ISO 시각> 으로 이전 기록을 이어서 불러온다.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/seniors/[id]/records">) {
  await connection();
  const auth = await requireUser(request, "guardian");
  if (auth.error) return auth.error;
  const { id: seniorId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(seniorId)) return apiError(400, "invalid_request", "잘못된 계정이에요.");

  const db = await getDb();
  const linked = await db
    .select({ seniorId: schema.links.seniorId })
    .from(schema.links)
    .where(and(eq(schema.links.guardianId, auth.user.id), eq(schema.links.seniorId, seniorId)))
    .limit(1);
  if (linked.length === 0) return apiError(404, "not_linked", "연결된 어르신이 아니에요.");

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
  const beforeParam = url.searchParams.get("before");
  const before = beforeParam ? new Date(beforeParam) : null;
  if (before && Number.isNaN(before.getTime())) return apiError(400, "invalid_request", "before 값이 시각 형식이 아니에요.");

  const rows = await db
    .select()
    .from(schema.guardRecords)
    .where(
      before
        ? and(eq(schema.guardRecords.seniorId, seniorId), lt(schema.guardRecords.receivedAt, before))
        : eq(schema.guardRecords.seniorId, seniorId),
    )
    .orderBy(desc(schema.guardRecords.receivedAt))
    .limit(limit);

  return Response.json({
    records: rows.map((r) => ({
      id: r.id,
      receivedAt: r.receivedAt.toISOString(),
      source: r.source,
      sender: r.sender,
      body: r.bodyMasked,
      action: r.action,
      category: r.category,
      reason: r.reason,
    })),
  });
}
