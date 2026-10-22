"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input, Label, SectionTitle } from "@/components/ui";
import { t } from "@/lib/i18n";

export default function SettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pseudo, setPseudo] = useState("");
  const [showPseudo, setShowPseudo] = useState(false);
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setReady(true);
        if (!d.user) {
          router.replace("/login");
          return;
        }
        setPseudo(d.user.pseudo);
        setShowPseudo(d.user.showPseudoInCohorts);
        setEmail(d.user.email ?? "");
      });
  }, [router]);

  async function save() {
    setError(null);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pseudo, showPseudoInCohorts: showPseudo }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erreur");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function sendPasswordReset() {
    setResetBusy(true);
    setResetError(null);
    setResetSent(false);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setResetError(data.error ?? t.generic.error);
        return;
      }
      setResetSent(true);
    } catch {
      setResetError(t.generic.error);
    } finally {
      setResetBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-extrabold">{t.settings.title}</h1>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {saved ? <p className="text-sm text-[var(--success)]">{t.settings.saved}</p> : null}
      <Card className="space-y-4">
        <div>
          <Label htmlFor="pseudo">{t.settings.pseudo}</Label>
          <Input id="pseudo" value={pseudo} maxLength={20} onChange={(e) => setPseudo(e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t.settings.visibility}</p>
            <p className="text-xs text-muted">{t.settings.visibilityHint}</p>
          </div>
          <input type="checkbox" checked={showPseudo} onChange={(e) => setShowPseudo(e.target.checked)} className="h-5 w-5" />
        </div>
        <Button onClick={save}>{t.contribute.submit}</Button>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>{t.settings.password}</SectionTitle>
        <p className="text-sm text-muted">{t.settings.passwordHint}</p>
        <p className="text-xs text-muted">
          Adresse : <strong>{email || "…"}</strong>
        </p>
        {resetError ? <Alert tone="error">{resetError}</Alert> : null}
        {resetSent ? <Alert tone="success">{t.settings.resetLinkSent}</Alert> : null}
        <Button variant="secondary" onClick={sendPasswordReset} disabled={resetBusy || !email}>
          {t.settings.sendResetLink}
        </Button>
      </Card>
    </div>
  );
}
