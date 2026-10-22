import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { ensureAppInit } = await import("../src/lib/db/init");
  const { getDb, rowsOf } = await import("../src/lib/db/client");
  const { sql } = await import("drizzle-orm");

  await ensureAppInit();
  const db = await getDb();
  const rows = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM centers) AS centers,
      (SELECT count(*)::int FROM applications) AS applications,
      (SELECT count(*)::int FROM users) AS users
  `);
  const counts = rowsOf<Record<string, unknown>>(rows)[0] ?? {};
  console.log(
    JSON.stringify(
      {
        ok: true,
        database: process.env.DATABASE_URL ? "postgres" : "pglite",
        demoSeedEnabled: process.env.SEED_DEMO === "1",
        counts,
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
