import { maskPii } from "@/lib/pii";

export type NormalizedUrl = {
  /** 소문자 도메인 (한글 도메인은 xn-- 형태) */
  host: string;
  /** 경로. 개인정보를 가리고, ? 뒤(검색어·로그인 정보 등)는 버린다 */
  path: string;
  /** 보여주기·저장용: 도메인 + 경로 */
  display: string;
  isIp: boolean;
  /** user@host 처럼 @ 앞에 다른 글자를 넣어 속이는 주소 */
  hasUserInfo: boolean;
  port: string;
};

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** 인터넷 주소를 판정용으로 정리한다. http(s) 주소가 아니면 null */
export function normalizeUrl(raw: string): NormalizedUrl | null {
  const text = raw.trim();
  let url: URL;
  try {
    url = new URL(SCHEME.test(text) && !/^[^/:]+:\d/.test(text) ? text : `http://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
  if (!isIp && !host.includes(".")) return null;

  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // 잘못된 % 표기는 그대로 둔다
  }
  path = maskPii(path).slice(0, 300);
  return {
    host,
    path,
    display: host + (path === "/" ? "" : path),
    isIp,
    hasUserInfo: url.username !== "" || url.password !== "",
    port: url.port,
  };
}

/** host가 domain 자신이거나 그 하위 도메인인지 */
export function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}
