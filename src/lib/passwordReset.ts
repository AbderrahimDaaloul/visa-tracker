import { normalizeEmail } from "./crypto";

export function resolvePasswordResetEmail(
  sessionEmail: string | null | undefined,
  submittedEmail: string
): string {
  return normalizeEmail(sessionEmail || submittedEmail);
}
