export function apiError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/** 요청 본문을 JSON으로 읽는다. 실패하면 null */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** zod 검증 오류를 한 줄 메시지로 */
export function issuesToMessage(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`).join("; ");
}
