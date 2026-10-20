import { createCipheriv, createDecipheriv, createHash, randomInt, scryptSync } from "crypto";

const KEY_SEED = process.env.EMAIL_CRYPT_KEY ?? "visatrack-tn-default-dev-key";
const KEY = scryptSync(KEY_SEED, "vtt-visatrack-salt", 32);

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacHex(input: string): string {
  return createHash("sha256").update(`${input}|${KEY_SEED}`).digest("hex");
}

export function encryptEmail(email: string): string {
  const iv = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(email, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return enc.toString("base64");
}

export function decryptEmail(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const iv = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function generateToken(): string {
  return `${Date.now().toString(36)}-${Array.from({ length: 3 }, () => randomInt(0, 4 ** 21).toString(36)).join("")}`.replace(/[^a-z0-9-]/g, "x");
}

export function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at === -1) return e;
  const domain = e.slice(at + 1);
  let local = e.slice(0, at);
  if (domain === "outlook.fr" || domain === "outlook.com" || domain === "yahoo.fr" || domain === "yahoo.com") {
    local = local.replace(/\+.*$/, "");
  }
  return `${local}@${domain}`;
}
