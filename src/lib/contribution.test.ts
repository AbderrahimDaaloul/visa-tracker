import { describe, expect, it } from "vitest";
import { applyContribution } from "./contribution";
import { todayStr, dayDiff } from "./stats/compute";

const current = {
  appointmentDate: "2026-01-10",
  docsSentDate: "2026-01-15",
  responseDate: null,
  outcome: "en_attente",
};

function isoOffset(days: number): string {
  return new Date(Date.parse(`${todayStr()}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

async function expectBad(fn: () => unknown): Promise<string> {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(Response);
    const body = (await (e as Response).json()) as { error: string };
    return body.error;
  }
  throw new Error("La validation aurait dû échouer");
}

describe("applyContribution — validations", () => {
  it("accepte un envoi de dossier passé", () => {
    const { updates, warnings } = applyContribution(current, { docsSentDate: "2026-02-01" });
    expect(updates.docsSentDate).toBe("2026-02-01");
    expect(warnings).toEqual([]);
  });

  it("refuse une date d'envoi future", async () => {
    const msg = await expectBad(() => applyContribution(current, { docsSentDate: isoOffset(2) }));
    expect(msg).toContain("futur");
  });

  it("refuse une réponse antérieure à l'envoi du dossier", async () => {
    const msg = await expectBad(() => applyContribution(current, { responseDate: "2026-01-01", outcome: "accorde" }));
    expect(msg).toContain("postérieure");
  });

  it("refuse une raison de refus sur un dossier accordé", async () => {
    const msg = await expectBad(() =>
      applyContribution(current, { outcome: "accorde", responseDate: "2026-02-01", rejectionReason: "admission" })
    );
    expect(msg).toContain("refus");
  });

  it("accepte un motif de refus libre et le nettoie", () => {
    const { updates } = applyContribution(current, {
      outcome: "refuse",
      responseDate: "2026-02-01",
      rejectionReason: "  Justificatif bancaire insuffisant  ",
    });
    expect(updates.rejectionReason).toBe("Justificatif bancaire insuffisant");
  });

  it("refuse un motif de refus trop long", async () => {
    const msg = await expectBad(() =>
      applyContribution(current, { outcome: "refuse", responseDate: "2026-02-01", rejectionReason: "x".repeat(301) })
    );
    expect(msg).toContain("300");
  });

  it("avertit au-delà de 120 jours d'attente mais enregistre", () => {
    const { updates, warnings } = applyContribution(current, {
      responseDate: "2026-08-01",
      outcome: "accorde",
    });
    expect(updates.responseDate).toBe("2026-08-01");
    expect(dayDiff("2026-08-01", "2026-01-15")).toBeGreaterThan(120);
    expect(warnings.some((w) => w.includes("120 jours"))).toBe(true);
  });

  it("n'écrit que les champs transmis", () => {
    const { updates } = applyContribution(current, { appointmentSlot: "matin" });
    expect(updates).toEqual({ appointmentSlot: "matin" });
  });
});
