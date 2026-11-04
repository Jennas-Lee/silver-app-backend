import { and, desc, eq, lt } from "drizzle-orm";
import { connection } from "next/server";
import { getDb, schema } from "@/db";
import { readPage, requireLinkedSenior } from "@/lib/guardian";

/**
 * 보호자가 연결된 어르신의 차단·경고 기록을 본다 (최신순).
 * ?limit=50 (최대 100), ?before=<ISO 시각> 으로 이전 기록을 이어서 불러온다.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/seniors/[id]/records">) {
  await connection();
  const linked = await requireLinkedSenior(request, (await ctx.params).id);
  if (linked.error) return linked.error;
  const { seniorId } = linked;
  const { limit, before, error } = readPage(request);
  if (error) return error;

  const db = await getDb();
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
