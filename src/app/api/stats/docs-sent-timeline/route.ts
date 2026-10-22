import { runStat } from "@/lib/stats/run";
import { c19DocsSentTimeline } from "@/lib/stats/compute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runStat(req, (rows) => c19DocsSentTimeline(rows));
}
