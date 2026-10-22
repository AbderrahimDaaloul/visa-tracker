"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select, Label } from "./ui";
import { t } from "@/lib/i18n";
import { MONTHS_FR } from "@/lib/constants";

export function currentMonth(): number {
  return new Date().getUTCMonth() + 1;
}

export function currentYear(): number {
  return new Date().getUTCFullYear();
}

const YEARS = [currentYear() - 2, currentYear() - 1, currentYear(), currentYear() + 1];

export function GlobalFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  const set = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    params.delete("centerId");
    params.delete("visaType");
    params.delete("intake");
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/visualize?${params.toString()}`, { scroll: false });
  };

  const current = (key: string, dflt: string) => sp.get(key) ?? dflt;

  return (
    <div className="card mb-4 grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
      <div>
        <Label>{t.dashboard.month}</Label>
        <Select value={current("month", String(currentMonth()))} onChange={(e) => set("month", e.target.value)}>
          {MONTHS_FR.map((label, i) => (
            <option key={label} value={i + 1}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>{t.dashboard.year}</Label>
        <Select value={current("year", String(currentYear()))} onChange={(e) => set("year", e.target.value)}>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

export function pendingFiltersNote() {
  return null;
}

export function useDashboardFilters() {
  const sp = useSearchParams();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return useMemo(() => {
    const params = new URLSearchParams();
    params.set("fixed", "1");

    const rawMonth = Number(sp.get("month"));
    const month = Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : currentMonth();
    params.set("month", String(month));

    const rawYear = Number(sp.get("year"));
    const year = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : currentYear();
    params.set("year", String(year));

    return ready ? params.toString() : null;
  }, [sp, ready]);
}
