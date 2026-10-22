import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "EnCare",
    template: "%s | EnCare",
  },
  description: "Care, connected. Modern care management for exceptional teams.",
  keywords: ["care management", "domiciliary care", "healthcare", "staff management", "scheduling"],
  authors: [{ name: "EnCare" }],
  creator: "EnCare",
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "EnCare",
    title: "EnCare - Care, connected.",
    description: "Modern care management for exceptional teams.",
  },
  twitter: {
    card: "summary_large_image",
    title: "EnCare",
    description: "Care, connected. Modern care management for exceptional teams.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#237E78",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
