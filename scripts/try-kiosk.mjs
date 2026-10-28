#!/usr/bin/env node
// 키오스크 안내 API를 사진 파일로 시험한다.
//
// 사용법:
//   node scripts/try-kiosk.mjs <사진 경로> "<목표>" [서버 주소]
// 예:
//   node scripts/try-kiosk.mjs samples/mcdonalds-1.jpg "불고기버거 먹고 싶어"
//   node scripts/try-kiosk.mjs samples/cafe.jpg "아이스 아메리카노" https://<배포주소>
//
// 기기 토큰은 환경변수 DEVICE_TOKEN (기본값 dev-token-1).
// 사진은 앱과 똑같이 긴 변 1024px 이하 JPEG로 미리 줄여두는 것을 권장.

import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const [file, goal, base = "http://localhost:3000"] = process.argv.slice(2);
if (!file || !goal) {
  console.error('사용법: node scripts/try-kiosk.mjs <사진 경로> "<목표>" [서버 주소]');
  process.exit(1);
}

const mediaType = { ".png": "image/png", ".webp": "image/webp" }[extname(file).toLowerCase()] ?? "image/jpeg";
const image = readFileSync(file).toString("base64");
console.log(`사진: ${file} (${Math.round(statSync(file).size / 1024)}KB, ${mediaType})`);
console.log(`목표: ${goal}\n`);

const started = Date.now();
const res = await fetch(`${base.replace(/\/$/, "")}/api/v1/kiosk/guide`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Device-Token": process.env.DEVICE_TOKEN ?? "dev-token-1",
  },
  body: JSON.stringify({ goal, image, mediaType }),
});
const body = await res.json();

console.log(`HTTP ${res.status} (${((Date.now() - started) / 1000).toFixed(1)}초)`);
console.log(JSON.stringify(body, null, 2));
