import { z } from "zod";

export const MessageCategory = z.enum([
  "delivery_scam", // 택배·배송 사칭
  "gov_impersonation", // 검찰·경찰·건강보험·국세청 등 공공기관 사칭
  "family_impersonation", // 가족·지인 사칭 ("엄마 폰 고장났어")
  "payment_scam", // 해외결제·카드 승인 사칭
  "invitation_scam", // 부고·청첩장·모바일 초대장 링크
  "loan", // 대출 권유
  "investment", // 주식·코인 리딩방, 고수익 투자
  "other",
  "none",
]);

/** 앱 → 서버 요청. 앱 안 규칙 검사에서 "의심"으로 분류된 메시지만 온다. */
export const ClassifyRequest = z.object({
  source: z.enum(["sms", "kakao", "other"]),
  sender: z.string().trim().max(100),
  senderInContacts: z.boolean(),
  /** 계좌번호·주민번호 등은 앱에서 [계좌번호]처럼 가려서 보낸다 */
  body: z.string().trim().min(1).max(2000),
  ruleHits: z.array(z.string().max(50)).max(20).default([]),
});
export type ClassifyRequest = z.infer<typeof ClassifyRequest>;

/** Claude 구조화 출력 = 서버 → 앱 응답 */
export const ClassifyResult = z.object({
  verdict: z.enum(["safe", "suspicious", "malicious"]),
  category: MessageCategory,
  reason: z
    .string()
    .describe("어르신께 보여주고 읽어드릴 설명. 쉬운 해요체 한두 문장, 화면 용어와 영어 없이"),
});
export type ClassifyResult = z.infer<typeof ClassifyResult>;
