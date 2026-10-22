"use client";

import { useEffect, useState, type ReactNode } from "react";
import { buttonVariants, Card, cn } from "./ui";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm py-10">
      <Card className="space-y-4">
        <div>
          <h1 className="text-xl font-extrabold">{title}</h1>
          <p className="mt-1 text-xs text-muted">{subtitle}</p>
        </div>
        {children}
      </Card>
    </div>
  );
}

export function GoogleButton({ label, dividerLabel }: { label: string; dividerLabel: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((res) => res.json())
      .then((data: { google?: boolean }) => setEnabled(Boolean(data.google)))
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) return null;

  return (
    <>
      <OrDivider label={dividerLabel} />
      <a href="/api/auth/google/start" className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] text-[11px] font-bold">
          G
        </span>
        {label}
      </a>
    </>
  );
}

export function OrDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-[var(--border)]" />
      {label}
      <span className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}
