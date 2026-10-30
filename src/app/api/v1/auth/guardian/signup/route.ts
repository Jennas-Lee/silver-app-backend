import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { apiError, issuesToMessage, readJson } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { createSession, toPublicUser } from "@/lib/session";

const Body = z.object({
  name: z.string().trim().min(1).max(30),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
});

/** 보호자 가입 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await readJson(request));
  if (!parsed.success) {
    const pw = parsed.error.issues.some((i) => i.path[0] === "password");
    return apiError(400, "invalid_request", pw ? "비밀번호는 8자 이상이어야 해요." : issuesToMessage(parsed.error.issues));
  }
  const { name, email, password } = parsed.data;

  const db = await getDb();
  const exists = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (exists.length > 0) return apiError(409, "email_taken", "이미 가입된 이메일이에요.");

  const [user] = await db
    .insert(schema.users)
    .values({ role: "guardian", name, email, passwordHash: await hashPassword(password) })
    .returning();
  const token = await createSession(user.id);
  return Response.json({ token, user: toPublicUser(user) }, { status: 201 });
}
