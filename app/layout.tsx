import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedAnalyticsVisualTestHeader } from "@/lib/visual-test-access";
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
  const requestHeaders = await headers();
  const isVisualTest = hasTrustedAnalyticsVisualTestHeader(requestHeaders);
  let isSignedIn = false;
  let userEmail: string | null = null;

  if (!isVisualTest) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    isSignedIn = Boolean(data?.claims?.sub);
    userEmail =
      typeof data?.claims?.email === "string" ? data.claims.email : null;
  }

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
          <AppShell isSignedIn={isSignedIn} userEmail={userEmail}>
            {children}
          </AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
