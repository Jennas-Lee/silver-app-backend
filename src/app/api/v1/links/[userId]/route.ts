import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { apiError } from "@/lib/http";
import { requireUser } from "@/lib/session";

/** 연결 끊기: 보호자는 어르신을, 어르신은 보호자를 목록에서 뺀다 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/v1/links/[userId]">) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { userId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return apiError(400, "invalid_request", "잘못된 계정이에요.");

  const [guardianId, seniorId] = auth.user.role === "guardian" ? [auth.user.id, userId] : [userId, auth.user.id];
  const db = await getDb();
  await db.delete(schema.links).where(and(eq(schema.links.guardianId, guardianId), eq(schema.links.seniorId, seniorId)));
  return new Response(null, { status: 204 });
}
