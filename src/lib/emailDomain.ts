import { promises as dns } from "node:dns";

const POSITIVE_TTL_MS = 10 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 1000;
const LOOKUP_TIMEOUT_MS = 4000;
const MAX_CACHE_ENTRIES = 1000;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const cache = new Map<string, { ok: boolean; expiresAt: number }>();

async function timeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

export function isValidDomainShape(domain: string): boolean {
  return DOMAIN_PATTERN.test(domain);
}

export async function isEmailDomainDeliverable(domain: string): Promise<boolean> {
  if (!isValidDomainShape(domain)) return false;

  const now = Date.now();
  const cached = cache.get(domain);
  if (cached && cached.expiresAt > now) return cached.ok;

  let ok = false;
  try {
    const records = await timeout(dns.resolveMx(domain), LOOKUP_TIMEOUT_MS);
    ok = Boolean(records?.some((record) => record.exchange && record.exchange !== "."));
  } catch {
    ok = false;
  }

  if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();
  cache.set(domain, { ok, expiresAt: now + (ok ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS) });
  return ok;
}

export function clearEmailDomainCache(): void {
  cache.clear();
}
