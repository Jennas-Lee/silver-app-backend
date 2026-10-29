import Anthropic from "@anthropic-ai/sdk";

// ANTHROPIC_API_KEY 환경변수(Vercel) 또는 로컬 `ant auth login` 프로필을 자동으로 사용한다.
// 키오스크 앞에서 무한정 기다리지 않도록 요청당 50초, 재시도 1회로 제한.
export const anthropic = new Anthropic({ timeout: 50_000, maxRetries: 1 });
