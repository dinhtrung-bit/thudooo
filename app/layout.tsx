import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phòng thử đồ",
  description:
    "Khám phá trang phục và trải nghiệm phòng thử đồ trực tuyến.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}