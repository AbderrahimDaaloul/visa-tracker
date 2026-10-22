import { json, withApi } from "@/lib/api";
import { fetchBaseRows, parseFilters, envelope, type BaseRow, type Filters, type StatEnvelope } from "./base";
import type { NextResponse } from "next/server";

export async function runStat<T>(req: Request, compute: (rows: BaseRow[]) => T | null): Promise<NextResponse> {
  return withApi(async () => {
    const f = parseFilters(new URL(req.url).searchParams);
    const rows = await fetchBaseRows(f);
    return json(envelope<T>(rows.length, compute(rows)) satisfies StatEnvelope<T>);
  });
}

/**
 * Runs a stat that spans a whole period (e.g. a monthly or weekly series).
 * The year filter still applies, but the month restriction is dropped so the
 * series keeps all its buckets for the selected year.
 */
export async function runStatSeries<T>(
  req: Request,
  compute: (rows: BaseRow[], f: Filters) => T | null
): Promise<NextResponse> {
  return withApi(async () => {
    const f = parseFilters(new URL(req.url).searchParams);
    const seriesFilters: Filters = { ...f, month: undefined };
    const rows = await fetchBaseRows(seriesFilters);
    return json(envelope<T>(rows.length, compute(rows, f)) satisfies StatEnvelope<T>);
  });
}
