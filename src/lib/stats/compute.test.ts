import { describe, expect, it } from "vitest";
import {
  dayDiff,
  computedStage,
  c9Survival,
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
  it("rendezvous avec RDV, sans docs/reponse", () => {
    expect(computedStage(row({ appointment: "2026-01-01" }))).toBe("rendezvous");
  });
  it("rendezvous si le RDV est passé, même avec docs envoyés", () => {
    expect(computedStage(row({ docsSent: "2026-01-01", response: null, appointment: "2026-01-05" }))).toBe("rendezvous");
  });
  it("soumis avec docs envoyés et RDV à venir", () => {
    expect(computedStage(row({ docsSent: "2026-01-01", response: null, appointment: "2099-01-01" }))).toBe("soumis");
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
