#!/usr/bin/env node
// 계정·연결·기록 API를 처음부터 끝까지 시험한다 (LLM을 부르지 않아 비용 없음).
//
// 사용법:
//   node scripts/smoke-accounts.mjs [서버 주소]
// 로컬 서버는 DATABASE_URL 없이 띄우면 내장 DB(.pglite)를 쓴다.

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
let failed = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

function check(name, cond, detail) {
  console.log(`${cond ? "✅" : "❌"} ${name}${cond ? "" : `  ${JSON.stringify(detail)}`}`);
  if (!cond) failed++;
}

const stamp = Date.now();
const email = `guardian-${stamp}@example.com`;

// 1. 어르신 시작 (이름만)
const senior = await call("POST", "/api/v1/auth/senior", { body: { name: "김순자" } });
check("어르신 계정 만들기", senior.status === 201 && senior.json.user.role === "senior", senior);
const S = senior.json.token;

// 2. 보호자 가입·로그인
const short = await call("POST", "/api/v1/auth/guardian/signup", { body: { name: "김철수", email, password: "1234" } });
check("짧은 비밀번호 거절", short.status === 400, short);
const signup = await call("POST", "/api/v1/auth/guardian/signup", { body: { name: "김철수", email, password: "password123" } });
check("보호자 가입", signup.status === 201 && signup.json.user.role === "guardian", signup);
const dup = await call("POST", "/api/v1/auth/guardian/signup", { body: { name: "김철수", email: email.toUpperCase(), password: "password123" } });
check("같은 이메일(대소문자 무시) 다시 가입 거절", dup.status === 409, dup);
const wrong = await call("POST", "/api/v1/auth/guardian/login", { body: { email, password: "wrongpass" } });
check("틀린 비밀번호 로그인 거절", wrong.status === 401, wrong);
const login = await call("POST", "/api/v1/auth/guardian/login", { body: { email, password: "password123" } });
check("보호자 로그인", login.status === 200 && !!login.json.token, login);
const G = login.json.token;

const me = await call("GET", "/api/v1/me", { token: G });
check("내 정보", me.status === 200 && me.json.user.email === email, me);

// 3. 연결
const code = await call("POST", "/api/v1/links/code", { token: S });
check("어르신 연결 코드 받기", code.status === 201 && /^\d{6}$/.test(code.json.code), code);
const guardianCode = await call("POST", "/api/v1/links/code", { token: G });
check("보호자는 연결 코드를 만들 수 없음", guardianCode.status === 403, guardianCode);
const badLink = await call("POST", "/api/v1/links", { token: G, body: { code: code.json.code === "000000" ? "111111" : "000000" } });
check("틀린 코드로 연결 거절", badLink.status === 404, badLink);
const link = await call("POST", "/api/v1/links", { token: G, body: { code: code.json.code } });
check("코드로 연결", link.status === 201 && link.json.senior.name === "김순자", link);
const reuse = await call("POST", "/api/v1/links", { token: G, body: { code: code.json.code } });
check("같은 코드는 다시 못 씀", reuse.status === 404, reuse);

// 4. 기록 업로드
const records = [
  { id: `r1-${stamp}`, receivedAt: new Date(Date.now() - 60_000).toISOString(), source: "sms", sender: "+447700900123", body: "택배 주소 확인 bit.ly/x", action: "HIDDEN", category: "delivery_scam", reason: "택배 회사인 척하는 사기 문자예요." },
  { id: `r2-${stamp}`, receivedAt: new Date().toISOString(), source: "sms", sender: "01066667777", body: "엄마 이 계좌110-123-456789로 보내줘", action: "WARNED", category: "family_impersonation", reason: "가족인 척하는 문자일 수 있어요." },
];
const up = await call("POST", "/api/v1/records", { token: S, body: { records } });
check("기록 업로드", up.status === 200 && up.json.saved === 2, up);
const again = await call("POST", "/api/v1/records", { token: S, body: { records } });
check("같은 기록 다시 올려도 한 번만 저장", again.status === 200 && again.json.saved === 0, again);
const guardianUp = await call("POST", "/api/v1/records", { token: G, body: { records } });
check("보호자는 기록을 올릴 수 없음", guardianUp.status === 403, guardianUp);

// 5. 보호자 조회
const seniors = await call("GET", "/api/v1/links", { token: G });
const mine = seniors.json?.seniors?.find((s) => s.id === senior.json.user.id);
check("보호자: 연결된 어르신 목록 (최근 7일 2건)", seniors.status === 200 && mine?.recentCount === 2, seniors);
const list = await call("GET", `/api/v1/seniors/${senior.json.user.id}/records`, { token: G });
check("보호자: 차단 기록 조회 (최신순)", list.status === 200 && list.json.records.length === 2 && list.json.records[0].id === `r2-${stamp}`, list);
check("서버에서도 계좌번호를 가림", list.json?.records?.[0]?.body.includes("[계좌번호]") && !list.json.records[0].body.includes("456789"), list.json?.records?.[0]);
const guardians = await call("GET", "/api/v1/links", { token: S });
check("어르신: 연결된 보호자 목록", guardians.status === 200 && guardians.json.guardians.some((g) => g.email === email), guardians);

// 6. 권한
const other = await call("POST", "/api/v1/auth/guardian/signup", { body: { name: "남", email: `other-${stamp}@example.com`, password: "password123" } });
const otherList = await call("GET", `/api/v1/seniors/${senior.json.user.id}/records`, { token: other.json.token });
check("연결 안 된 보호자는 기록을 볼 수 없음", otherList.status === 404, otherList);
const seniorList = await call("GET", `/api/v1/seniors/${senior.json.user.id}/records`, { token: S });
check("어르신 계정은 보호자 조회 API를 쓸 수 없음", seniorList.status === 403, seniorList);
const noToken = await call("GET", "/api/v1/links");
check("토큰 없으면 거절", noToken.status === 401, noToken);
const classify = await call("POST", "/api/v1/messages/classify", { token: S, body: {} });
check("로그인 토큰으로 문자 판정 API 통과 (본문 오류 400)", classify.status === 400, classify);

// 7. 삭제·연결 끊기·로그아웃
const del = await call("DELETE", `/api/v1/records/r1-${stamp}`, { token: S });
const afterDel = await call("GET", `/api/v1/seniors/${senior.json.user.id}/records`, { token: G });
check("어르신이 지운 기록은 보호자 화면에서도 사라짐", del.status === 204 && afterDel.json.records.length === 1, afterDel);
const unlink = await call("DELETE", `/api/v1/links/${senior.json.user.id}`, { token: G });
const afterUnlink = await call("GET", `/api/v1/seniors/${senior.json.user.id}/records`, { token: G });
check("연결 끊으면 기록을 볼 수 없음", unlink.status === 204 && afterUnlink.status === 404, afterUnlink);
const logout = await call("POST", "/api/v1/auth/logout", { token: G });
const afterLogout = await call("GET", "/api/v1/me", { token: G });
check("로그아웃 후 토큰 무효", logout.status === 204 && afterLogout.status === 401, afterLogout);

console.log(failed ? `\n❌ ${failed}개 실패` : "\n✅ 모두 통과");
process.exit(failed ? 1 : 0);
