import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export type AdminActor = { id: string; role: string };

export async function requireRole(roles: string[]): Promise<AdminActor> {
  const user = await getSessionUser();
  if (!user || !roles.includes(user.role)) {
    throw apiError("Accès réservé aux modérateurs/administrateurs.", 403);
  }
  return { id: user.id, role: user.role };
}
