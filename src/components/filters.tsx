"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Select, Label } from "./ui";
import { t } from "@/lib/i18n";

type Center = { id: number; name: string; city: string | null };

export function GlobalFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const { data } = useQuery<{ centers: Center[] }>({
    queryKey: ["centers"],
    queryFn: async () => fetch("/api/centers").then((r) => r.json()),
  });

  const set = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.push(`/visualize?${params.toString()}`, { scroll: false });
  };

  const current = (key: string, dflt: string) => sp.get(key) ?? dflt;

  const intakes = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let y = now.getUTCFullYear() - 1; y <= now.getUTCFullYear() + 2; y++) {
      for (const m of ["01", "05", "09"] as const) out.push(`${y}-${m}`);
    }
    return out;
  }, []);

  return (
    <div className="card mb-4 grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
      <div>
        <Label>{t.dashboard.center}</Label>
        <Select value={current("centerId", "all")} onChange={(e) => set("centerId", e.target.value)}>
          <option value="all">{t.dashboard.all}</option>
          {data?.centers?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>{t.dashboard.visaType}</Label>
        <Select value={current("visaType", "all")} onChange={(e) => set("visaType", e.target.value)}>
          <option value="all">{t.dashboard.all}</option>
          <option value="etudiant_d">Visa étudiant D</option>
          <option value="cours_langue">Cours de langue</option>
          <option value="autre">Autre</option>
        </Select>
      </div>
      <div>
        <Label>{t.dashboard.intake}</Label>
        <Select value={current("intake", "all")} onChange={(e) => set("intake", e.target.value)}>
          <option value="all">{t.dashboard.all}</option>
          {intakes.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>{t.dashboard.period}</Label>
        <Select
          value={current("range", "12mois")}
          onChange={(e) => {
            const v = e.target.value;
            const params = new URLSearchParams(sp.toString());
            params.delete("from");
            params.delete("to");
            if (v !== "tout") params.set("range", v);
            else params.set("range", "tout");
            router.push(`/visualize?${params.toString()}`, { scroll: false });
          }}
        >
          <option value="3mois">3 mois</option>
          <option value="6mois">6 mois</option>
          <option value="12mois">12 mois</option>
          <option value="tout">Tout</option>
        </Select>
      </div>
      <p className="col-span-2 self-end text-[11px] text-muted sm:col-span-1">
        {t.footer.disclaimer}
      </p>
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
    const copy = (k: string) => {
      const v = sp.get(k);
      if (v && v !== "all") params.set(k, v);
    };
    copy("centerId");
    copy("visaType");
    copy("intake");
    // period range filter -> from/to
    const range = sp.get("range") ?? "12mois";
    if (range !== "tout") {
      const months = range === "3mois" ? 3 : range === "6mois" ? 6 : 12;
      params.set("from", new Date(Date.now() - months * 30 * 86400000).toISOString().slice(0, 10));
    }
    return ready ? params.toString() : null;
  }, [sp, ready]);
}
