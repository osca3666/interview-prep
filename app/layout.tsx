import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LeetCode Review",
  description: "Track LeetCode practice and review problems on schedule.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-zinc-200 bg-white/85 backdrop-blur">
            <nav
              className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8"
              aria-label="Main navigation"
            >
              <Link
                href="/"
                className="text-base font-semibold tracking-tight text-zinc-950"
              >
                LeetCode Review
              </Link>
              <div className="flex items-center gap-1 text-sm font-medium text-zinc-600">
                <Link
                  href="/"
                  className="rounded-md px-3 py-2 transition hover:bg-zinc-100 hover:text-zinc-950"
                >
                  Home
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-md px-3 py-2 transition hover:bg-zinc-100 hover:text-zinc-950"
                >
                  Dashboard
                </Link>
              </div>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
