import { json, withApi } from "@/lib/api";
import { fetchBaseRows, parseFilters, envelope, type BaseRow, type StatEnvelope } from "./base";
import type { NextResponse } from "next/server";

export async function runStat<T>(req: Request, compute: (rows: BaseRow[]) => T | null): Promise<NextResponse> {
  return withApi(async () => {
    const f = parseFilters(new URL(req.url).searchParams);
    const rows = await fetchBaseRows(f);
    return json(envelope<T>(rows.length, compute(rows)) satisfies StatEnvelope<T>);
  });
}
