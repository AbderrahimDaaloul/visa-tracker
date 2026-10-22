import { describe, expect, it } from "vitest";
import { resolvePasswordResetEmail } from "./passwordReset";

describe("resolvePasswordResetEmail", () => {
  it("ignore l'adresse saisie quand un utilisateur est connecté", () => {
    expect(resolvePasswordResetEmail("Compte@Example.TN", "autre@example.com")).toBe("compte@example.tn");
  });

  it("utilise l'adresse saisie quand aucun utilisateur n'est connecté", () => {
    expect(resolvePasswordResetEmail(null, " Etudiant@Example.TN ")).toBe("etudiant@example.tn");
    expect(resolvePasswordResetEmail(undefined, "etudiant@example.tn")).toBe("etudiant@example.tn");
  });
});
