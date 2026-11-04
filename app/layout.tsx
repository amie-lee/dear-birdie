import type { Metadata } from "next";
import "./globals.css";

const title = "Dear Birdie";
const description = "A little post office for focus, wishes, and thoughts in flight.";

export const metadata: Metadata = {
  metadataBase: new URL("https://dear-birdie.quiet-works.workers.dev"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Dear Birdie",
    title,
    description,
    url: "/",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Dear Birdie — an open paper envelope for focus and wishes" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og-image.png"] },
  title,
  description: "A little post office for focus, wishes, and thoughts in flight.",
  icons: { icon: [{ url: "/favicon.svg?v=2", type: "image/svg+xml", sizes: "any" }] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={JSON.stringify({ token: "a53fed77cac547368f75f17f36b269ce" })}
        />
      </body>
    </html>
  );
}
