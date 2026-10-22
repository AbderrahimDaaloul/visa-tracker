import { afterEach, describe, expect, it, vi } from "vitest";
import { isBootstrapAdmin, parseAdminEmails } from "./adminEmails";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin bootstrap emails", () => {
  it("normalise et ignore les entrées vides", () => {
    expect(parseAdminEmails(" Admin@Exemple.TN, ,mod@x.com ")).toEqual(["admin@exemple.tn", "mod@x.com"]);
    expect(parseAdminEmails(undefined)).toEqual([]);
  });

  it("reconnaît un admin configuré sans tenir compte de la casse", () => {
    vi.stubEnv("ADMIN_EMAILS", "boss@visatrack.tn, second@visatrack.tn");
    expect(isBootstrapAdmin("BOSS@visatrack.tn")).toBe(true);
    expect(isBootstrapAdmin("second@visatrack.tn")).toBe(true);
    expect(isBootstrapAdmin("student@visatrack.tn")).toBe(false);
  });

  it("ne renvoie rien sans variable configurée", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(isBootstrapAdmin("boss@visatrack.tn")).toBe(false);
  });
});
