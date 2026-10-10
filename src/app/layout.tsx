import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FalconCare Hub",
  description: "A clearer, calmer way to manage your care team.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className="antialiased">{children}</body>
    </html>
  );
}
