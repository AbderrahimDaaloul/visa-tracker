"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, GoogleButton } from "@/components/auth";
import { Alert, Button, Input, Label, Skeleton } from "@/components/ui";
import { t } from "@/lib/i18n";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);

  const queryError = params.get("error");
  const knownErrors = t.auth.errors as Record<string, string>;
  const message = error ?? (queryError ? knownErrors[queryError] ?? t.generic.error : null);
  const resetDone = params.get("reset") === "1";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) {
        setError(data.error ?? t.generic.error);
        setVerifyEmail(data.code === "email_not_verified" ? email.trim() : null);
        return;
      }
      setVerifyEmail(null);
      router.push("/journey");
      router.refresh();
    } catch {
      setError(t.generic.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle}>
      {resetDone ? <Alert tone="success">{t.auth.resetDone}</Alert> : null}
      {message ? <Alert tone="error">{message}</Alert> : null}
      {verifyEmail ? (
        <p className="text-center text-xs">
          <Link
            href={`/verify-email?email=${encodeURIComponent(verifyEmail)}`}
            className="font-semibold text-[var(--primary)] hover:underline"
          >
            {t.auth.verifyEmailAction}
          </Link>
        </p>
      ) : null}
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <Label htmlFor="email">{t.auth.emailLabel}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t.auth.emailPlaceholder}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setVerifyEmail(null);
            }}
            required
          />
        </div>
        <div>
          <Label htmlFor="password">{t.auth.passwordLabel}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder={t.auth.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy || !email || !password}>
          {t.auth.login}
        </Button>
      </form>
      <GoogleButton label={t.auth.google} dividerLabel={t.auth.or} />
      <div className="flex flex-col gap-2 text-center text-xs">
        <Link href="/forgot-password" className="text-[var(--primary)] hover:underline">
          {t.auth.forgot}
        </Link>
        <span className="text-muted">
          {t.auth.noAccount}{" "}
          <Link href="/register" className="font-semibold text-[var(--primary)] hover:underline">
            {t.auth.createAccount}
          </Link>
        </span>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-sm py-10">
          <Skeleton className="h-72 w-full" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
