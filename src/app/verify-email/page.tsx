"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth";
import { Alert, Button, Input, Label, Skeleton } from "@/components/ui";
import { t } from "@/lib/i18n";

type VerifyStatus = "verifying" | "success" | "error";

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const queryEmail = params.get("email") ?? "";
  const [email, setEmail] = useState(queryEmail);
  const [status, setStatus] = useState<VerifyStatus | null>(token ? "verifying" : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      try {
        setDevUrl(sessionStorage.getItem("vtt-verify-url"));
        sessionStorage.removeItem("vtt-verify-url");
      } catch {
        /* ignore */
      }
      return;
    }

    let active = true;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { error?: string };
        if (!active) return;
        if (!res.ok) {
          setStatus("error");
          setError(data.error ?? t.auth.verifyEmailError);
          return;
        }
        setStatus("success");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
        setError(t.generic.error);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string; devUrl?: string | null };
      if (!res.ok) {
        setError(data.error ?? t.generic.error);
        return;
      }
      setDevUrl(data.devUrl ?? null);
      setSent(true);
    } catch {
      setError(t.generic.error);
    } finally {
      setBusy(false);
    }
  }

  if (token) {
    return (
      <AuthShell title={t.auth.verifyEmailTitle} subtitle={t.auth.verifyEmailSubtitle}>
        {status === "verifying" ? <Alert>{t.auth.verifyEmailVerifying}</Alert> : null}
        {status === "success" ? (
          <>
            <Alert tone="success">{t.auth.verifyEmailSuccess}</Alert>
            <Link href="/login">
              <Button className="w-full">{t.auth.login}</Button>
            </Link>
          </>
        ) : null}
        {status === "error" ? (
          <>
            <Alert tone="error">{error ?? t.auth.verifyEmailError}</Alert>
            <Link href="/verify-email" className="block text-center text-xs text-[var(--primary)] hover:underline">
              {t.auth.resendVerification}
            </Link>
          </>
        ) : null}
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t.auth.verifyEmailTitle} subtitle={t.auth.verifyEmailSubtitle}>
      {sent ? <Alert tone="success">{t.auth.resendVerificationSent}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {devUrl ? (
        <Alert tone="warn">
          {t.auth.devVerifyLink} :{" "}
          <a href={devUrl} className="font-semibold text-[var(--primary)] underline">
            {t.auth.verifyEmailTitle}
          </a>
        </Alert>
      ) : null}
      <form className="space-y-3" onSubmit={resend}>
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
        <Button type="submit" className="w-full" disabled={busy || !email}>
          {t.auth.resendVerification}
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

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-sm py-10">
          <Skeleton className="h-72 w-full" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
