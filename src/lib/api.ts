import { NextResponse } from "next/server";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data as Record<string, unknown>, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function apiError(message: string, status = 400, extra?: Record<string, unknown>): NextResponse {
  return json({ error: message, ...extra }, status);
}

export async function withApi(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (e) {
    if (e instanceof NextResponse) return e;
    const res: NextResponse | undefined = e as NextResponse;
    if (res && typeof res === "object" && "status" in res) return res;
    if (e && typeof e === "object" && "issues" in (e as Record<string, unknown>) && Array.isArray((e as { issues: unknown }).issues)) {
      return json({ error: "Données invalides.", issues: (e as { issues: unknown }).issues }, 422);
    }
    console.error(e);
    return apiError("Erreur interne du serveur", 500);
  }
}

const rl = new Map<string, { count: number; reset: number }>();

export function rateLimitKey(...parts: string[]): string {
  return parts.join("|");
}

/** Simple fixed-window in-memory rate limiter. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const cur = rl.get(key);
  if (!cur || cur.reset < now) {
    rl.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (cur.count >= max) return false;
  cur.count++;
  return true;
}

export async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "local";
}
