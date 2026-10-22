"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth";
import { Alert, Button, Input, Label, Skeleton } from "@/components/ui";
import { t } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [accountEmail, setAccountEmail] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/me")
      .then((res) => res.json())
      .then((data: { user?: { email?: string } | null }) => {
        if (active) setAccountEmail(data.user?.email ?? null);
      })
      .catch(() => {
        if (active) setAccountEmail(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const connected = Boolean(accountEmail);
  const loading = accountEmail === undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(connected ? {} : { email }),
      });
      const data = (await res.json()) as { error?: string; devResetUrl?: string | null };
      if (!res.ok) {
        setError(data.error ?? t.generic.error);
        return;
      }
      setDevResetUrl(data.devResetUrl ?? null);
      setSent(true);
    } catch {
      setError(t.generic.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={connected ? t.auth.changePasswordTitle : t.auth.forgotTitle}
      subtitle={connected ? t.auth.changePasswordSubtitle : t.auth.forgotSubtitle}
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {sent ? <Alert tone="success">{connected ? t.auth.resetSentConnected : t.auth.resetSent}</Alert> : null}
      {devResetUrl ? (
        <Alert tone="warn">
          {t.auth.devResetLink} :{" "}
          <a href={devResetUrl} className="font-semibold text-[var(--primary)] underline">
            {t.auth.resetTitle}
          </a>
        </Alert>
      ) : null}
      <form className="space-y-3" onSubmit={submit}>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : connected ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-xs text-muted">{t.auth.connectedEmail}</p>
            <p className="mt-1 text-sm font-semibold">{accountEmail}</p>
          </div>
        ) : (
          <div>
            <Label htmlFor="email">{t.auth.emailLabel}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t.auth.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy || loading || (!connected && !email)}>
          {connected ? t.auth.sendResetToAccount : t.auth.sendReset}
        </Button>
      </form>
      <p className="text-center text-xs">
        <Link href="/login" className="text-[var(--primary)] hover:underline">
          {t.auth.backToLogin}
        </Link>
      </p>
    </AuthShell>
  );
}
