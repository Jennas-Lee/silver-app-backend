import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/session";

/** 어르신이 목록에서 지운 기록은 서버에서도 지운다 (보호자 화면에서도 사라짐) */
export async function DELETE(request: Request, ctx: RouteContext<"/api/v1/records/[id]">) {
  const auth = await requireUser(request, "senior");
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const db = await getDb();
  await db.delete(schema.guardRecords).where(and(eq(schema.guardRecords.seniorId, auth.user.id), eq(schema.guardRecords.id, id)));
  return new Response(null, { status: 204 });
}
