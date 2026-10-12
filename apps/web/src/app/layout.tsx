import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Connect Me — You share. We connect.",
  description: "A lightweight, single-use QR-based professional networking contact collection platform.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-obsidian text-warmIvory antialiased selection:bg-royalViolet selection:text-white">
        <div className="min-h-screen bg-devcon-mesh bg-fixed">
          {children}
        </div>
      </body>
    </html>
  );
}
