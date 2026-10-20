"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, SectionTitle } from "@/components/ui";
import { t } from "@/lib/i18n";

export default function SettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pseudo, setPseudo] = useState("");
  const [showPseudo, setShowPseudo] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [cohortUpdates, setCohortUpdates] = useState(true);
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [keep, setKeep] = useState(false);

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
      body: JSON.stringify({ pseudo, showPseudoInCohorts: showPseudo, reminders, cohortUpdates }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erreur");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function deleteAccount() {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    await fetch("/api/me", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keepContributions: keep }),
    });
    router.push("/");
    router.refresh();
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t.settings.reminders}</p>
            <p className="text-xs text-muted">Email (si RESEND_API_KEY configuré)</p>
          </div>
          <input type="checkbox" checked={reminders} onChange={(e) => setReminders(e.target.checked)} className="h-5 w-5" />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t.settings.cohortUpdates}</p>
          <input type="checkbox" checked={cohortUpdates} onChange={(e) => setCohortUpdates(e.target.checked)} className="h-5 w-5" />
        </div>
        <Button onClick={save}>{t.contribute.submit}</Button>
      </Card>

      <Card>
        <SectionTitle>Compte</SectionTitle>
        <p className="text-sm">
          Email vérifié : <strong>{email || "—"}</strong>
        </p>
        <p className="mt-4 text-sm">{t.settings.deleteHint}</p>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <input id="keep" type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          <label htmlFor="keep">{t.settings.keepContributions}</label>
        </div>
        <Button variant="danger" className="mt-3" onClick={deleteAccount}>
          {confirmDel ? t.generic.requiredConfirm : t.settings.deleteAccount}
        </Button>
      </Card>
    </div>
  );
}
