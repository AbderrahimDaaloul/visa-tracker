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
  const [mobileOpen, setMobileOpen] = useState(false);
  const dark = useSyncExternalStore(subscribeTheme, rawDark, () => false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ? { pseudo: d.user.pseudo, role: d.user.role } : null))
      .catch(() => setUser(null));
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
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
  const mobileLinks = user?.role && user.role !== "student" ? [...links, { href: "/admin", label: t.nav.admin }] : links;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)] text-sm text-[var(--primary-fg)]">VT</span>
          <span className="hidden md:inline">{t.app.name}</span>
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
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            <span className="flex w-5 flex-col gap-1">
              <span className={cn("h-0.5 w-full rounded bg-current transition-transform", mobileOpen && "translate-y-1.5 rotate-45")} />
              <span className={cn("h-0.5 w-full rounded bg-current transition-opacity", mobileOpen && "opacity-0")} />
              <span className={cn("h-0.5 w-full rounded bg-current transition-transform", mobileOpen && "-translate-y-1.5 -rotate-45")} />
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={toggleDark}
            aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
          >
            <ThemeIcon dark={dark} />
          </Button>
          {user === undefined ? null : user ? (
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-sm" title={user.pseudo}>
                @{user.pseudo}
              </span>
              <Button variant="secondary" size="sm" onClick={logout}>
                {t.nav.logout}
              </Button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/register">
                <Button variant="secondary" size="sm">
                  {t.nav.register}
                </Button>
              </Link>
              <Link href="/login">
                <Button size="sm">{t.nav.login}</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
      {mobileOpen ? (
        <nav id="mobile-menu" aria-label="Navigation mobile" className="border-t border-[var(--border)] px-3 py-2 md:hidden">
          <div className="flex flex-col gap-1">
            {mobileLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm hover:bg-[var(--background)]",
                  pathname === l.href ? "font-semibold text-[var(--primary)]" : "text-foreground/80"
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="mt-2 space-y-1 border-t border-[var(--border)] pt-2">
            <Button variant="ghost" className="w-full justify-start" onClick={toggleDark}>
              <ThemeIcon dark={dark} />
              {dark ? "Mode clair" : "Mode sombre"}
            </Button>
            {user === undefined ? null : user ? (
              <>
                <p className="px-3 py-1 text-sm text-muted">@{user.pseudo}</p>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setMobileOpen(false);
                    void logout();
                  }}
                >
                  {t.nav.logout}
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full">{t.nav.login}</Button>
                </Link>
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  <Button variant="secondary" className="w-full">
                    {t.nav.register}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function ThemeIcon({ dark }: { dark: boolean }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dark ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
        </>
      ) : (
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      )}
    </svg>
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
