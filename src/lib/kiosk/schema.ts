import { z } from "zod";

// 이미지 base64 최대 길이. Vercel 요청 본문 한도(약 4.5MB)보다 충분히 작게 잡는다.
// base64는 원본보다 약 4/3배 크므로 약 2.2MB JPEG까지 허용.
export const MAX_IMAGE_BASE64_LENGTH = 3_000_000;

/** 앱 → 서버 요청 */
export const KioskGuideRequest = z.object({
  sessionId: z.string().uuid().optional(),
  goal: z.string().trim().min(1).max(200),
  image: z.string().min(100).max(MAX_IMAGE_BASE64_LENGTH),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
  /** 직전 단계에서 앱이 읽어준 안내들 (오래된 것부터) */
  history: z
    .array(z.object({ speech: z.string().max(500) }))
    .max(30)
    .default([]),
  /** status가 need_input일 때 사용자의 대답 (예: "단품으로 할래") */
  userReply: z.string().trim().max(200).optional(),
});
export type KioskGuideRequest = z.infer<typeof KioskGuideRequest>;

/** Claude가 돌려줄 구조화 출력 */
export const KioskGuideModelOutput = z.object({
  speech: z.string().describe("어르신께 읽어드릴 안내. 쉬운 해요체 한두 문장, 화면 용어와 영어 없이"),
  status: z.enum(["in_progress", "done", "need_input", "unclear"]),
  target: z
    .object({
      label: z.string().describe("눌러야 할 버튼에 적힌 글자 또는 짧은 설명"),
      x1: z.number().describe("왼쪽 끝, 이미지 너비 대비 0~1"),
      y1: z.number().describe("위쪽 끝, 이미지 높이 대비 0~1"),
      x2: z.number().describe("오른쪽 끝, 이미지 너비 대비 0~1"),
      y2: z.number().describe("아래쪽 끝, 이미지 높이 대비 0~1"),
    })
    .nullable()
    .describe("눌러야 할 버튼 위치. 누를 버튼이 없으면 null"),
});
export type KioskGuideModelOutput = z.infer<typeof KioskGuideModelOutput>;

/** 서버 → 앱 응답 (docs/api/v1.md) */
export type KioskGuideResponse = {
  sessionId: string;
  speech: string;
  status: KioskGuideModelOutput["status"];
  target: { label: string; box: [number, number, number, number] } | null;
};
