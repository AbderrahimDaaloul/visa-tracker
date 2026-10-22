import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "crypto";

const KEY_SEED = process.env.EMAIL_CRYPT_KEY ?? "visatrack-tn-default-dev-key";
const KEY = scryptSync(KEY_SEED, "vtt-visatrack-salt", 32);

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) {
    // Keep the timing close to a real verification for unknown accounts.
    hashPassword(password);
    return false;
  }
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  if (expected.length === 0) return false;
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function passwordFingerprint(passwordHash: string | null): string {
  return sha256Hex(passwordHash ?? "no-password").slice(0, 16);
}

export function createPasswordResetToken(userId: string, fingerprint: string, ttlMs = 30 * 60 * 1000): string {
  const payload = `${userId}.${Date.now() + ttlMs}.${fingerprint}`;
  const sig = createHmac("sha256", KEY_SEED).update(`reset:${payload}`).digest("base64url");
  return Buffer.from(`${payload}.${sig}`, "utf8").toString("base64url");
}

export function verifyPasswordResetToken(token: string): { userId: string; fingerprint: string } | null {
  const raw = Buffer.from(token, "base64url").toString("utf8");
  if (Buffer.from(raw, "utf8").toString("base64url") !== token) return null;
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [userId, expRaw, fingerprint, sig] = parts;
  const exp = Number(expRaw);
  if (!userId || !fingerprint || !sig || !Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = createHmac("sha256", KEY_SEED)
    .update(`reset:${userId}.${expRaw}.${fingerprint}`)
    .digest("base64url");
  const gotBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (gotBuf.length !== expectedBuf.length || !timingSafeEqual(gotBuf, expectedBuf)) return null;
  return { userId, fingerprint };
}

export function createEmailVerificationToken(
  userId: string,
  emailHash: string,
  ttlMs = 24 * 60 * 60 * 1000
): string {
  const payload = `${userId}.${Date.now() + ttlMs}.${emailHash}`;
  const sig = createHmac("sha256", KEY_SEED).update(`verify:${payload}`).digest("base64url");
  return Buffer.from(`${payload}.${sig}`, "utf8").toString("base64url");
}

export function verifyEmailVerificationToken(token: string): { userId: string; emailHash: string } | null {
  const raw = Buffer.from(token, "base64url").toString("utf8");
  if (Buffer.from(raw, "utf8").toString("base64url") !== token) return null;
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [userId, expRaw, emailHash, sig] = parts;
  const exp = Number(expRaw);
  if (!userId || !emailHash || !sig || !Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = createHmac("sha256", KEY_SEED)
    .update(`verify:${userId}.${expRaw}.${emailHash}`)
    .digest("base64url");
  const gotBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (gotBuf.length !== expectedBuf.length || !timingSafeEqual(gotBuf, expectedBuf)) return null;
  return { userId, emailHash };
}

export function encryptEmail(email: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([iv, cipher.update(email, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return enc.toString("base64");
}

export function decryptEmail(payload: string): string {
  // Legacy demo rows stored the address in clear; never fail for those accounts.
  if (payload.includes("@") && !/^[A-Za-z0-9+/=]+$/.test(payload)) return payload;
  const buf = Buffer.from(payload, "base64");
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  // New format: 12-byte random IV prefixed to the ciphertext.
  if (data.length > 12) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", KEY, data.subarray(0, 12));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data.subarray(12)), decipher.final()]).toString("utf8");
    } catch {
      // Fall through to the legacy zero-IV format.
    }
  }
  const legacyIv = Buffer.alloc(12);
  const decipher = createDecipheriv("aes-256-gcm", KEY, legacyIv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
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
