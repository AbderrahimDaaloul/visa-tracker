"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, Alert } from "@/components/ui";
import { t } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code" | "pseudo">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur");
      return;
    }
    setDevCode(data.devCode ?? null);
    setStep("code");
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code, pseudo: step === "pseudo" ? pseudo : undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur");
      return;
    }
    if (data.needsPseudo) {
      setStep("pseudo");
      return;
    }
    router.push("/journey");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <Card className="space-y-4">
        <div>
          <h1 className="text-xl font-extrabold">{t.auth.title}</h1>
          <p className="mt-1 text-xs text-muted">{t.auth.pseudonymous}</p>
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {step === "email" && (
          <div className="space-y-3">
            <Label htmlFor="email">{t.auth.emailLabel}</Label>
            <Input id="email" type="email" placeholder={t.auth.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button className="w-full" disabled={busy || !email} onClick={requestOtp}>
              {t.auth.sendCode}
            </Button>
          </div>
        )}
        {step === "code" && (
          <div className="space-y-3">
            {devCode ? (
              <Alert tone="warn">
                Mode développement : pas de clé RESEND_API_KEY configurée. Votre code est <strong className="font-mono">{devCode}</strong> (aussi visible dans la console du serveur).
              </Alert>
            ) : (
              <Alert tone="success">Un code à 6 chiffres a été envoyé à {email}. Il expire dans 15 minutes.</Alert>
            )}
            <Label htmlFor="code">{t.auth.codeLabel}</Label>
            <Input
              id="code"
              inputMode="numeric"
              maxLength={6}
              className="font-mono text-xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <Button className="w-full" disabled={busy || code.length !== 6} onClick={verify}>
              {t.auth.verify}
            </Button>
            <Button variant="secondary" size="sm" className="w-full" onClick={requestOtp}>
              {t.auth.resend}
            </Button>
          </div>
        )}
        {step === "pseudo" && (
          <div className="space-y-3">
            <p className="text-sm">{t.auth.noAccount}</p>
            <Label htmlFor="pseudo">{t.auth.pseudoLabel}</Label>
            <Input id="pseudo" placeholder={t.auth.pseudoPlaceholder} value={pseudo} onChange={(e) => setPseudo(e.target.value)} />
            <Button className="w-full" disabled={busy || pseudo.length < 3} onClick={verify}>
              {t.auth.verify}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
