import { and, count, desc, eq, gt, max, sql } from "drizzle-orm";
import { connection } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { apiError, readJson } from "@/lib/http";
import { requireUser, toPublicUser } from "@/lib/session";

/**
 * 연결 목록
 * - 보호자: 연결한 어르신들 (최근 7일 차단 문자 수·막은 주소 수, 마지막 기록 시각 포함)
 * - 어르신: 연결된 보호자들
 */
export async function GET(request: Request) {
  await connection();
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const db = await getDb();

  if (auth.user.role === "guardian") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const seniors = await db
      .select({ user: schema.users, linkedAt: schema.links.createdAt })
      .from(schema.links)
      .innerJoin(schema.users, eq(schema.links.seniorId, schema.users.id))
      .where(eq(schema.links.guardianId, auth.user.id))
      .orderBy(desc(schema.links.createdAt));

    const stats = await db
      .select({
        seniorId: schema.guardRecords.seniorId,
        recentCount: count(sql`case when ${schema.guardRecords.receivedAt} > ${weekAgo} then 1 end`),
        lastRecordAt: max(schema.guardRecords.receivedAt),
      })
      .from(schema.guardRecords)
      .innerJoin(schema.links, eq(schema.links.seniorId, schema.guardRecords.seniorId))
      .where(eq(schema.links.guardianId, auth.user.id))
      .groupBy(schema.guardRecords.seniorId);
    const byId = new Map(stats.map((s) => [s.seniorId, s]));

    const urlStats = await db
      .select({
        seniorId: schema.urlRecords.seniorId,
        recentCount: count(sql`case when ${schema.urlRecords.visitedAt} > ${weekAgo} then 1 end`),
        lastRecordAt: max(schema.urlRecords.visitedAt),
      })
      .from(schema.urlRecords)
      .innerJoin(schema.links, eq(schema.links.seniorId, schema.urlRecords.seniorId))
      .where(eq(schema.links.guardianId, auth.user.id))
      .groupBy(schema.urlRecords.seniorId);
    const urlById = new Map(urlStats.map((s) => [s.seniorId, s]));
    const latest = (...dates: (Date | null | undefined)[]) =>
      dates.reduce<Date | null>((a, d) => (d && (!a || d > a) ? d : a), null)?.toISOString() ?? null;

    return Response.json({
      seniors: seniors.map(({ user, linkedAt }) => ({
        ...toPublicUser(user),
        linkedAt: linkedAt.toISOString(),
        recentCount: Number(byId.get(user.id)?.recentCount ?? 0),
        recentUrlCount: Number(urlById.get(user.id)?.recentCount ?? 0),
        lastRecordAt: latest(byId.get(user.id)?.lastRecordAt, urlById.get(user.id)?.lastRecordAt),
      })),
    });
  }

  const guardians = await db
    .select({ user: schema.users, linkedAt: schema.links.createdAt })
    .from(schema.links)
    .innerJoin(schema.users, eq(schema.links.guardianId, schema.users.id))
    .where(eq(schema.links.seniorId, auth.user.id))
    .orderBy(desc(schema.links.createdAt));
  return Response.json({
    guardians: guardians.map(({ user, linkedAt }) => ({ ...toPublicUser(user), linkedAt: linkedAt.toISOString() })),
  });
}

const Body = z.object({ code: z.string().trim().regex(/^\d{6}$/) });

/** 보호자가 어르신 휴대폰의 6자리 코드를 입력해 연결한다. 코드는 한 번 쓰면 사라진다. */
export async function POST(request: Request) {
  const auth = await requireUser(request, "guardian");
  if (auth.error) return auth.error;
  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "invalid_request", "숫자 6자리를 입력해 주세요.");

  const db = await getDb();
  const [used] = await db
    .delete(schema.linkCodes)
    .where(and(eq(schema.linkCodes.code, parsed.data.code), gt(schema.linkCodes.expiresAt, new Date())))
    .returning({ seniorId: schema.linkCodes.seniorId });
  if (!used) return apiError(404, "invalid_code", "코드가 맞지 않거나 시간이 지났어요. 어르신 휴대폰에서 새 코드를 받아 주세요.");

  await db.insert(schema.links).values({ guardianId: auth.user.id, seniorId: used.seniorId }).onConflictDoNothing();
  const [senior] = await db.select().from(schema.users).where(eq(schema.users.id, used.seniorId)).limit(1);
  return Response.json({ senior: toPublicUser(senior) }, { status: 201 });
}
