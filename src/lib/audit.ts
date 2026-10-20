export async function auditLog(
  db: unknown,
  actorRole: string,
  action: string,
  detail: Record<string, unknown>
): Promise<void> {
  console.info(`[audit] role=${actorRole} action=${action} ${JSON.stringify(detail)}`);
  void db;
}
