import { z } from "zod";
import { getDb, schema } from "@/db";
import { apiError, issuesToMessage, readJson } from "@/lib/http";
import { createSession, toPublicUser } from "@/lib/session";

const Body = z.object({ name: z.string().trim().min(1).max(30) });

/** 어르신 계정 만들기: 이름만 받는다. 이 휴대폰 전용 계정과 토큰을 돌려준다. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "invalid_request", issuesToMessage(parsed.error.issues));

  const db = await getDb();
  const [user] = await db.insert(schema.users).values({ role: "senior", name: parsed.data.name }).returning();
  const token = await createSession(user.id);
  return Response.json({ token, user: toPublicUser(user) }, { status: 201 });
}
