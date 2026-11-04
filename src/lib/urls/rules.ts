import { matchesDomain, type NormalizedUrl } from "./normalize";
import type { UrlModelResult } from "./schema";

/** 공식 도메인. 하위 도메인까지 안전으로 본다 (아래 USER_CONTENT_HOSTS는 제외) */
const TRUSTED_DOMAINS = [
  // 정부·공공기관
  "go.kr", "gov.kr", "korea.kr", "nhis.or.kr", "nps.or.kr", "kisa.or.kr", "fss.or.kr", "kftc.or.kr",
  // 포털·메신저·검색
  "naver.com", "daum.net", "kakao.com", "kakaocorp.com", "google.com", "google.co.kr", "youtube.com", "apple.com",
  "samsung.com", "microsoft.com",
  // 은행·카드·간편결제
  "kbstar.com", "kbcard.com", "shinhan.com", "shinhancard.com", "wooribank.com", "wooricard.com", "hanabank.com",
  "hanacard.co.kr", "nonghyup.com", "nhcard.co.kr", "ibk.co.kr", "kakaobank.com", "tossbank.com", "toss.im",
  "kebhana.com", "busanbank.co.kr", "dgb.co.kr", "epostbank.go.kr", "kfcc.co.kr", "cu.co.kr", "samsungcard.com",
  "hyundaicard.com", "lottecard.co.kr", "bccard.com", "payco.com", "kakaopay.com",
  // 택배
  "cjlogistics.com", "hanjin.com", "lotteglogis.com", "logen.co.kr", "epost.kr",
  // 쇼핑·통신
  "coupang.com", "11st.co.kr", "gmarket.co.kr", "auction.co.kr", "ssg.com", "baemin.com",
  "tworld.co.kr", "kt.com", "uplus.co.kr",
];

/** 공식 도메인이지만 누구나 글이나 파일을 올릴 수 있는 곳. 안전으로 단정하지 않는다 */
const USER_CONTENT_HOSTS = [
  "sites.google.com", "docs.google.com", "drive.google.com", "storage.googleapis.com", "forms.gle",
  "blog.naver.com", "m.blog.naver.com", "cafe.naver.com", "m.cafe.naver.com", "naver.me",
  "open.kakao.com", "pf.kakao.com", "kko.to", "ko.kakao.com",
];

/** 짧은 주소 서비스. 실제 목적지를 숨긴다 */
const SHORTENERS = [
  "bit.ly", "me2.do", "han.gl", "vo.la", "url.kr", "t.ly", "tinyurl.com", "is.gd", "buly.kr", "c11.kr", "goo.gl",
  "t.co", "cutt.ly", "shorturl.at", "rb.gy", "naver.me", "kko.to", "ow.ly", "abit.ly", "lrl.kr", "zrr.kr",
];

/** 사칭에 자주 쓰이는 이름. 공식 도메인이 아닌데 이 이름이 들어 있으면 의심 단서 */
const BRAND_WORDS = [
  "naver", "kakao", "toss", "coupang", "cjlogis", "epost", "hanjin", "lotte", "nhis", "hometax", "police",
  "scourt", "kbstar", "shinhan", "woori", "hana", "nonghyup", "nhbank", "ibk", "samsung", "gov", "minwon", "wetax",
];

/** 사기에 자주 쓰이는 값싼 최상위 도메인 */
const RISKY_TLDS = ["top", "xyz", "icu", "cyou", "click", "buzz", "rest", "sbs", "cfd", "bond", "monster", "lol", "vip"];

const anyMatch = (host: string, list: string[]) => list.some((d) => matchesDomain(host, d));

/** 경로를 따로 저장해야 하는 도메인 (같은 도메인 안에 위험한 곳과 안전한 곳이 섞임) */
export function isSharedHost(host: string): boolean {
  return anyMatch(host, USER_CONTENT_HOSTS) || anyMatch(host, SHORTENERS);
}

export type RuleOutcome = { decided: UrlModelResult | null; hints: string[] };

/** Claude를 부르기 전 규칙 검사. 확실하면 decided, 아니면 Claude에게 넘길 단서(hints) */
export function applyRules(u: NormalizedUrl): RuleOutcome {
  const hints: string[] = [];
  const trusted = anyMatch(u.host, TRUSTED_DOMAINS) && !anyMatch(u.host, USER_CONTENT_HOSTS);

  if (/\.apk$/i.test(u.path) && !trusted) {
    return {
      decided: {
        verdict: "malicious",
        category: "malware",
        reason: "휴대폰에 위험한 프로그램을 몰래 까는 주소예요. 열지 마세요.",
      },
      hints,
    };
  }
  if (trusted && !u.hasUserInfo && !u.isIp) {
    return { decided: { verdict: "safe", category: "none", reason: "걱정하지 않으셔도 되는 주소예요." }, hints };
  }

  if (u.isIp) hints.push("도메인 대신 숫자(IP) 주소");
  if (u.hasUserInfo) hints.push("주소에 @가 들어 있어 실제 도메인을 숨김");
  if (u.host.split(".").some((label) => label.startsWith("xn--"))) hints.push("한글·외국 글자 도메인(퓨니코드)");
  if (u.port && u.port !== "80" && u.port !== "443") hints.push(`특이한 포트 번호 ${u.port}`);
  if (anyMatch(u.host, SHORTENERS)) hints.push("짧은 주소 서비스 (실제 목적지를 알 수 없음)");
  if (anyMatch(u.host, USER_CONTENT_HOSTS)) hints.push("누구나 글이나 파일을 올릴 수 있는 공식 서비스");
  const tld = u.host.split(".").pop() ?? "";
  if (RISKY_TLDS.includes(tld)) hints.push(`사기에 자주 쓰이는 최상위 도메인 .${tld}`);
  const name = u.host.replace(/\.[^.]+$/, "");
  const brands = BRAND_WORDS.filter((w) => name.includes(w));
  if (brands.length && !trusted) hints.push(`공식 도메인이 아닌데 이름이 들어 있음: ${brands.join(", ")}`);

  return { decided: null, hints };
}
