import { normalizeEmail } from "./crypto";

export function parseAdminEmails(value: string | undefined = process.env.ADMIN_EMAILS): string[] {
  return (value ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

/** Production admin bootstrap: any email listed in ADMIN_EMAILS becomes admin. */
export function isBootstrapAdmin(email: string): boolean {
  return parseAdminEmails().includes(normalizeEmail(email));
}
