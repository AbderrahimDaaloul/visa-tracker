import { describe, expect, it } from "vitest";
import {
  dayDiff,
  computedStage,
  c9Survival,
  c18ApprovedByLevel,
  c20LifecycleTimeline,
  c21LifecycleDaily,
  c11CohortDaily,
  currentWaitOf,
  isoWeekOf,
  medianW,
  parseMonth,
  percentile,
  sortAsc,
  todayStr,
  tukeyTrim,
  waitOf,
  weeksSince,
} from "./compute";
import type { BaseRow } from "./base";
import { envelope } from "./base";

function row(partial: Partial<BaseRow>): BaseRow {
  return {
    centerId: 1,
    visaType: "etudiant_d",
    intake: "2026-09",
    studyLevel: null,
    docsSent: null,
    appointment: null,
    bookedOn: null,
    slot: null,
    response: null,
    outcome: "en_attente",
    rejectionReason: null,
    createdAt: "2025-06-01",
    ...partial,
  };
}

describe("sortAsc", () => {
  it("trie sans muter ET gère les tableaux vides", () => {
    const input = [3, 1, 2];
    const out = sortAsc(input);
    expect(out).toEqual([1, 2, 3]);
    expect(input).toEqual([3, 1, 2]);
    expect(sortAsc([])).toEqual([]);
  });
});

describe("percentile", () => {
  it("renvoie 0 sur tableau vide", () => {
    expect(percentile([], 0.5)).toBe(0);
  });

  it("renvoie l'élément unique quel que soit p", () => {
    expect(percentile([7], 0.25)).toBe(7);
    expect(percentile([7], 0.9)).toBe(7);
  });

  it("interpole linéairement entre deux valeurs", () => {
    // median de [10,20] = 15 (linear interpolation, n=2)
    expect(percentile([10, 20], 0.5)).toBe(15);
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
  });

  it("bornes exactes p=0 et p=1 sur tableau trié", () => {
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4, 5], 1)).toBe(5);
  });
});

describe("medianW", () => {
  it("médiane standard sur valeurs impaires", () => {
    expect(medianW([30, 10, 20])).toBe(20);
  });
  it("moyenne des deux milieux sur valeurs paires", () => {
    expect(medianW([40, 10, 20, 30])).toBe(25);
  });
});

describe("tukeyTrim", () => {
  it("ne filtre pas si < 8 valeurs", () => {
    const v = [1, 2, 3, 4, 5, 10000, 7, 8];
    v.splice(7); // 7 valeurs
    expect(tukeyTrim(v)).toHaveLength(7);
  });

  it("garde tout pour une distribution normale", () => {
    const v = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(tukeyTrim(v)).toEqual(v);
  });

  it("élimine les valeurs extrêmes (uplicates de IQR x3)", () => {
    // valeurs 1..12 + une valeur astronomique
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 99999];
    const trimmed = tukeyTrim(v);
    expect(trimmed).not.toContain(99999);
    expect(trimmed.length).toBeLessThan(v.length);
  });

  it("préserve les valeurs intermédiaires", () => {
    const v = [5, 5, 6, 6, 7, 7, 8, 8, 100];
    const trimmed = tukeyTrim(v);
    expect(trimmed).toEqual([5, 5, 6, 6, 7, 7, 8, 8]);
  });
});

describe("dayDiff / todayStr / parseMonth / weeksSince", () => {
  it("dayDiff (pour-pour-quoi)", () => {
    // dayDiff(a, b) = a - b en jours
    expect(dayDiff("2026-01-10", "2026-01-01")).toBe(9);
    expect(dayDiff("2026-01-01", "2026-01-10")).toBe(-9);
    expect(dayDiff("2026-01-10", "2026-01-10")).toBe(0);
  });

  it("todayStr renvoie le format ISO local", () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parseMonth extrait AAAA-MM", () => {
    expect(parseMonth("2026-03-15")).toBe("2026-03");
  });

  it("weeksSince calcule des semaines écoulées (valeur cohérente avec la date du jour)", () => {
    const w = weeksSince("2026-01-01");
    // ~41-42 semaines entre le 2026-01-01 et aujourd'hui (2026-10-20)
    expect(w).toBeGreaterThanOrEqual(40);
    expect(w).toBeLessThanOrEqual(43);
  });
});

