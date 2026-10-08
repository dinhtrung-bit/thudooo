import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phòng thử đồ AI",
  description:
    "Tải ảnh trang phục để thử đồ với phòng thử đồ AI đang trong giai đoạn thử nghiệm.",
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