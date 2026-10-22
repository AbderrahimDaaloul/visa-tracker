import { json, withApi } from "@/lib/api";
import { fetchBaseRows, parseFilters, envelope, type Filters } from "@/lib/stats/base";
import { c11CohortDaily } from "@/lib/stats/compute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withApi(async () => {
    const f = parseFilters(new URL(req.url).searchParams);
    const viewMonth = f.month && f.year ? `${f.year}-${String(f.month).padStart(2, "0")}` : null;
    const scopeFilters: Filters = { ...f, month: undefined, year: undefined };
    const rows = await fetchBaseRows(scopeFilters);
    return json(envelope(rows.length, c11CohortDaily(rows, viewMonth)));
  });
}
