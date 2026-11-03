import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/session";

/** 어르신이 목록에서 지운 주소 기록은 서버에서도 지운다 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/v1/url-records/[id]">) {
  const auth = await requireUser(request, "senior");
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const db = await getDb();
  await db.delete(schema.urlRecords).where(and(eq(schema.urlRecords.seniorId, auth.user.id), eq(schema.urlRecords.id, id)));
  return new Response(null, { status: 204 });
}
