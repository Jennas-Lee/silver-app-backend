import { z } from "zod";

export const UrlCategory = z.enum([
  "phishing", // 은행·기관·택배·가게 등을 흉내 낸 가짜 사이트 (개인정보·돈을 노림)
  "malware", // 프로그램(APK) 설치를 유도
  "scam", // 투자·도박·쇼핑 사기 등
  "other",
  "none",
]);
export type UrlCategory = z.infer<typeof UrlCategory>;

/** 앱 → 서버 요청 */
export const UrlCheckRequest = z.object({
  urls: z.array(z.string().trim().min(1).max(2000)).min(1).max(10),
});

/** Claude 구조화 출력 */
export const UrlModelResult = z.object({
  verdict: z.enum(["safe", "suspicious", "malicious"]),
  category: UrlCategory,
  reason: z
    .string()
    .describe("어르신께 보여주고 읽어드릴 설명. 쉬운 해요체 한두 문장, 화면 용어와 영어 없이"),
});
export type UrlModelResult = z.infer<typeof UrlModelResult>;

export type UrlVerdict = UrlModelResult["verdict"] | "unknown";

/** 서버 → 앱 응답의 주소 하나 */
export type UrlCheckResult = {
  url: string;
  /** 주소에서 뽑은 도메인. 주소가 아니면 null */
  host: string | null;
  verdict: UrlVerdict;
  category: UrlCategory;
  reason: string;
  /** 판정 근거: rule(정해진 규칙) | webrisk(구글 위험 목록) | model(Claude) | invalid(주소가 아님) | error(판정 실패) */
  source: "rule" | "webrisk" | "model" | "invalid" | "error";
  /** 저장해 둔 판정을 다시 쓴 경우 true */
  cached: boolean;
};
