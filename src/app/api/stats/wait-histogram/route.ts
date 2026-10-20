import { runStat } from "@/lib/stats/run";
import { c3WaitHistogram } from "@/lib/stats/compute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runStat(req, (rows) => ({ hist: c3WaitHistogram(rows).hist }));
}
