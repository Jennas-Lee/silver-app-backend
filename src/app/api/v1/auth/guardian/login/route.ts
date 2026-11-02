import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { apiError, readJson } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { createSession, toPublicUser } from "@/lib/session";

const Body = z.object({
  email: z.string().trim().toLowerCase().max(200),
  password: z.string().max(200),
});

/** 보호자 로그인 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "invalid_request", "이메일과 비밀번호를 입력해 주세요.");
  const { email, password } = parsed.data;

  const db = await getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.email, email), eq(schema.users.role, "guardian")))
    .limit(1);

  // 이메일이 없는 경우와 비밀번호가 틀린 경우를 구분하지 않는다
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return apiError(401, "invalid_credentials", "이메일 또는 비밀번호가 맞지 않아요.");
  }
  const token = await createSession(user.id);
  return Response.json({ token, user: toPublicUser(user) });
}
