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

export const requestOtpSchema = z.object({ email: emailSchema });

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: z.string().trim().length(6),
  pseudo: PSEUDO_SCHEMA.nullable().optional(),
});

export const createApplicationSchema = z.object({
  centerId: z.number().int().positive(),
  visaType: z.enum(VISA_TYPES_JSON as [string, ...string[]]),
  intake: z
    .string()
    .trim()
    .regex(/^(20)\d{2}-\d{2}$/),
  studyLevel: z.enum(["licence", "master", "doctorat"]).nullable().optional(),
  fieldOfStudy: z.string().trim().max(60).nullable().optional(),
});

export const updateApplicationSchema = z.object({
  visaType: z.enum(VISA_TYPES_JSON as [string, ...string[]]).optional(),
  intake: z.string().regex(/^(20)\d{2}-\d{2}$/).optional(),
  studyLevel: z.enum(["licence", "master", "doctorat"]).nullable().optional(),
  fieldOfStudy: z.string().trim().max(60).nullable().optional(),
  appointmentDate: isoDate.nullable().optional(),
  appointmentSlot: z.enum(["matin", "apresmidi"]).nullable().optional(),
  slotBookedOn: isoDate.nullable().optional(),
  docsSentDate: isoDate.nullable().optional(),
  docsSubmissionMode: z.enum(["centre", "courier", "en_ligne"]).nullable().optional(),
  outcome: z.enum(["accorde", "refuse", "en_attente"]).optional(),
  responseDate: isoDate.nullable().optional(),
  rejectionReason: z.enum(["documents_manquants", "preuve_financiere", "admission", "non_precise"]).nullable().optional(),
});

export const flagSchema = z.object({  applicationId: z.string().uuid(),
  reason: z.string().trim().min(5).max(300),
});
