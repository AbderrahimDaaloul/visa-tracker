import { runStatSeries } from "@/lib/stats/run";
import { c20LifecycleTimeline } from "@/lib/stats/compute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runStatSeries(req, (rows) => c20LifecycleTimeline(rows));
}
