export const MIN_SAMPLE_SIZE = 5;
export const MAX_CONTRIBUTIONS_PER_DAY = 10;
export const PSEUDO_CHANGE_DAYS = 30;

export const FIXED_CENTER_NAME = "Almaviva Tunisie";
export const FIXED_VISA_TYPE = "etudiant_d";
export const FIXED_VISA_LABEL = "Visa étudiant (long séjour D)";

/** Session is not asked to students anymore; use the next September intake. */
export function defaultIntake(now = new Date()): string {
  const year = now.getUTCMonth() >= 8 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  return `${year}-09`;
}

export const MONTHS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
] as const;

export const PERIODS = [
  { value: "1mois", label: "Dernier mois", months: 1 },
  { value: "2mois", label: "2 mois", months: 2 },
  { value: "3mois", label: "3 mois", months: 3 },
  { value: "6mois", label: "6 mois", months: 6 },
  { value: "12mois", label: "12 mois", months: 12 },
] as const;

export const DEFAULT_PERIOD = "12mois";

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
export const STUDY_LEVELS = ["licence", "master"];
export const WAIT_BUCKETS: [string, number, number][] = [
  ["1-7", 1, 7],
  ["8-14", 8, 14],
  ["15-30", 15, 30],
  ["31-60", 31, 60],
  ["61+", 61, 100000],
];
