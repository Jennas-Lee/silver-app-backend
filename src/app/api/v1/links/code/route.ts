import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { apiError } from "@/lib/http";
import { requireUser } from "@/lib/session";

const CODE_TTL_MS = 10 * 60 * 1000;

/** 어르신 휴대폰에 띄울 6자리 연결 코드를 만든다. 예전 코드는 지운다. */
export async function POST(request: Request) {
  const auth = await requireUser(request, "senior");
  if (auth.error) return auth.error;

  const db = await getDb();
  await db.delete(schema.linkCodes).where(eq(schema.linkCodes.seniorId, auth.user.id));

  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const inserted = await db
      .insert(schema.linkCodes)
      .values({ code, seniorId: auth.user.id, expiresAt })
      .onConflictDoNothing()
      .returning({ code: schema.linkCodes.code });
    if (inserted.length > 0) return Response.json({ code, expiresAt: expiresAt.toISOString() }, { status: 201 });
  }
  return apiError(503, "try_again", "잠시 후 다시 해 주세요.");
}
