import { and, desc, eq, lt } from "drizzle-orm";
import { connection } from "next/server";
import { getDb, schema } from "@/db";
import { readPage, requireLinkedSenior } from "@/lib/guardian";

/**
 * 보호자가 연결된 어르신의 막은 인터넷 주소를 본다 (최신순).
 * ?limit=50 (최대 100), ?before=<ISO 시각> 으로 이전 기록을 이어서 불러온다.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/seniors/[id]/url-records">) {
  await connection();
  const linked = await requireLinkedSenior(request, (await ctx.params).id);
  if (linked.error) return linked.error;
  const { seniorId } = linked;
  const { limit, before, error } = readPage(request);
  if (error) return error;

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.urlRecords)
    .where(
      before
        ? and(eq(schema.urlRecords.seniorId, seniorId), lt(schema.urlRecords.visitedAt, before))
        : eq(schema.urlRecords.seniorId, seniorId),
    )
    .orderBy(desc(schema.urlRecords.visitedAt))
    .limit(limit);

  return Response.json({
    records: rows.map((r) => ({
      id: r.id,
      visitedAt: r.visitedAt.toISOString(),
      host: r.host,
      url: r.urlMasked,
      app: r.app,
      action: r.action,
      category: r.category,
      reason: r.reason,
    })),
  });
}
