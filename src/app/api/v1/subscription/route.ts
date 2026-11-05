import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";
import { apiError, readJson } from "@/lib/http";
import { sharedPlan } from "@/lib/plan";
import { requireUser } from "@/lib/session";

/**
 * 구독 플랜. 아직 결제가 없어서 보호자가 고르면 바로 바뀐다.
 * 같은 어르신에 연결된 보호자들은 플랜을 함께 쓰고, 그중 한 명만 구독할 수 있다.
 */
const Plan = z.enum(["none", "standard", "premium"]);
const Body = z.object({ plan: Plan });

async function toResponse(u: Pick<User, "id" | "plan" | "planUpdatedAt">) {
  return {
    plan: u.plan,
    updatedAt: u.planUpdatedAt?.toISOString() ?? null,
    /** 다른 보호자가 이미 구독해서 함께 쓰는 플랜 (없으면 null) */
    sharedFrom: await sharedPlan(u.id),
  };
}

/** 내 구독 (보호자) */
export async function GET(request: Request) {
  await connection();
  const auth = await requireUser(request, "guardian");
  if (auth.error) return auth.error;
  return Response.json(await toResponse(auth.user));
}

/** 구독 플랜 바꾸기 (보호자). 결제를 붙이면 결제가 끝난 뒤에만 바뀌게 한다 */
export async function PUT(request: Request) {
  const auth = await requireUser(request, "guardian");
  if (auth.error) return auth.error;
  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "invalid_request", "plan은 none, standard, premium 중 하나여야 해요.");

  if (parsed.data.plan !== "none") {
    const shared = await sharedPlan(auth.user.id);
    if (shared) {
      return apiError(409, "already_subscribed", `${shared.name} 님이 이미 구독하고 있어요. 한 가족은 한 분만 구독하면 함께 쓸 수 있어요.`);
    }
  }

  const db = await getDb();
  const [updated] = await db
    .update(schema.users)
    .set({ plan: parsed.data.plan, planUpdatedAt: new Date() })
    .where(eq(schema.users.id, auth.user.id))
    .returning();
  return Response.json(await toResponse(updated));
}