describe("isoWeekOf", () => {
  it("renvoie AAAA-Ssem padée", () => {
    expect(isoWeekOf("2026-01-01")).toMatch(/-W\d{2}$/);
  });
  it("1er janvier 2026 = semaine 01 de 2026", () => {
    expect(isoWeekOf("2026-01-01")).toBe("2026-W01");
  });
  it("dated mercredi/jeudi 2026-06-17 = semaine 25", () => {
    // 2026-06-17 est un mercredi : semaine ISO 25
    expect(isoWeekOf("2026-06-17")).toBe("2026-W25");
  });
  it("les derniers jours de décembre peuvent tomber sur l'année suivante (S1)", () => {
    expect(isoWeekOf("2029-12-31")).toBe("2030-W01");
  });
});

describe("waitOf / currentWaitOf", () => {
  it("waitOf null sans dates", () => {
    expect(waitOf(row({}))).toBeNull();
  });

  it("waitOf préfère docs_sent_date (basis documents)", () => {
    const w = waitOf(row({ docsSent: "2026-01-01", response: "2026-02-01", appointment: "2026-01-05" }));
    expect(w).toEqual({ days: 31, basis: "documents" });
  });

  it("waitOf retombe sur rendez_vous sans docs_sent", () => {
    const w = waitOf(row({ appointment: "2026-01-01", response: "2026-02-01" }));
    expect(w?.basis).toBe("rendezvous");
  });

  it("currentWaitOf calcule l'attente en cours même sans réponse (base docs)", () => {
    const past = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const w = currentWaitOf(row({ docsSent: past }));
    expect(w?.basis).toBe("documents");
    expect(w!.days).toBeGreaterThanOrEqual(10 - 1);
  });
});

describe("computedStage", () => {
  it("inscrit sans aucune date", () => {
    expect(computedStage(row({}))).toBe("inscrit");
  });
  it("reste inscrit avec un RDV mais sans dossier envoyé", () => {
    expect(computedStage(row({ appointment: "2026-01-01" }))).toBe("inscrit");
  });
  it("soumis dès que le dossier est envoyé, même avec un RDV", () => {
    expect(computedStage(row({ docsSent: "2026-01-01", response: null, appointment: "2026-01-05" }))).toBe("soumis");
  });
  it("reponse avec reponse", () => {
    expect(computedStage(row({ docsSent: "2026-01-01", response: "2026-02-01", outcome: "accorde" }))).toBe("reponse");
  });
});

describe("c9Survival (Kaplan-Meier)", () => {
  const rows: BaseRow[] = [
    // 2 répondus au jour 10 (sur 5 à risque), 1 censuré au jour 12, etc.
    row({ docsSent: "2025-01-01", response: "2025-01-11" }), // d=10, repondu
    row({ docsSent: "2025-01-02", response: "2025-01-13" }), // d=11, repondu
    row({ docsSent: "2025-01-03", response: "2025-01-14" }), // d=11, repondu
    row({ docsSent: "2025-01-04", response: "2025-02-14" }), // d=41, repondu
    row({ docsSent: "2025-01-05", response: null }), // en cours
  ];

  it("calcule des étapes croissantes décroissantes", () => {
    const { steps } = c9Survival(rows);
    expect(steps.length).toBeGreaterThan(0);
    // s décroît ou reste identique
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].s).toBeLessThanOrEqual(steps[i - 1].s);
    }
    // première étape = jour minimal avec un événement
    expect(steps[0].t).toBe(10);
    // au jour 10 : 1 réponse sur 5 à risque (4 répondus + 1 encours censuré)
    expect(steps[0].ended).toBe(1);
    expect(steps[0].atRisk).toBe(5);
  });

  it("s varie entre 0 et 1", () => {
    const { steps } = c9Survival(rows);
    for (const st of steps) {
      expect(st.s).toBeGreaterThanOrEqual(0);
      expect(st.s).toBeLessThanOrEqual(1);
    }
  });

  it("aucune étape au-delà de 150 jours", () => {
    const { steps } = c9Survival(rows);
    for (const st of steps) expect(st.t).toBeLessThanOrEqual(150);
  });

  it("renvoie aucune étape sans réponses", () => {
    expect(c9Survival([row({ docsSent: "2025-01-01", response: null })]).steps).toEqual([]);
  });
});

