import { runStatSeries } from "@/lib/stats/run";
import { c11CohortTable } from "@/lib/stats/compute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runStatSeries(req, (rows) => c11CohortTable(rows));
}
