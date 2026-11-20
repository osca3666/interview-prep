"use client";

import {
  BookOpen,
  CalendarDays,
  ChevronUp,
  LayoutDashboard,
  Library,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Upload,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOutAction } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";

type AppShellProps = {
  children: ReactNode;
  isSignedIn: boolean;
  userEmail: string | null;
};

type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

const navigationItems: NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    isActive: (pathname) => pathname === "/dashboard",
  },
  {
    href: "/problems",
    label: "Problems",
    icon: Library,
    isActive: (pathname) => pathname === "/problems",
  },
  {
    href: "/roadmaps",
    label: "Roadmaps",
    icon: Route,
    isActive: (pathname) => pathname.startsWith("/roadmaps"),
  },
  {
    href: "/study-plan",
    label: "Study Plan",
    icon: CalendarDays,
    isActive: (pathname) => pathname.startsWith("/study-plan"),
  },
  {
    href: "/problems/import",
    label: "Import",
    icon: Upload,
    isActive: (pathname) => pathname.startsWith("/problems/import"),
  },
];

function isApplicationRoute(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/problems") ||
    pathname === "/analytics" ||
    pathname.startsWith("/roadmaps") ||
    pathname.startsWith("/study-plan")
  );
}

function Brand({ labelClassName }: { labelClassName: string }) {
  return (
    <Link
      href="/dashboard"
      title="LeetCode Review"
      className="inline-flex min-w-0 items-center gap-2.5 rounded-md text-zinc-950 outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:text-white dark:focus-visible:ring-offset-zinc-950"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-600 text-white">
        <BookOpen className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className={`truncate text-sm font-semibold ${labelClassName}`}>
        LeetCode Review
      </span>
    </Link>
  );
}

function NavigationLinks({
  pathname,
  onNavigate,
  labelClassName,
  linkLayoutClassName,
}: {
  pathname: string;
  onNavigate?: () => void;
  labelClassName: string;
  linkLayoutClassName: string;
}) {
  return (
    <nav aria-label="Main navigation" className="space-y-1">
      {navigationItems.map((item) => {
        const active = item.isActive(pathname);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={`flex h-11 items-center gap-3 rounded-md text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 ${linkLayoutClassName} ${
              active
                ? "bg-violet-100 text-violet-950 dark:bg-violet-500/20 dark:text-violet-100"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${active ? "text-violet-600 dark:text-violet-300" : "text-zinc-500 dark:text-zinc-400"}`}
              aria-hidden="true"
            />
            <span className={labelClassName}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AccountSection({
  userEmail,
  onSignOut,
  labelClassName,
  layoutClassName,
  accountButtonClassName,
}: {
  userEmail: string | null;
  onSignOut?: () => void;
  labelClassName: string;
  layoutClassName: string;
  accountButtonClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const initial = userEmail?.trim().charAt(0).toUpperCase() || "U";
  const accountLabel = userEmail || "My account";

  return (
    <div
      data-sidebar-account
      className="relative border-t border-zinc-200 pt-3 dark:border-zinc-800"
    >
      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute bottom-[calc(100%+0.5rem)] left-0 w-52 rounded-md border border-zinc-200 bg-white p-1.5 shadow-lg shadow-zinc-950/8 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/30"
        >
          <form action={signOutAction} onSubmit={onSignOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-600 outline-none transition hover:bg-zinc-100 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}

      <div className={`flex items-center gap-2 ${layoutClassName}`}>
        <button
          type="button"
          aria-label="Open account menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={`flex min-w-0 items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left outline-none transition hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-zinc-900 ${accountButtonClassName}`}
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {initial}
          </span>
          <span className={`min-w-0 flex-1 ${labelClassName}`}>
            <span className="block truncate text-sm font-medium text-zinc-950 dark:text-white">
              {accountLabel}
            </span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              Account
            </span>
          </span>
          <ChevronUp
            className={`h-4 w-4 shrink-0 text-zinc-500 transition ${labelClassName} ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        <ThemeToggle />
      </div>
    </div>
  );
}

function PublicHeader({ isSignedIn }: { isSignedIn: boolean }) {
  return (
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
            <>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-md px-3 py-2 transition hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-900 dark:hover:text-white"
                >
                  Sign out
                </button>
              </form>
            </>
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
  );
}

export function AppShell({ children, isSignedIn, userEmail }: AppShellProps) {
  const pathname = usePathname();
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const showApplicationShell = isSignedIn && isApplicationRoute(pathname);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && mobileExpanded) {
        setMobileExpanded(false);
        mobileToggleRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileExpanded]);

  if (!showApplicationShell) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader isSignedIn={isSignedIn} />
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  const labelClassName = `${
    mobileExpanded ? "max-lg:inline" : "max-lg:hidden"
  } ${desktopCollapsed ? "lg:hidden" : "lg:inline"}`;
  const linkLayoutClassName = `${
    mobileExpanded
      ? "max-lg:justify-start max-lg:px-3"
      : "max-lg:justify-center max-lg:px-2"
  } ${
    desktopCollapsed
      ? "lg:justify-center lg:px-2"
      : "lg:justify-start lg:px-3"
  }`;
  const accountLayoutClassName = `${
    mobileExpanded ? "max-lg:flex-row" : "max-lg:flex-col"
  } ${desktopCollapsed ? "lg:flex-col" : "lg:flex-row"}`;
  const accountButtonClassName = `${
    mobileExpanded
      ? "max-lg:w-auto max-lg:flex-1 max-lg:justify-start"
      : "max-lg:w-10 max-lg:flex-none max-lg:justify-center"
  } ${
    desktopCollapsed
      ? "lg:w-10 lg:flex-none lg:justify-center"
      : "lg:w-auto lg:flex-1 lg:justify-start"
  }`;

  return (
    <div
      data-authenticated-app-shell
      data-mobile-sidebar={mobileExpanded ? "expanded" : "collapsed"}
      data-desktop-sidebar={desktopCollapsed ? "collapsed" : "expanded"}
      className="authenticated-app-shell bg-background"
    >
      <aside
        aria-label="Application sidebar"
        className={`authenticated-app-sidebar flex flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${
          mobileExpanded ? "max-lg:shadow-xl" : ""
        }`}
      >
        <div className="relative flex h-16 shrink-0 items-center border-b border-zinc-200 px-3 dark:border-zinc-800">
          <Brand labelClassName={labelClassName} />
          <button
            ref={mobileToggleRef}
            type="button"
            aria-label={mobileExpanded ? "Collapse navigation" : "Expand navigation"}
            aria-expanded={mobileExpanded}
            onClick={() => setMobileExpanded((current) => !current)}
            className="absolute -right-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm outline-none transition hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-violet-500 lg:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-white"
          >
            {mobileExpanded ? (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label={desktopCollapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!desktopCollapsed}
            onClick={() => setDesktopCollapsed((current) => !current)}
            className="absolute -right-3 hidden h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm outline-none transition hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-violet-500 lg:inline-flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-white"
          >
            {desktopCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-3 py-4">
          <NavigationLinks
            pathname={pathname}
            labelClassName={labelClassName}
            linkLayoutClassName={linkLayoutClassName}
            onNavigate={() => setMobileExpanded(false)}
          />
          <div className="mt-auto pt-6">
            <AccountSection
              userEmail={userEmail}
              labelClassName={labelClassName}
              layoutClassName={accountLayoutClassName}
              accountButtonClassName={accountButtonClassName}
            />
          </div>
        </div>
      </aside>
      <main data-app-main className="authenticated-app-main min-w-0">
        {children}
      </main>
    </div>
  );
}
