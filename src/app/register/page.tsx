"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell, GoogleButton } from "@/components/auth";
import { Alert, Button, Input, Label } from "@/components/ui";
import { t } from "@/lib/i18n";

export default function RegisterPage() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pseudo, email, password }),
      });
      const data = (await res.json()) as { error?: string; devUrl?: string | null };
      if (!res.ok) {
        setError(data.error ?? t.generic.error);
        return;
      }
      if (data.devUrl) {
        try {
          sessionStorage.setItem("vtt-verify-url", data.devUrl);
        } catch {
          /* ignore */
        }
      }
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
      router.refresh();
    } catch {
      setError(t.generic.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t.auth.registerTitle} subtitle={t.auth.registerSubtitle}>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <Label htmlFor="pseudo">{t.auth.pseudoLabel}</Label>
          <Input
            id="pseudo"
            autoComplete="username"
            placeholder={t.auth.pseudoPlaceholder}
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            minLength={3}
            maxLength={20}
            required
          />
        </div>
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
        <div>
          <Label htmlFor="password" hint={t.auth.passwordHint}>
            {t.auth.passwordLabel}
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder={t.auth.passwordPlaceholder}
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
        <Button type="submit" className="w-full" disabled={busy || !pseudo || !email || !password || !confirmPassword}>
          {t.auth.register}
        </Button>
      </form>
      <GoogleButton label={t.auth.google} dividerLabel={t.auth.or} />
      <p className="text-center text-xs text-muted">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
          {t.auth.login}
        </Link>
      </p>
    </AuthShell>
  );
}
