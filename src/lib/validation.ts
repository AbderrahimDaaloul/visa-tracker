import { z } from "zod";
import { VISA_TYPES_JSON } from "./constants";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

export const PSEUDO_SCHEMA = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et _ uniquement");

export const emailSchema = z.string().trim().email().max(200);

export const PASSWORD_SCHEMA = z
  .string()
  .min(8, "8 caractères minimum")
  .max(200, "200 caractères maximum")
  .regex(/[A-Za-z]/, "Doit contenir au moins une lettre")
  .regex(/[0-9]/, "Doit contenir au moins un chiffre");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const registerSchema = z.object({
  pseudo: PSEUDO_SCHEMA,
  email: emailSchema,
  password: PASSWORD_SCHEMA,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resendVerificationSchema = z.object({ email: emailSchema });

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(600),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(600),
  password: PASSWORD_SCHEMA,
});

export const createApplicationSchema = z.object({
  studyLevel: z.enum(["licence", "master"]),
});

export const updateApplicationSchema = z.object({
  visaType: z.enum(VISA_TYPES_JSON as [string, ...string[]]).optional(),
  intake: z.string().regex(/^(20)\d{2}-\d{2}$/).optional(),
  studyLevel: z.enum(["licence", "master"]).nullable().optional(),
  fieldOfStudy: z.string().trim().max(60).nullable().optional(),
  appointmentDate: isoDate.nullable().optional(),
  appointmentSlot: z.enum(["matin", "apresmidi"]).nullable().optional(),
  slotBookedOn: isoDate.nullable().optional(),
  docsSentDate: isoDate.nullable().optional(),
  docsSubmissionMode: z.enum(["centre", "courier", "en_ligne"]).nullable().optional(),
  outcome: z.enum(["accorde", "refuse", "en_attente"]).optional(),
  responseDate: isoDate.nullable().optional(),
  rejectionReason: z.string().trim().max(300, "300 caractères maximum").nullable().optional(),
});

export const flagSchema = z.object({  applicationId: z.string().uuid(),
  reason: z.string().trim().min(5).max(300),
});
