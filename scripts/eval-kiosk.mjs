#!/usr/bin/env node
// 사진 폴더로 키오스크 안내 API를 평가한다.
//
// 사용법:
//   node scripts/eval-kiosk.mjs <사진 폴더> [서버 주소] [목표 파일.json]
// 목표 파일: { "파일명.jpg": "불고기버거 먹고 싶어", ... }
//   목표 파일이 없거나 사진이 목록에 없으면 기본 목표("여기서 제일 인기 있는 메뉴 먹고 싶어")를 쓴다.
// 기기 토큰은 환경변수 DEVICE_TOKEN (기본값 dev-token-1).
// 사진은 앱과 똑같이 긴 변 1024px 이하 JPEG로 미리 줄여둘 것.
// 결과: 콘솔 요약 + eval-results/kiosk-<시각>.json (git 제외)
//
// 실제 비용이 드는 작업이므로 사진 수를 확인하고 실행할 것.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir, baseArg = "http://localhost:3000", goalsPath] = process.argv.slice(2);
if (!dir) {
  console.error("사용법: node scripts/eval-kiosk.mjs <사진 폴더> [서버 주소] [목표 파일.json]");
  process.exit(1);
}
const base = baseArg.replace(/\/$/, "");
const goals = goalsPath && existsSync(goalsPath) ? JSON.parse(readFileSync(goalsPath, "utf8")) : {};
const DEFAULT_GOAL = "여기서 제일 인기 있는 메뉴 먹고 싶어";
const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
console.log(`사진 ${files.length}장, 서버 ${base}\n`);

const JARGON = ["탭", "터치", "클릭", "스크롤", "스와이프", "카테고리", "옵션", "장바구니", "결제", "팝업", "아이콘", "홈 화면", "키오스크"];
function speechWarnings(speech) {
  const w = [];
  const hits = JARGON.filter((j) => speech.includes(j));
  if (hits.length) w.push(`용어:${hits.join(",")}`);
  if (/[A-Za-z]/.test(speech)) w.push("영어");
  if (/[()\[\]"'<>/]/.test(speech)) w.push("기호");
  const sentences = speech.split(/(?<=[.?!요])\s+/).filter(Boolean);
  if (sentences.length > 2) w.push(`${sentences.length}문장`);
  if (sentences.some((s) => s.length > 40)) w.push("긴 문장");
  return w;
}

async function run(file) {
  const ext = file.toLowerCase().split(".").pop();
  const mediaType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const goal = goals[file] ?? DEFAULT_GOAL;
  const started = Date.now();
  const res = await fetch(`${base}/api/v1/kiosk/guide`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Device-Token": process.env.DEVICE_TOKEN ?? "dev-token-1" },
    body: JSON.stringify({ goal, image: readFileSync(join(dir, file)).toString("base64"), mediaType }),
  });
  const out = await res.json().catch(() => ({}));
  return { file, goal, httpStatus: res.status, ms: Date.now() - started, ...out };
}

const results = [];
let next = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next < files.length) results.push(await run(files[next++]));
  }),
);
results.sort((a, b) => a.file.localeCompare(b.file));

for (const r of results) {
  if (r.httpStatus !== 200) {
    console.log(`❌ ${r.file} HTTP ${r.httpStatus} ${JSON.stringify(r.error)}`);
    continue;
  }
  const w = speechWarnings(r.speech);
  console.log(
    `${r.file} [${r.status}] (${(r.ms / 1000).toFixed(1)}초) 목표: ${r.goal}\n` +
      `    "${r.speech}"${w.length ? `  ⚠️ ${w.join(" / ")}` : ""}\n` +
      `    누를 곳: ${r.target ? `${r.target.label} [${r.target.box.map((n) => n.toFixed(2)).join(", ")}]` : "없음"}`,
  );
}

const ok = results.filter((r) => r.httpStatus === 200);
const byStatus = ok.reduce((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});
const ms = ok.map((r) => r.ms).sort((a, b) => a - b);
console.log(`
## 요약 (${ok.length}/${results.length}장 응답)
- 상태: ${JSON.stringify(byStatus)}
- 누를 곳 표시: ${ok.filter((r) => r.target).length}장
- 말투 점검 통과: ${ok.filter((r) => speechWarnings(r.speech).length === 0).length}장
- 응답 시간 중간값 ${(ms[ms.length >> 1] / 1000).toFixed(1)}초, 최대 ${(ms[ms.length - 1] / 1000).toFixed(1)}초`);

mkdirSync("eval-results", { recursive: true });
const file = `eval-results/kiosk-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify({ base, results }, null, 2));
console.log(`\n자세한 결과: ${file}`);
