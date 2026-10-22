import { createEmailVerificationToken } from "./crypto";
import { sendEmailVerificationEmail, type SendResult } from "./email";

export async function sendAccountVerificationEmail(input: {
  email: string;
  userId: string;
  emailHash: string;
  origin: string;
}): Promise<SendResult> {
  const token = createEmailVerificationToken(input.userId, input.emailHash);
  const link = `${input.origin}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmailVerificationEmail(input.email, link);
}
