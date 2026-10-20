import { runStat } from "@/lib/stats/run";
import { c14RejectionReasons } from "@/lib/stats/compute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runStat(req, (rows) => {
    const d = c14RejectionReasons(rows);
    return d.n >= 10 ? d : null;
  });
}
