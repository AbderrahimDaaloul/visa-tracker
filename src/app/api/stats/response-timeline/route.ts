import { runStat } from "@/lib/stats/run";
import { c12ResponseTimeline } from "@/lib/stats/compute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runStat(req, (rows) => c12ResponseTimeline(rows));
}
