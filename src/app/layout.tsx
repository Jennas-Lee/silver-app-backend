import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Silver App API",
  description: "어르신을 위한 악성 메시지 탐지·키오스크 안내 앱의 백엔드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
