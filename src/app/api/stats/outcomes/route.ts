import { runStat } from "@/lib/stats/run";
import { c2Outcomes } from "@/lib/stats/compute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runStat(req, (rows) => {
    const d = c2Outcomes(rows);
    return { byMonth: d.byMonth, totals: d.totals };
  });
}
