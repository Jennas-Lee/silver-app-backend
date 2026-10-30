// 앱(PiiMasker.kt)과 같은 규칙으로 개인정보를 가린다. 앱에서 가려서 올리지만, 서버에서 한 번 더 확인한다.
// 전화번호와 인증번호는 사기 판단에 필요해서 남긴다.

const RRN = /(?<!\d)\d{6}\s?-\s?[1-4]\d{6}(?!\d)/g;
const CARD = /(?<!\d)\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}(?!\d)|(?<!\d)\d{16}(?!\d)/g;
const DASHED_NUMBER = /(?<![\d-])\d{2,6}-\d{2,6}-\d{2,8}(-\d{1,3})?(?![\d-])/g;
const PHONE = /^(0\d{1,2}-\d{3,4}-\d{4}|1\d{3}-\d{4})$/;
const LONG_NUMBER = /(?<!\d)\d{10,14}(?!\d)/g;
const PHONE_PLAIN = /^(01\d{8,9}|0[2-6]\d{7,9}|070\d{8}|1[5-9]\d{6})$/;

export function maskPii(text: string): string {
  return text
    .replace(RRN, "[주민번호]")
    .replace(CARD, "[카드번호]")
    .replace(DASHED_NUMBER, (m) => (PHONE.test(m) ? m : "[계좌번호]"))
    .replace(LONG_NUMBER, (m) => (PHONE_PLAIN.test(m) ? m : "[계좌번호]"));
}
