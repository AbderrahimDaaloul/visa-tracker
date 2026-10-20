import { dayDiff, todayStr } from "@/lib/stats/compute";

export type ContributionFields = {
  appointmentDate?: string | null;
  appointmentSlot?: string | null;
  slotBookedOn?: string | null;
  docsSentDate?: string | null;
  docsSubmissionMode?: string | null;
  outcome?: string | null;
  responseDate?: string | null;
  rejectionReason?: string | null;
};

function bad(message: string): never {
  throw new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a contribution/edit and returns the patch for the application row. */
export function applyContribution(
  current: { appointmentDate: string | null; docsSentDate: string | null; responseDate: string | null; outcome: string },
  fields: ContributionFields
): { updates: Record<string, string | null>; warnings: string[] } {
  const warnings: string[] = [];
  const next: Record<string, string | null> = {
    appointmentDate: fields.appointmentDate !== undefined ? fields.appointmentDate : current.appointmentDate,
    docsSentDate: fields.docsSentDate !== undefined ? fields.docsSentDate : current.docsSentDate,
    responseDate: fields.responseDate !== undefined ? fields.responseDate : current.responseDate,
    outcome: fields.outcome !== undefined ? fields.outcome : current.outcome,
  };
  const today = todayStr();

  if (fields.appointmentDate !== undefined && fields.appointmentDate !== null) {
    if (!isoDate.test(fields.appointmentDate)) bad("Date invalide.");
    const diff = dayDiff(fields.appointmentDate, today);
    if (diff < -548 || diff > 365) bad("La date de rendez-vous doit être comprise entre aujourd'hui -18 mois et +12 mois.");
  }
  if (fields.slotBookedOn !== undefined && fields.slotBookedOn !== null && fields.appointmentDate) {
    if (dayDiff(fields.appointmentDate, fields.slotBookedOn) < 0) {
      warnings.push("La date de réservation semble postérieure au rendez-vous — vérifiez cette date.");
    }
  }
  if (fields.docsSentDate !== undefined && fields.docsSentDate !== null) {
    if (!isoDate.test(fields.docsSentDate)) bad("Date invalide.");
    if (dayDiff(today, fields.docsSentDate) < 0) bad("La date d'envoi des documents ne peut pas être dans le futur.");
  }
  if (fields.responseDate !== undefined && fields.responseDate !== null) {
    if (!isoDate.test(fields.responseDate)) bad("Date invalide.");
    if (dayDiff(today, fields.responseDate) < 0) bad("La date de réponse ne peut pas être dans le futur.");
    const docs = next.docsSentDate;
    if (docs && dayDiff(fields.responseDate, docs) < 0) {
      bad("La date de réponse doit être postérieure à la date d'envoi des documents.");
    }
    const appt = next.appointmentDate;
    if (appt && dayDiff(fields.responseDate, appt) < 0) {
      bad("La date de réponse doit être postérieure à la date du rendez-vous.");
    }
  }
  if (fields.outcome !== undefined && !["accorde", "refuse", "en_attente", null].includes(fields.outcome)) {
    bad("Résultat invalide.");
  }
  if (fields.rejectionReason !== undefined && fields.rejectionReason !== null && next.outcome !== "refuse") {
    bad("La raison du refus n'est possible que pour un refus.");
  }
  if (next.outcome === "refuse" && fields.responseDate) {
    warnings.push("Merci de préciser la catégorie de refus si vous la connaissez.");
  }
  if (next.docsSentDate && next.responseDate && dayDiff(next.responseDate, next.docsSentDate) > 120) {
    warnings.push("Plus de 120 jours d'attente — êtes-vous sûr·e ? La donnée sera enregistrée.");
  }

  const updates: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(next)) {
    if (fields[k as keyof ContributionFields] !== undefined) updates[k] = v;
  }
  if (fields.appointmentSlot !== undefined) updates.appointmentSlot = fields.appointmentSlot;
  if (fields.slotBookedOn !== undefined) updates.slotBookedOn = fields.slotBookedOn;
  if (fields.docsSubmissionMode !== undefined) updates.docsSubmissionMode = fields.docsSubmissionMode;
  if (fields.rejectionReason !== undefined) updates.rejectionReason = fields.rejectionReason;
  return { updates, warnings };
}
