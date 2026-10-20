"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Input, Label, Select, Alert, Badge, SectionTitle } from "@/components/ui";
import { t } from "@/lib/i18n";

type Center = { id: number; name: string; visaCenterType: string; city: string | null };
type AppRecord = {
  id: string;
  centerId: number;
  visaType: string;
  intake: string;
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
  const [cohortSize, setCohortSize] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user === undefined || (user && appsQ === undefined)) {
    return <p className="text-muted">{t.generic.loading}</p>;
  }

  const centers = centersQ?.centers ?? [];
  const apps = appsQ?.applications ?? [];
  const activeApps = apps.filter((a) => a.status === "actif");

  async function createApp(form: { centerId: number; visaType: string; intake: string; studyLevel: string | null; fieldOfStudy: string | null }) {
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

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-extrabold">{t.contribute.title}</h1>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {done ? (
        <Alert tone="success">
          {t.contribute.success} — {done}.
          {cohortSize && cohortSize > 0
            ? ` Vous êtes ${cohortSize > 10 ? `l'un des ${cohortSize}` : `l'étudiant n° ${cohortSize}`} pour ce centre et cette session.`
            : ""}
        </Alert>
      ) : null}
      {warnings.map((w) => (
        <Alert key={w} tone="warn">
          {w}
        </Alert>
      ))}

      {selected ? (
        <Cards app={selected} centers={centers} onEvent={submitEvent} busy={busy} />
      ) : creating ? (
        <NewApplicationForm centers={centers} onCreate={createApp} busy={busy} />
      ) : (
        <div className="space-y-3">
          {activeApps.length > 0 ? (
            <Card>
              <SectionTitle hint={activeApps.length + " active(s)"}>Vos candidatures</SectionTitle>
              <div className="space-y-2">
                {activeApps.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm hover:bg-[var(--background)]"
                  >
                    <span>
                      <strong>{centers.find((c) => c.id === a.centerId)?.name ?? "?"}</strong> · {a.intake}
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
          <Button onClick={() => setCreating(true)} className="w-full">
            {t.contribute.newApplication}
          </Button>
        </div>
      )}
    </div>
  );
}

function NewApplicationForm({
  centers,
  onCreate,
  busy,
}: {
  centers: Center[];
  onCreate: (f: { centerId: number; visaType: string; intake: string; studyLevel: string | null; fieldOfStudy: string | null }) => void;
  busy: boolean;
}) {
  const [centerId, setCenterId] = useState<number | "">(centers[0]?.id ?? "");
  const [visaType, setVisaType] = useState("etudiant_d");
  const [intake, setIntake] = useState(`${new Date().getUTCFullYear() + 1}-09`);
  const [level, setLevel] = useState("");
  const [field, setField] = useState("");
  const intakes: string[] = [];
  const now = new Date();
  for (let y = now.getUTCFullYear(); y <= now.getUTCFullYear() + 2; y++) for (const m of ["01", "05", "09"] as const) intakes.push(`${y}-${m}`);

  return (
    <Card className="space-y-3">
      <SectionTitle>{t.contribute.contextTitle}</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="center">{t.contribute.center}</Label>
          <Select id="center" value={centerId} onChange={(e) => setCenterId(Number(e.target.value))}>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="visaType">{t.contribute.visaType}</Label>
          <Select id="visaType" value={visaType} onChange={(e) => setVisaType(e.target.value)}>
            <option value="etudiant_d">Visa étudiant (long séjour D, formation)</option>
            <option value="cours_langue">Cours de langue</option>
            <option value="autre">Autre</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="intake">{t.contribute.intake}</Label>
          <Select id="intake" value={intake} onChange={(e) => setIntake(e.target.value)}>
            {intakes.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="level" hint={t.generic.optional}>
            {t.contribute.studyLevel}
          </Label>
          <Select id="level" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">—</option>
            <option value="licence">Licence</option>
            <option value="master">Master</option>
            <option value="doctorat">Doctorat</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="field" hint={t.contribute.studyLevel + " · " + t.generic.optional}>
            Domaine (large, jamais précis)
          </Label>
          <Input id="field" maxLength={60} value={field} onChange={(e) => setField(e.target.value)} placeholder="ex. ingénierie, économie…" />
        </div>
      </div>
      <Button
        disabled={busy || centerId === "" || !centerId}
        onClick={() =>
          onCreate({
            centerId: Number(centerId),
            visaType,
            intake,
            studyLevel: level || null,
            fieldOfStudy: field || null,
          })
        }
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
  busy,
}: {
  app: AppRecord;
  centers: Center[];
  onEvent: (type: "rendez_vous" | "envoi_dossiers" | "reponse", fields: Record<string, string | null>) => void;
  busy: boolean;
}) {
  const [apptDate, setApptDate] = useState(app.appointmentDate ?? "");
  const [slot, setSlot] = useState("");
  const [bookedOn, setBookedOn] = useState("");
  const [docsDate, setDocsDate] = useState(app.docsSentDate ?? "");
  const [mode, setMode] = useState("");
  const [outcome, setOutcome] = useState<"accorde" | "refuse" | "">("");
  const [respDate, setRespDate] = useState(app.responseDate ?? "");
  const [rejectReason, setRejectReason] = useState("non_precise");
  const centerName = centers.find((c) => c.id === app.centerId)?.name ?? "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        <strong>{centerName}</strong> · {app.visaType} · {app.intake}
      </p>

      <Card className="space-y-3">
        <SectionTitle>📅 {t.contribute.cardAppointment}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="apptDate">{t.contribute.appointmentDate}</Label>
            <Input id="apptDate" type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="slot" hint={t.contribute.optional}>
              {t.contribute.slot}
            </Label>
            <Select id="slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
              <option value="">—</option>
              <option value="matin">Matin</option>
              <option value="apresmidi">Après-midi</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bookedOn" hint={t.contribute.optional + " — sert pour le calendrier des créneaux"}>
              {t.contribute.bookedOn}
            </Label>
            <Input id="bookedOn" type="date" value={bookedOn} onChange={(e) => setBookedOn(e.target.value)} />
          </div>
        </div>
        <Button
          disabled={busy || !apptDate}
          onClick={() =>
            onEvent("rendez_vous", {
              appointmentDate: apptDate || null,
              appointmentSlot: slot || null,
              slotBookedOn: bookedOn || null,
            })
          }
        >
          {t.contribute.submit}
        </Button>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>📮 {t.contribute.cardDocs}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="docsDate">{t.contribute.docsSentDate}</Label>
            <Input id="docsDate" type="date" value={docsDate} onChange={(e) => setDocsDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="mode" hint={t.contribute.optional}>
              {t.contribute.mode}
            </Label>
            <Select id="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="">—</option>
              <option value="centre">En personne au centre</option>
              <option value="courier">Courrier</option>
              <option value="en_ligne">En ligne</option>
            </Select>
          </div>
        </div>
        <Button disabled={busy || !docsDate} onClick={() => onEvent("envoi_dossiers", { docsSentDate: docsDate || null, docsSubmissionMode: mode || null })}>
          {t.contribute.submit}
        </Button>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>✅ {t.contribute.cardResponse}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
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
          <div>
            <Label htmlFor="rejectReason" hint={t.contribute.optional}>
              {t.contribute.rejectionReason}
            </Label>
            <Select id="rejectReason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} disabled={outcome !== "refuse"}>
              <option value="non_precise">Non précisé</option>
              <option value="documents_manquants">Documents manquants</option>
              <option value="preuve_financiere">Preuves financières</option>
              <option value="admission">Admission</option>
            </Select>
          </div>
        </div>
        <Button disabled={busy || outcome === "" || !respDate} onClick={() => onEvent("reponse", { outcome: outcome === "" ? null : outcome, responseDate: respDate || null, rejectionReason: outcome === "refuse" ? rejectReason : null })}>
          {t.contribute.submit}
        </Button>
      </Card>
    </div>
  );
}
