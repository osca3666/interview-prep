import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/server";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="flex min-h-screen flex-col">
            <header className="border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
              <nav
                className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6 lg:px-8"
                aria-label="Main navigation"
              >
                <Link
                  href="/"
                  className="text-base font-semibold tracking-tight text-zinc-950 dark:text-white"
                >
                  LeetCode Review
                </Link>
                <div className="flex flex-wrap items-center justify-end gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  <Link
                    href="/"
                    className="rounded-md px-3 py-2 transition hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-900 dark:hover:text-white"
                  >
                    Home
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-md px-3 py-2 transition hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-900 dark:hover:text-white"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/problems"
                    className="rounded-md px-3 py-2 transition hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-900 dark:hover:text-white"
                  >
                    Problems
                  </Link>
                  <ThemeToggle />
                  {isSignedIn ? (
                    <form action={signOutAction}>
                      <button
                        type="submit"
                        className="rounded-md px-3 py-2 transition hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-900 dark:hover:text-white"
                      >
                        Sign out
                      </button>
                    </form>
                  ) : (
                    <>
                      <Link
                        href="/sign-in"
                        className="rounded-md px-3 py-2 transition hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-900 dark:hover:text-white"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/sign-up"
                        className="rounded-md bg-zinc-950 px-3 py-2 text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                      >
                        Sign up
                      </Link>
                    </>
                  )}
                </div>
              </nav>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
