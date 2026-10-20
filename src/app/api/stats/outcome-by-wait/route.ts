import { runStat } from "@/lib/stats/run";
import { c10OutcomeByWait } from "@/lib/stats/compute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runStat(req, (rows) => c10OutcomeByWait(rows));
}
