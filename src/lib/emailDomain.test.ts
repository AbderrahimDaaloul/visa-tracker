import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveMx } = vi.hoisted(() => ({ resolveMx: vi.fn() }));

vi.mock("node:dns", () => ({
  promises: { resolveMx },
}));

import {
  clearEmailDomainCache,
  emailDomain,
  isEmailDomainDeliverable,
  isValidDomainShape,
} from "./emailDomain";

beforeEach(() => {
  clearEmailDomainCache();
  resolveMx.mockReset();
});

describe("emailDomain", () => {
  it("extrait et normalise le domaine", () => {
    expect(emailDomain("Sami@Example.TN")).toBe("example.tn");
    expect(emailDomain("sans-arobase")).toBe("");
  });
});

describe("isValidDomainShape", () => {
  it("accepte les domaines email classiques", () => {
    expect(isValidDomainShape("gmail.com")).toBe(true);
    expect(isValidDomainShape("etudiant.univ-tunis.tn")).toBe(true);
  });

  it("refuse les domaines incomplets ou mal formés", () => {
    expect(isValidDomainShape("localhost")).toBe(false);
    expect(isValidDomainShape("-example.com")).toBe(false);
    expect(isValidDomainShape("example..com")).toBe(false);
    expect(isValidDomainShape("example.c")).toBe(false);
    expect(isValidDomainShape("example.123")).toBe(false);
  });
});

describe("isEmailDomainDeliverable", () => {
  it("accepte un domaine avec un serveur MX", async () => {
    resolveMx.mockResolvedValue([{ exchange: "gmail-smtp-in.l.google.com", priority: 5 }]);
    await expect(isEmailDomainDeliverable("gmail.com")).resolves.toBe(true);
  });

  it("refuse un domaine sans enregistrement MX", async () => {
    resolveMx.mockResolvedValue([]);
    await expect(isEmailDomainDeliverable("example.com")).resolves.toBe(false);
  });

  it("refuse un MX nul qui indique que le domaine n'accepte pas d'emails", async () => {
    resolveMx.mockResolvedValue([{ exchange: ".", priority: 0 }]);
    await expect(isEmailDomainDeliverable("example.com")).resolves.toBe(false);
  });

  it("refuse un domaine introuvable", async () => {
    resolveMx.mockRejectedValue(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }));
    await expect(isEmailDomainDeliverable("domaine-inexistant.tn")).resolves.toBe(false);
  });

  it("ne fait pas de requête DNS pour un domaine invalide", async () => {
    await expect(isEmailDomainDeliverable("localhost")).resolves.toBe(false);
    expect(resolveMx).not.toHaveBeenCalled();
  });

  it("met en cache les résultats pour éviter les requêtes répétées", async () => {
    resolveMx.mockResolvedValue([{ exchange: "mx.example.com", priority: 10 }]);
    await expect(isEmailDomainDeliverable("example.com")).resolves.toBe(true);
    await expect(isEmailDomainDeliverable("example.com")).resolves.toBe(true);
    expect(resolveMx).toHaveBeenCalledTimes(1);
  });
});
