import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";
import { apiError } from "./http";

/** 앱에 돌려줄 계정 정보 (비밀번호 해시 제외). plan은 보호자만 */
export type PublicUser = { id: string; role: User["role"]; name: string; email: string | null; plan?: User["plan"] };

export function toPublicUser(u: User): PublicUser {
  const user: PublicUser = { id: u.id, role: u.role, name: u.name, email: u.email };
  if (u.role === "guardian") user.plan = u.plan;
  return user;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** 새 로그인 토큰을 만든다. 원문은 이번 한 번만 앱에 돌려주고 서버에는 해시만 남긴다. */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const db = await getDb();
  await db.insert(schema.sessions).values({ userId, tokenHash: hashToken(token) });
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashToken(token)));
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}

/** Authorization: Bearer 토큰으로 로그인한 계정을 찾는다. 없거나 틀리면 null */
export async function findUserByRequest(request: Request): Promise<User | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const db = await getDb();
  const rows = await db
    .select({ user: schema.users, sessionId: schema.sessions.id })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.tokenHash, hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // 마지막 사용 시각 갱신 (실패해도 요청은 계속)
  db.update(schema.sessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.sessions.id, row.sessionId))
    .catch(() => {});
  return row.user;
}

/** 어르신이 보호자와 한 명 이상 연결되어 있는지 */
export async function hasGuardian(seniorId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.links.guardianId })
    .from(schema.links)
    .where(eq(schema.links.seniorId, seniorId))
    .limit(1);
  return rows.length > 0;
}

/** 보호자와 연결되지 않은 어르신이 기능을 쓰려 할 때 */
export const guardianRequired = () =>
  apiError(403, "guardian_required", "보호자와 연결해야 쓸 수 있어요. 가족 휴대폰에 연결 숫자를 넣어 주세요.");

type AuthResult = { user: User; error?: undefined } | { user?: undefined; error: Response };

/**
 * 기능 API(문자 판정, 주소 판정, 키오스크, 기록 올리기)에서 쓴다.
 * requireUser와 같고, 어르신 계정은 보호자와 연결되어 있어야 한다.
 */
export async function requireActiveUser(request: Request, role?: User["role"]): Promise<AuthResult> {
  const auth = await requireUser(request, role);
  if (auth.error) return auth;
  if (auth.user.role === "senior" && !(await hasGuardian(auth.user.id))) return { error: guardianRequired() };
  return auth;
}

/**
 * 로그인이 필요한 API에서 쓴다. 성공하면 { user }, 실패하면 { error: Response }.
 * role을 주면 그 유형의 계정만 허용한다.
 */
export async function requireUser(request: Request, role?: User["role"]): Promise<AuthResult> {
  const user = await findUserByRequest(request);
  if (!user) return { error: apiError(401, "unauthorized", "다시 로그인해 주세요.") };
  if (role && user.role !== role) {
    return { error: apiError(403, "forbidden", role === "guardian" ? "보호자만 쓸 수 있어요." : "어르신 계정만 쓸 수 있어요.") };
  }
  return { user };
}
