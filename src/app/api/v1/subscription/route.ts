import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";
import { apiError, readJson } from "@/lib/http";
import { requireUser } from "@/lib/session";

/** 구독 플랜. 아직 결제가 없어서 보호자가 고르면 바로 바뀐다 */
const Plan = z.enum(["none", "standard", "premium"]);
const Body = z.object({ plan: Plan });

const toResponse = (u: Pick<User, "plan" | "planUpdatedAt">) => ({
  plan: u.plan,
  updatedAt: u.planUpdatedAt?.toISOString() ?? null,
});

/** 내 구독 (보호자) */
export async function GET(request: Request) {
  await connection();
  const auth = await requireUser(request, "guardian");
  if (auth.error) return auth.error;
  return Response.json(toResponse(auth.user));
}

/** 구독 플랜 바꾸기 (보호자). 결제를 붙이면 결제가 끝난 뒤에만 바뀌게 한다 */
export async function PUT(request: Request) {
  const auth = await requireUser(request, "guardian");
  if (auth.error) return auth.error;
  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "invalid_request", "plan은 none, standard, premium 중 하나여야 해요.");

  const db = await getDb();
  const [updated] = await db
    .update(schema.users)
    .set({ plan: parsed.data.plan, planUpdatedAt: new Date() })
    .where(eq(schema.users.id, auth.user.id))
    .returning();
  return Response.json(toResponse(updated));
}
