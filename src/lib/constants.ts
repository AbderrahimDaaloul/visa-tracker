export const MIN_SAMPLE_SIZE = 5;
export const MAX_ACTIVE_APPLICATIONS = 3;
export const MAX_CONTRIBUTIONS_PER_DAY = 10;
export const PSEUDO_CHANGE_DAYS = 30;

export const DISPOSABLE_DOMAINS = new Set([
  "yopmail.com", "mailinator.com", "tempmail.com", "temp-mail.org", "10minutemail.com",
  "guerrillamail.com", "trashmail.com", "dropmail.me", "getnada.com", "dispostable.com",
  "maildrop.cc", "throwawaymail.com", "fakeinbox.com", "mailnesia.com", "mohmal.com",
]);

export const VISIT_TYPES_FR = [
  { value: "etudiant_d", label: "Visa étudiant (long séjour D, formation)" },
  { value: "cours_langue", label: "Visa pour cours de langue" },
  { value: "autre", label: "Autre type de visa" },
];

export const VISA_TYPES_JSON = ["etudiant_d", "cours_langue", "autre"];
export const DOC_MODES = ["centre", "courier", "en_ligne"];
export const REJECTION_REASONS = [
  { value: "documents_manquants", label: "Documents manquants" },
  { value: "preuve_financiere", label: "Preuves financières insuffisantes" },
  { value: "admission", label: "Problème d'admission" },
  { value: "non_precise", label: "Non précisé" },
];
export const STUDY_LEVELS = ["licence", "master", "doctorat"];
export const WAIT_BUCKETS: [string, number, number][] = [
  ["1-7", 1, 7],
  ["8-14", 8, 14],
  ["15-30", 15, 30],
  ["31-60", 31, 60],
  ["61+", 61, 100000],
];
