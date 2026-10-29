#!/usr/bin/env node
// 한국어 스미싱 데이터셋으로 문자 판정 API를 평가한다.
//
// 데이터: https://huggingface.co/datasets/jmjmjm3/kor-smishing-message (CC BY-NC-SA 4.0, 저장소에 포함하지 않음)
//
// 사용법:
//   node scripts/eval-messages.mjs <smishing.csv | rules-flagged.jsonl> [서버 주소] [클래스당 개수=100] [시드=42]
// 예:
//   node scripts/eval-messages.mjs ../.data/kor-smishing/smishing.csv http://localhost:3000 100
// 기기 토큰은 환경변수 DEVICE_TOKEN (기본값 dev-token-1).
// 결과: 콘솔 요약 + eval-results/messages-<시각>.json (git에 올라가지 않음)
//
// 실제 비용이 드는 작업이므로 개수를 확인하고 실행할 것.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [csvPath, baseArg = "http://localhost:3000", perClassArg = "100", seedArg = "42"] = process.argv.slice(2);
if (!csvPath) {
  console.error("사용법: node scripts/eval-messages.mjs <smishing.csv> [서버 주소] [클래스당 개수] [시드]");
  process.exit(1);
}
const base = baseArg.replace(/\/$/, "");
const perClass = Number(perClassArg);
const CONCURRENCY = 4;

// 따옴표 안 줄바꿈을 지원하는 간단한 CSV 파서
function parseCsv(text) {
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

// 시드 고정 난수 (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 입력: 데이터셋 CSV, 또는 앱의 1차 규칙이 서버로 넘긴 메시지 목록(rules-flagged.jsonl, ruleHits 포함).
// jsonl을 쓰면 실제 앱과 같은 흐름(규칙 통과 → 서버 판정)으로 평가한다.
const all = [];
if (csvPath.endsWith(".jsonl")) {
  for (const line of readFileSync(csvPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.content.length <= 2000) all.push({ content: r.content, smishing: r.smishing, hits: r.hits ?? [] });
  }
} else {
  const [, ...data] = parseCsv(readFileSync(csvPath, "utf8").replace(/^﻿/, ""));
  const seen = new Set();
  for (const r of data) {
    const content = r[0]?.trim();
    const label = r[1]?.trim();
    if (!content || content.length > 2000 || seen.has(content) || (label !== "정상" && label !== "스미싱")) continue;
    seen.add(content);
    all.push({ content, smishing: label === "스미싱", hits: [] });
  }
}

const rand = rng(Number(seedArg));
const pick = (list, n) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};
const samples = [...pick(all.filter((s) => s.smishing), perClass), ...pick(all.filter((s) => !s.smishing), perClass)];
console.log(`표본 ${samples.length}건 (스미싱 ${perClass}, 정상 ${perClass}), 서버 ${base}\n`);

async function classify(s) {
  const started = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${base}/api/v1/messages/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Device-Token": process.env.DEVICE_TOKEN ?? "dev-token-1" },
      // 데이터셋에 보낸 사람 정보가 없으므로 연락처에 없는 국내 번호로 가정
      body: JSON.stringify({ source: "sms", sender: "01012345678", senderInContacts: false, body: s.content, ruleHits: s.hits.slice(0, 20) }),
    });
    const out = await res.json().catch(() => ({}));
    if (res.ok) return { ...s, ...out, ms: Date.now() - started };
    if (res.status !== 429 && res.status < 500) return { ...s, error: `${res.status} ${out?.error?.code}`, ms: Date.now() - started };
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  return { ...s, error: "retries exhausted", ms: Date.now() - started };
}

const results = [];
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < samples.length) {
      const s = samples[next++];
      const r = await classify(s);
      results.push(r);
      if (results.length % 20 === 0) console.log(`  ${results.length}/${samples.length}`);
    }
  }),
);

// 지표
const ok = results.filter((r) => !r.error);
const sm = ok.filter((r) => r.smishing);
const no = ok.filter((r) => !r.smishing);
const count = (list, v) => list.filter((r) => r.verdict === v).length;
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "-");

// "잡음" = suspicious 이상, "치움" = malicious
const tp = sm.filter((r) => r.verdict !== "safe").length;
const fp = no.filter((r) => r.verdict !== "safe").length;
const precision = tp / (tp + fp || 1);
const recall = tp / (sm.length || 1);
const f1 = (2 * precision * recall) / (precision + recall || 1);

const JARGON = ["탭", "터치", "클릭", "링크", "URL", "스크롤", "앱", "어플", "APK", "결제", "사이트", "스미싱", "피싱", "팝업", "아이콘"];
const speechOk = ok.filter((r) => {
  const reason = r.reason ?? "";
  return !JARGON.some((w) => reason.includes(w)) && !/[A-Za-z]/.test(reason) && reason.split(/(?<=[.?!요])\s+/).filter(Boolean).length <= 2;
}).length;

const ms = ok.map((r) => r.ms).sort((a, b) => a - b);
console.log(`
## 결과 (오류 ${results.length - ok.length}건 제외, ${ok.length}건)

스미싱 ${sm.length}건: malicious ${count(sm, "malicious")} / suspicious ${count(sm, "suspicious")} / safe ${count(sm, "safe")}
정상   ${no.length}건: malicious ${count(no, "malicious")} / suspicious ${count(no, "suspicious")} / safe ${count(no, "safe")}

- 정상을 사기로 판정해 알림을 치움 (가장 중요): ${pct(count(no, "malicious"), no.length)}
- 정상에 경고 이상 (suspicious+malicious): ${pct(fp, no.length)}
- 스미싱을 잡음 (suspicious 이상): ${pct(tp, sm.length)}, 그중 바로 치움(malicious): ${pct(count(sm, "malicious"), sm.length)}
- F1 (suspicious 이상을 양성으로): ${f1.toFixed(3)}  [참고: Horizon 모델 같은 데이터 F1 0.909, 오탐 12.0%]
- 말투 점검 통과: ${pct(speechOk, ok.length)}
- 응답 시간 중간값 ${(ms[ms.length >> 1] / 1000).toFixed(1)}초, 90% ${(ms[Math.floor(ms.length * 0.9)] / 1000).toFixed(1)}초
`);

const wrong = ok.filter((r) => (r.smishing && r.verdict === "safe") || (!r.smishing && r.verdict === "malicious"));
if (wrong.length) {
  console.log("## 틀린 예 (놓친 스미싱, 치워진 정상)");
  for (const r of wrong.slice(0, 20)) {
    console.log(`- [${r.smishing ? "스미싱→safe" : "정상→malicious"}] ${r.content.replace(/\s+/g, " ").slice(0, 80)}\n    → ${r.reason}`);
  }
}

mkdirSync("eval-results", { recursive: true });
const file = `eval-results/messages-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify({ base, perClass, seed: Number(seedArg), results }, null, 2));
console.log(`\n자세한 결과: ${file}`);
