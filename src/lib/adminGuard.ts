import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export async function requireRole(roles: string[]): Promise<string> {
  const user = await getSessionUser();
  if (!user || !roles.includes(user.role)) {
    throw apiError("Accès réservé aux modérateurs/administrateurs.", 403);
  }
  return user.role;
}
