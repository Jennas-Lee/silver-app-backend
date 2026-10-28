#!/usr/bin/env node
// 문자 판정 API를 예시 문자들로 시험하고 정확도를 보여준다.
//
// 사용법:
//   node scripts/try-messages.mjs [서버 주소]
// 기기 토큰은 환경변수 DEVICE_TOKEN (기본값 dev-token-1).
//
// 예시 문자는 실제 사례를 본떠 만든 가짜이며, 링크와 번호는 존재하지 않는 값이다.

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

/** expect: 기대 판정. "malicious|suspicious"처럼 여러 개 허용 가능 */
const CASES = [
  // 사기
  { expect: "malicious", sender: "+447700900123", body: "[Web발신] 고객님 택배가 주소 불일치로 보류중입니다. 주소 확인 bit.ly/3xYzAbc", ruleHits: ["short_url", "keyword:택배", "international"] },
  { expect: "malicious", sender: "01098765432", body: "엄마 나 폰 액정 깨져서 임시폰으로 연락해. 급하게 확인할 거 있어서 그러는데 신분증 사진이랑 카드 앞뒤 사진 좀 보내줘", ruleHits: ["keyword:액정", "keyword:신분증"] },
  { expect: "malicious", sender: "07012345678", body: "[국외발신] 해외결제 승인 980,000원 (Amazon) 본인 아닐 경우 소비자원 02-000-0000 문의", ruleHits: ["keyword:해외결제", "070"] },
  { expect: "malicious", sender: "01055556666", body: "[부고] 故 김OO님께서 별세하셨기에 삼가 알려드립니다. 장례식장 안내 https://bugo-notice.example/x7", ruleHits: ["url", "keyword:부고"] },
  { expect: "malicious", sender: "+8613800000000", body: "[서울중앙지검] 귀하 명의 계좌가 범죄에 연루되어 조사가 필요합니다. 아래 앱 설치 후 본인확인 바랍니다 http://spo-check.example/app.apk", ruleHits: ["apk", "keyword:검찰", "international"] },
  { expect: "malicious|suspicious", sender: "01077778888", body: "정부지원 저금리 대환대출 승인대상자 선정. 최대 5천만원 연 2.9% 상담 ☎ 1600-0000", ruleHits: ["keyword:대출"] },
  { expect: "malicious|suspicious", sender: "01033334444", body: "[주식리딩방] 이번주 급등 예정 종목 무료 공개! 수익률 300% 보장 카톡 오픈채팅 open.kakao.example/abc", ruleHits: ["url", "keyword:수익"] },
  { expect: "malicious|suspicious", sender: "+12025550123", body: "[Web발신] 교통 범칙금 미납 고지서. 기한 내 미납시 가산금 부과. 확인 me2.do/xAbCdE", ruleHits: ["short_url", "keyword:범칙금", "international"] },
  // 정상 (1차 규칙에서 의심으로 걸렸지만 실제로는 정상인 경우)
  { expect: "safe", sender: "15881234", body: "[Web발신] [OO은행] 인증번호 [482913]을 입력해주세요. 타인 노출 금지", ruleHits: ["keyword:인증번호"] },
  { expect: "safe|suspicious", sender: "15880000", body: "[CJ대한통운] 고객님의 상품이 오늘 14~16시 배송 예정입니다. 운송장 1234-5678-9012", ruleHits: ["keyword:택배"] },
  { expect: "safe", sender: "김철수", senderInContacts: true, body: "형님 이번 주 토요일 동창회 장소 바뀌었어요. 종로 OO식당 12시입니다", ruleHits: [] },
  { expect: "safe|suspicious", sender: "0212345678", body: "[OO내과] 김OO님 내일 오전 10시 진료 예약 안내드립니다. 변경은 02-1234-5678", ruleHits: ["keyword:예약"] },
  { expect: "malicious|suspicious", sender: "딸", senderInContacts: true, body: "엄마 나 급해서 그러는데 지금 이 계좌로 200만원만 보내줘 [계좌번호] 이따 전화할게", ruleHits: ["keyword:계좌", "keyword:급해"] },
];

const JARGON = ["탭", "터치", "클릭", "링크", "URL", "스크롤", "앱", "APK", "결제", "팝업", "아이콘"];

let correct = 0;
let speechOk = 0;
for (const [i, c] of CASES.entries()) {
  const started = Date.now();
  const res = await fetch(`${base}/api/v1/messages/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Device-Token": process.env.DEVICE_TOKEN ?? "dev-token-1" },
    body: JSON.stringify({ source: "sms", senderInContacts: false, ...c, expect: undefined }),
  });
  const out = await res.json();
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  if (!res.ok) {
    console.log(`#${i + 1} ❌ HTTP ${res.status} ${JSON.stringify(out)}`);
    continue;
  }
  const ok = c.expect.split("|").includes(out.verdict);
  if (ok) correct++;

  const warnings = [];
  const hits = JARGON.filter((w) => out.reason.includes(w));
  if (hits.length) warnings.push(`용어:${hits.join(",")}`);
  if (/[A-Za-z]/.test(out.reason)) warnings.push("영어");
  if (out.reason.split(/(?<=[.?!요])\s+/).filter(Boolean).length > 2) warnings.push("3문장 이상");
  if (!warnings.length) speechOk++;

  console.log(
    `#${i + 1} ${ok ? "✅" : "❌"} 기대 ${c.expect} → ${out.verdict} (${out.category}, ${secs}초)` +
      `\n    "${c.body.slice(0, 40)}…"` +
      `\n    설명: ${out.reason}${warnings.length ? `  ⚠️ ${warnings.join(" / ")}` : ""}`,
  );
}

console.log(`\n판정 정확도: ${correct}/${CASES.length}, 말투 통과: ${speechOk}/${CASES.length}`);
