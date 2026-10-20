import { runStat } from "@/lib/stats/run";
import { c1WaitTrend } from "@/lib/stats/compute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runStat(req, (rows) => c1WaitTrend(rows));
}
