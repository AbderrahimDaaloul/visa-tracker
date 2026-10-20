"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore, useState, useEffect } from "react";
import { t } from "@/lib/i18n";
import { Button, cn } from "./ui";

type UserInfo = { pseudo: string; role: string } | null;

/* External theme store: read DOM class, notify subscribers on toggle */
let cacheDark: boolean | null = null;
const themeSubs = new Set<() => void>();
function rawDark(): boolean {
  if (cacheDark === null) cacheDark = document.documentElement.classList.contains("dark");
  return cacheDark;
}
function setThemeStore(next: boolean) {
  cacheDark = next;
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem("vtt-theme", next ? "dark" : "light");
  } catch {
    /* ignore */
  }
  themeSubs.forEach((l) => l());
}
function subscribeTheme(cb: () => void): () => void {
  themeSubs.add(cb);
  return () => {
    themeSubs.delete(cb);
  };
}

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | undefined>(undefined);
  const dark = useSyncExternalStore(subscribeTheme, rawDark, () => false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ? { pseudo: d.user.pseudo, role: d.user.role } : null))
      .catch(() => setUser(null));
  }, [pathname]);

  function toggleDark() {
    setThemeStore(!dark);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  const links: { href: string; label: string; auth?: boolean }[] = [
    { href: "/contribute", label: t.nav.contribute, auth: true },
    { href: "/visualize", label: t.nav.dashboard },
    { href: "/journey", label: t.nav.journey, auth: true },
    { href: "/cohorts", label: t.nav.cohorts, auth: true },
    { href: "/settings", label: t.nav.settings, auth: true },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)] text-sm text-[var(--primary-fg)]">VT</span>
          <span className="hidden sm:inline">{t.app.name}</span>
        </Link>
        <nav className="mx-2 hidden flex-1 items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm hover:bg-[var(--background)]",
                pathname === l.href ? "font-semibold text-[var(--primary)]" : "text-foreground/80"
              )}
            >
              {l.label}
            </Link>
          ))}
          {user?.role && user.role !== "student" ? (
            <Link href="/admin" className="rounded-lg px-3 py-1.5 text-sm hover:bg-[var(--background)]">
              {t.nav.admin}
            </Link>
          ) : null}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Mode sombre">
            {dark ? "☀️" : "🌙"}
          </Button>
          {user === undefined ? null : user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm sm:inline" title={user.pseudo}>
                @{user.pseudo}
              </span>
              <Button variant="secondary" size="sm" onClick={logout}>
                {t.nav.logout}
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button size="sm">{t.nav.login}</Button>
            </Link>
          )}
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm",
              pathname === l.href ? "font-semibold text-[var(--primary)]" : "text-foreground/80"
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-12 border-t border-[var(--border)] py-6 text-center text-xs text-muted">
      <p className="mx-auto max-w-3xl px-4">
        {t.home.disclaimer}
      </p>
      <p className="mt-1">{t.app.name} — communauté des étudiants tunisiens · visa d′études Italie</p>
    </footer>
  );
}
