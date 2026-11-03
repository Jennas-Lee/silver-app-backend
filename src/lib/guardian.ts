import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { apiError } from "./http";
import { requireUser } from "./session";

/**
 * 보호자가 어르신 기록을 볼 때 쓴다. 보호자 로그인과 연결 여부를 확인한다.
 * 성공하면 { seniorId }, 실패하면 { error: Response }.
 */
export async function requireLinkedSenior(
  request: Request,
  seniorId: string,
): Promise<{ seniorId: string; error?: undefined } | { seniorId?: undefined; error: Response }> {
  const auth = await requireUser(request, "guardian");
  if (auth.error) return { error: auth.error };
  if (!/^[0-9a-f-]{36}$/i.test(seniorId)) return { error: apiError(400, "invalid_request", "잘못된 계정이에요.") };

  const db = await getDb();
  const linked = await db
    .select({ seniorId: schema.links.seniorId })
    .from(schema.links)
    .where(and(eq(schema.links.guardianId, auth.user.id), eq(schema.links.seniorId, seniorId)))
    .limit(1);
  if (linked.length === 0) return { error: apiError(404, "not_linked", "연결된 어르신이 아니에요.") };
  return { seniorId };
}

/** ?limit=50 (최대 100), ?before=<ISO 시각> 읽기. before가 잘못되면 error */
export function readPage(request: Request): { limit: number; before: Date | null; error?: Response } {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
  const beforeParam = url.searchParams.get("before");
  const before = beforeParam ? new Date(beforeParam) : null;
  if (before && Number.isNaN(before.getTime())) {
    return { limit, before: null, error: apiError(400, "invalid_request", "before 값이 시각 형식이 아니에요.") };
  }
  return { limit, before };
}
