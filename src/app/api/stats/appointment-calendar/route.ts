import { runStat } from "@/lib/stats/run";
import { c4AppointmentCalendar } from "@/lib/stats/compute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runStat(req, (rows) => {
    const mode = new URL(req.url).searchParams.get("mode") === "reservation" ? "reservation" : "rendezvous";
    return c4AppointmentCalendar(rows, mode);
  });
}
