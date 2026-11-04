import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dear Birdie — A little letter, carried somewhere",
  description: "A little post office for focus, wishes, and thoughts in flight.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
