"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Input, Label, Select, Textarea, Alert, Badge, SectionTitle } from "@/components/ui";
import { FIXED_CENTER_NAME, FIXED_VISA_LABEL } from "@/lib/constants";
import { t } from "@/lib/i18n";

type Center = { id: number; name: string; visaCenterType: string; city: string | null };
type AppRecord = {
  id: string;
  centerId: number;
  visaType: string;
  intake: string;
  studyLevel: string | null;
  appointmentDate: string | null;
  docsSentDate: string | null;
  responseDate: string | null;
  outcome: string;
  status?: string;
};

export default function ContributePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ pseudo: string } | undefined>(undefined);
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user);
        if (!d.user) router.replace("/login");
      });
  }, [router]);

  const { data: centersQ } = useQuery<{ centers: Center[] }>({ queryKey: ["centers"], queryFn: () => fetch("/api/centers").then((r) => r.json()) });
  const { data: appsQ, refetch } = useQuery<{ applications: AppRecord[] }>({ queryKey: ["myApps"], queryFn: () => fetch("/api/me/applications").then((r) => r.json()) });

  const [selected, setSelected] = useState<AppRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cohortSize, setCohortSize] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (user === undefined || (user && appsQ === undefined)) {
    return <p className="text-muted">{t.generic.loading}</p>;
  }

  const centers = centersQ?.centers ?? [];
  const existingApps = appsQ?.applications ?? [];

  async function createApp(form: { studyLevel: "licence" | "master" }) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur");
      return;
    }
    setSelected(data.application);
    setCreating(false);
    void refetch();
  }

  async function submitEvent(type: "rendez_vous" | "envoi_dossiers" | "reponse", fields: Record<string, string | null>) {
    if (!selected) return;
    setBusy(true);
    setDone(null);
    setWarnings([]);
    setError(null);
    const res = await fetch(`/api/applications/${selected.id}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, ...fields }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur");
      return;
    }
    setWarnings(data.warnings ?? []);
    setDone(type === "reponse" ? "votre réponse" : type === "envoi_dossiers" ? "l'envoi du dossier" : "le rendez-vous");
    setCohortSize(typeof data.cohortSize === "number" ? data.cohortSize : null);
    void refetch();
  }

  async function deleteApplication() {
    if (!selected) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/applications/${selected.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirmDelete(false);
    if (!res.ok) {
      setError(data.error ?? "Suppression impossible.");
      return;
    }
    setSelected(null);
    setDone(null);
    setCohortSize(null);
    setNotice("Candidature supprimée. Vous pouvez en créer une nouvelle à tout moment.");
    void refetch();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-extrabold">{t.contribute.title}</h1>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {done ? (
        <Alert tone="success">
          {t.contribute.success} — {done}.
          {cohortSize && cohortSize > 0
            ? ` Vous êtes ${cohortSize > 10 ? `l'un des ${cohortSize}` : `l'étudiant n° ${cohortSize}`} pour ce centre.`
            : ""}
        </Alert>
      ) : null}
      {warnings.map((w) => (
        <Alert key={w} tone="warn">
          {w}
        </Alert>
      ))}

      {selected ? (
        <Cards
          app={selected}
          centers={centers}
          onEvent={submitEvent}
          onDelete={deleteApplication}
          confirmDelete={confirmDelete}
          busy={busy}
        />
      ) : creating ? (
        <NewApplicationForm onCreate={createApp} busy={busy} />
      ) : (
        <div className="space-y-3">
          {existingApps.length > 0 ? (
            <Card>
              <SectionTitle hint={t.contribute.modifyHint}>Votre candidature</SectionTitle>
              <div className="space-y-2">
                {existingApps.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setSelected(a);
                      setDone(null);
                      setNotice(null);
                      setConfirmDelete(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm hover:bg-[var(--background)]"
                  >
                    <span>
                      <strong>{centers.find((c) => c.id === a.centerId)?.name ?? "?"}</strong>
                    </span>
                    <span className="flex gap-1">
                      {a.appointmentDate ? <Badge color="primary">RDV</Badge> : null}
                      {a.docsSentDate ? <Badge color="success">Dossier</Badge> : null}
                      {a.responseDate ? <Badge>Réponse</Badge> : null}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          ) : null}
          {existingApps.length === 0 ? (
            <Button onClick={() => setCreating(true)} className="w-full">
              {t.contribute.newApplication}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function NewApplicationForm({
  onCreate,
  busy,
}: {
  onCreate: (f: { studyLevel: "licence" | "master" }) => void;
  busy: boolean;
}) {
  const [level, setLevel] = useState<"licence" | "master" | "">("");

  return (
    <Card className="space-y-3">
      <SectionTitle>{t.contribute.contextTitle}</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>{t.contribute.center}</Label>
          <Input readOnly value={FIXED_CENTER_NAME} className="bg-[var(--background)]" />
        </div>
        <div>
          <Label>{t.contribute.visaType}</Label>
          <Input readOnly value={FIXED_VISA_LABEL} className="bg-[var(--background)]" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="level">{t.contribute.studyLevel}</Label>
          <Select
            id="level"
            value={level}
            onChange={(e) => setLevel(e.target.value as "licence" | "master" | "")}
            required
          >
            <option value="">Sélectionner…</option>
            <option value="licence">Licence</option>
            <option value="master">Master</option>
          </Select>
        </div>
        <p className="text-xs text-muted sm:col-span-2">{t.contribute.fixedHint}</p>
      </div>
      <Button
        disabled={busy || level === ""}
        onClick={() => {
          if (level) onCreate({ studyLevel: level });
        }}
      >
        {t.contribute.submit}
      </Button>
    </Card>
  );
}

function Cards({
  app,
  centers,
  onEvent,
  onDelete,
  confirmDelete,
  busy,
}: {
  app: AppRecord;
  centers: Center[];
  onEvent: (type: "rendez_vous" | "envoi_dossiers" | "reponse", fields: Record<string, string | null>) => void;
  onDelete: () => void;
  confirmDelete: boolean;
  busy: boolean;
}) {
  const [apptDate, setApptDate] = useState(app.appointmentDate ?? "");
  const [docsDate, setDocsDate] = useState(app.docsSentDate ?? "");
  const [outcome, setOutcome] = useState<"accorde" | "refuse" | "">("");
  const [respDate, setRespDate] = useState(app.responseDate ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const centerName = centers.find((c) => c.id === app.centerId)?.name ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          <strong>{centerName}</strong> — {FIXED_VISA_LABEL}
          {app.studyLevel === "master" ? " — Master" : app.studyLevel === "licence" ? " — Licence" : ""}
        </p>
        <Button variant="danger" size="sm" disabled={busy} onClick={onDelete}>
          {confirmDelete ? t.generic.requiredConfirm : t.contribute.delete}
        </Button>
      </div>

      <Card className="space-y-3">
        <SectionTitle>📅 {t.contribute.cardAppointment}</SectionTitle>
        <div>
          <Label htmlFor="apptDate">{t.contribute.appointmentDate}</Label>
          <Input id="apptDate" type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
        </div>
        <Button
          disabled={busy || !apptDate}
          onClick={() => onEvent("rendez_vous", { appointmentDate: apptDate || null })}
        >
          {t.contribute.submit}
        </Button>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>📮 {t.contribute.cardDocs}</SectionTitle>
        <div>
          <Label htmlFor="docsDate">{t.contribute.docsSentDate}</Label>
          <Input id="docsDate" type="date" value={docsDate} onChange={(e) => setDocsDate(e.target.value)} />
        </div>
        <Button disabled={busy || !docsDate} onClick={() => onEvent("envoi_dossiers", { docsSentDate: docsDate || null })}>
          {t.contribute.submit}
        </Button>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>✅ {t.contribute.cardResponse}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="outcome">{t.contribute.outcome}</Label>
            <Select id="outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as "accorde" | "refuse" | "")}>
              <option value="">—</option>
              <option value="accorde">Visa accordé 🎉</option>
              <option value="refuse">Refusé</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="respDate">{t.contribute.responseDate}</Label>
            <Input id="respDate" type="date" value={respDate} onChange={(e) => setRespDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="rejectReason" hint={t.contribute.optional}>
            {t.contribute.rejectionReason}
          </Label>
          <Textarea
            id="rejectReason"
            rows={3}
            maxLength={300}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            disabled={outcome !== "refuse"}
            placeholder={t.contribute.rejectionPlaceholder}
          />
        </div>
        <Button disabled={busy || outcome === "" || !respDate} onClick={() => onEvent("reponse", { outcome: outcome === "" ? null : outcome, responseDate: respDate || null, rejectionReason: outcome === "refuse" ? rejectReason.trim() || null : null })}>
          {t.contribute.submit}
        </Button>
      </Card>
    </div>
  );
}
