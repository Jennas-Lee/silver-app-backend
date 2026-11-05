import { and, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";
import { apiError } from "./http";

/**
 * 구독 플랜.
 * - 구독은 보호자가 한다. 한 어르신에 연결된 보호자들은 플랜을 함께 쓰고, 그중 한 명만 구독(결제)할 수 있다.
 * - 어르신이 쓰는 플랜 = 연결된 보호자들의 플랜 중 가장 높은 것
 * - 키오스크 도우미: Standard 이상. 문자 지킴이·링크 지킴이는 플랜과 상관없이 (보호자만 연결되면) 쓴다.
 */
export type Plan = User["plan"];

const RANK: Record<Plan, number> = { none: 0, standard: 1, premium: 2 };

export const atLeast = (plan: Plan, min: Plan) => RANK[plan] >= RANK[min];

export const higher = (a: Plan, b: Plan): Plan => (RANK[a] >= RANK[b] ? a : b);

/** 어르신이 쓰는 플랜과 구독한 보호자 이름 */
export async function seniorPlan(seniorId: string): Promise<{ plan: Plan; payer: string | null }> {
  const db = await getDb();
  const guardians = await db
    .select({ name: schema.users.name, plan: schema.users.plan })
    .from(schema.links)
    .innerJoin(schema.users, eq(schema.links.guardianId, schema.users.id))
    .where(eq(schema.links.seniorId, seniorId));
  let best: { plan: Plan; payer: string | null } = { plan: "none", payer: null };
  for (const g of guardians) {
    if (RANK[g.plan] > RANK[best.plan]) best = { plan: g.plan, payer: g.name };
  }
  return best;
}

/**
 * 이 보호자와 같은 어르신에 연결된 다른 보호자 중 이미 구독한 사람 (가장 높은 플랜).
 * 있으면 이 보호자는 그 플랜을 함께 쓰고, 따로 구독할 수 없다.
 */
export async function sharedPlan(guardianId: string): Promise<{ plan: Plan; name: string } | null> {
  const db = await getDb();
  const mine = alias(schema.links, "mine");
  const theirs = alias(schema.links, "theirs");
  const rows = await db
    .selectDistinct({ name: schema.users.name, plan: schema.users.plan })
    .from(mine)
    .innerJoin(theirs, eq(theirs.seniorId, mine.seniorId))
    .innerJoin(schema.users, eq(schema.users.id, theirs.guardianId))
    .where(
      and(eq(mine.guardianId, guardianId), ne(theirs.guardianId, guardianId), inArray(schema.users.plan, ["standard", "premium"])),
    );
  if (rows.length === 0) return null;
  return rows.reduce((a, b) => (RANK[b.plan] > RANK[a.plan] ? b : a));
}

/** 플랜이 부족할 때 */
export const planRequired = (min: Plan) =>
  apiError(
    403,
    "plan_required",
    min === "premium" ? "Premium 구독에서 쓸 수 있어요. 가족에게 구독을 부탁해 주세요." : "가족이 구독하면 쓸 수 있어요. 가족에게 구독을 부탁해 주세요.",
  );
