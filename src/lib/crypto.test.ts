import { describe, expect, it } from "vitest";
import {
  createEmailVerificationToken,
  createPasswordResetToken,
  decryptEmail,
  encryptEmail,
  hashPassword,
  normalizeEmail,
  passwordFingerprint,
  sha256Hex,
  verifyEmailVerificationToken,
  verifyPassword,
  verifyPasswordResetToken,
} from "./crypto";

describe("crypto emails", () => {
  it("chiffre puis déchiffre un email", () => {
    const email = "etudiant@exemple.tn";
    expect(decryptEmail(encryptEmail(email))).toBe(email);
  });

  it("produit un chiffré différent à chaque appel (IV aléatoire)", () => {
    const a = encryptEmail("etudiant@exemple.tn");
    const b = encryptEmail("etudiant@exemple.tn");
    expect(a).not.toBe(b);
    expect(decryptEmail(a)).toBe(decryptEmail(b));
  });

  it("normalise les emails Outlook sans perdre la casse du domaine", () => {
    expect(normalizeEmail("  Sami+Test@Outlook.com ")).toBe("sami@outlook.com");
    expect(normalizeEmail("Sami+Test@Exemple.TN")).toBe("sami+test@exemple.tn");
  });

  it("hache de façon déterministe", () => {
    expect(sha256Hex("abc")).toBe(sha256Hex("abc"));
    expect(sha256Hex("abc")).toHaveLength(64);
  });
});

describe("mots de passe", () => {
  it("hache et vérifie un mot de passe", () => {
    const hash = hashPassword("Secret123");
    expect(hash).not.toContain("Secret123");
    expect(verifyPassword("Secret123", hash)).toBe(true);
    expect(verifyPassword("Wrong123", hash)).toBe(false);
    expect(verifyPassword("Secret123", null)).toBe(false);
  });

  it("produit un hash différent à chaque appel", () => {
    expect(hashPassword("Secret123")).not.toBe(hashPassword("Secret123"));
  });
});

describe("jetons de réinitialisation", () => {
  it("valide un jeton frais et son empreinte", () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const fingerprint = passwordFingerprint("scrypt$salt$hash");
    const token = createPasswordResetToken(userId, fingerprint, 60_000);
    expect(verifyPasswordResetToken(token)).toEqual({ userId, fingerprint });
  });

  it("refuse un jeton expiré ou modifié", () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const fingerprint = passwordFingerprint("scrypt$salt$hash");
    expect(verifyPasswordResetToken(createPasswordResetToken(userId, fingerprint, -1_000))).toBeNull();
    expect(verifyPasswordResetToken(`${createPasswordResetToken(userId, fingerprint, 60_000)}x`)).toBeNull();
  });

  it("change d'empreinte quand le mot de passe change", () => {
    expect(passwordFingerprint("hash-a")).not.toBe(passwordFingerprint("hash-b"));
  });
});

describe("jetons de vérification email", () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const emailHash = sha256Hex("etudiant@exemple.tn");

  it("valide un jeton frais et son empreinte email", () => {
    const token = createEmailVerificationToken(userId, emailHash, 60_000);
    expect(verifyEmailVerificationToken(token)).toEqual({ userId, emailHash });
  });

  it("refuse un jeton expiré, modifié ou tronqué", () => {
    expect(verifyEmailVerificationToken(createEmailVerificationToken(userId, emailHash, -1_000))).toBeNull();
    expect(verifyEmailVerificationToken(`${createEmailVerificationToken(userId, emailHash, 60_000)}x`)).toBeNull();
    expect(verifyEmailVerificationToken("")).toBeNull();
  });
});
