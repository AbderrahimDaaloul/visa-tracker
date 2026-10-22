"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth";
import { Alert, Button, Input, Label, Skeleton } from "@/components/ui";
import { t } from "@/lib/i18n";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t.generic.error);
        return;
      }
      router.push("/login?reset=1");
      router.refresh();
    } catch {
      setError(t.generic.error);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title={t.auth.resetTitle} subtitle={t.auth.resetSubtitle}>
        <Alert tone="error">{t.auth.invalidResetLink}</Alert>
        <p className="text-center text-xs">
          <Link href="/forgot-password" className="text-[var(--primary)] hover:underline">
            {t.auth.sendReset}
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t.auth.resetTitle} subtitle={t.auth.resetSubtitle}>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <Label htmlFor="password" hint={t.auth.passwordHint}>
            {t.auth.newPassword}
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div>
          <Label htmlFor="confirm-password">{t.auth.confirmPasswordLabel}</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy || !password || !confirmPassword}>
          {t.auth.updatePassword}
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-sm py-10">
          <Skeleton className="h-72 w-full" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
