import { runStat } from "@/lib/stats/run";
import { c7WaitByCenter, c8ApprovalByCenter } from "@/lib/stats/compute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runStat(req, (rows) => ({
    waitByCenter: c7WaitByCenter(rows),
    approvalByCenter: c8ApprovalByCenter(rows),
  }));
}