describe("c20LifecycleTimeline", () => {
  it("compte chaque étape par mois et par niveau", () => {
    const rows = [
      row({ studyLevel: "master", createdAt: "2026-06-01", docsSent: "2026-07-01", response: "2026-08-01", outcome: "accorde" }),
      row({ studyLevel: "licence", createdAt: "2026-06-15", docsSent: "2026-07-10", response: "2026-08-05", outcome: "refuse" }),
      row({ studyLevel: null, createdAt: "2026-06-20" }),
    ];
    const out = c20LifecycleTimeline(rows);
    expect(out.months).toEqual(["2026-06", "2026-07", "2026-08"]);
    const master = out.series.find((s) => s.level === "master")!;
    const licence = out.series.find((s) => s.level === "licence")!;
    expect(master.demande).toEqual([1, 0, 0]);
    expect(master.envoi).toEqual([0, 1, 0]);
    expect(master.reponse).toEqual([0, 0, 1]);
    expect(licence.demande).toEqual([1, 0, 0]);
    expect(licence.envoi).toEqual([0, 1, 0]);
    expect(licence.reponse).toEqual([0, 0, 1]);
  });
});

describe("c18ApprovedByLevel", () => {
  it("ne compte que les visas accordés", () => {
    const out = c18ApprovedByLevel([
      row({ studyLevel: "master", outcome: "accorde" }),
      row({ studyLevel: "master", outcome: "refuse" }),
      row({ studyLevel: "licence", outcome: "accorde" }),
    ]);
    expect(out.levels).toEqual([
      { level: "master", count: 1 },
      { level: "licence", count: 1 },
    ]);
  });
});

describe("c21LifecycleDaily", () => {
  it("ventile les trois étapes par jour et par niveau", () => {
    const rows = [
      row({ studyLevel: "master", createdAt: "2026-09-01", docsSent: "2026-09-10", response: "2026-09-20", outcome: "accorde" }),
      row({ studyLevel: "licence", createdAt: "2026-09-02" }),
    ];
    const out = c21LifecycleDaily(rows, "2026-09");
    expect(out.month).toBe("2026-09");
    expect(out.days).toHaveLength(30);
    expect(out.days[0].master.demande).toBe(1);
    expect(out.days[9].master.envoi).toBe(1);
    expect(out.days[19].master.reponse).toBe(1);
    expect(out.days[1].licence.demande).toBe(1);
    expect(out.days[0].licence.envoi).toBe(0);
  });

  it("retombe sur le mois courant si le filtre est invalide", () => {
    const out = c21LifecycleDaily([], "nope");
    expect(out.month).toBe(todayStr().slice(0, 7));
  });
});

describe("c11CohortDaily", () => {
  it("regroupe par jour d'envoi du mois choisi, ignore les autres mois et les non-envoyés", () => {
    const rows = [
      row({ docsSent: "2026-09-05", response: "2026-09-20", outcome: "accorde" }),
      row({ docsSent: "2026-09-05", response: "2026-09-25", outcome: "refuse" }),
      row({ docsSent: "2026-09-15", response: null }),
      row({ docsSent: "2026-10-01", response: "2026-10-10", outcome: "accorde" }),
      row({ docsSent: null }),
    ];
    const out = c11CohortDaily(rows, "2026-09");
    expect(out.month).toBe("2026-09");
    expect(out.days).toHaveLength(2);
    expect(out.days[0]).toEqual({ date: "2026-09-05", n: 2, answeredPct: 100, approvedPct: 50, medianWait: 17.5 });
    expect(out.days[1]).toEqual({ date: "2026-09-15", n: 1, answeredPct: 0, approvedPct: 0, medianWait: null });
  });

  it("renvoie une liste vide si aucun dossier envoyé ce mois-ci", () => {
    const out = c11CohortDaily([row({ docsSent: "2026-08-01" })], "2026-09");
    expect(out.days).toEqual([]);
  });

  it("retombe sur le mois courant si le filtre est invalide", () => {
    const out = c11CohortDaily([], "nope");
    expect(out.month).toBe(todayStr().slice(0, 7));
  });
});

describe("envelope", () => {
  it("signale insufficientData si n < MIN_SAMPLE_SIZE (5)", () => {
    const e = envelope(4, { foo: 1 });
    expect(e.insufficientData).toBe(true);
    expect(e.data).toBeNull();
  });

  it("fournit n + data si suffisant", () => {
    const e = envelope(10, { foo: 1 });
    expect(e.insufficientData).toBe(false);
    if (!e.insufficientData) {
      expect(e.data).toEqual({ foo: 1 });
      expect(e.n).toBe(10);
      expect(e.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});
