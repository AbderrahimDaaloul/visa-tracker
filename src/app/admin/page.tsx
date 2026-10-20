"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Select, Skeleton } from "@/components/ui";

type AdminData = {
  stats: { users_total: number; users_banned: number; apps_active: number; apps_hidden: number; flags_open: number };
  users: { id: string; pseudo: string; role: string; trust_score: number; created_at: string; banned_at: string | null; active_apps: number }[];
  entries: { id: string; outcome: string; intake: string; visa_type: string; status: string; pseudo: string; center: string; open_flags: number }[];
  openFlags: { id: number; reason: string; created_at: string; status: string; application_id: string; reporter: string }[];
};

export default function AdminPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setReady(true);
        if (!d.user) {
          router.replace("/login");
          return;
        }
        if (d.user.role === "admin" || d.user.role === "moderator") setAllowed(true);
        else router.replace("/");
      });
  }, [router]);

  const { data, isLoading } = useQuery<AdminData>({
    queryKey: ["admin"],
    queryFn: () => fetch("/api/admin").then((r) => r.json()),
    enabled: ready && allowed,
  });

  async function act(body: Record<string, unknown>) {
    await fetch("/api/admin/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    void qc.invalidateQueries({ queryKey: ["admin"] });
  }

  if (!ready || isLoading || !data) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">Administration</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat k="Utilisateurs" v={data.stats.users_total} />
        <Stat k="Bannis" v={data.stats.users_banned} />
        <Stat k="Candidatures actives" v={data.stats.apps_active} />
        <Stat k="Masquées" v={data.stats.apps_hidden} />
        <Stat k="Signalements ouverts" v={data.stats.flags_open} />
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-bold">File de signalements</h2>
        {data.openFlags.length === 0 ? (
          <p className="text-sm text-muted">Aucun signalement ouvert.</p>
        ) : (
          <ul className="space-y-2">
            {data.openFlags.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-2 text-sm">
                <span>
                  <strong>@{f.reporter}</strong> : {f.reason}
                </span>
                <span className="flex gap-2">
                  <Select value="" onChange={(e) => e.target.value && act({ action: "resolve_flag", flagId: f.id, decision: e.target.value })}>
                    <option value="">— décider —</option>
                    <option value="confirmee">Confirmer (masquer)</option>
                    <option value="rejete">Rejeter</option>
                  </Select>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-bold">Entrées récentes</h2>
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1">Pseudo</th>
                <th>Centre</th>
                <th>Intake</th>
                <th>Résultat</th>
                <th>Statut</th>
                <th>Sign.</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id} className="border-t border-[var(--border)]">
                  <td className="py-1">@{e.pseudo}</td>
                  <td>{e.center}</td>
                  <td>{e.intake}</td>
                  <td>{e.outcome === "accorde" ? "Accordé" : e.outcome === "refuse" ? "Refusé" : "Attente"}</td>
                  <td>{e.status}</td>
                  <td>{e.open_flags}</td>
                  <td className="flex gap-1 py-1">
                    {e.status !== "cache" ? (
                      <Button size="sm" variant="ghost" onClick={() => act({ action: "hide", applicationId: e.id })}>
                        Masquer
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => act({ action: "unhide", applicationId: e.id })}>
                        Restaurer
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-bold">Utilisateurs</h2>
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1">Pseudo</th>
                <th>Rôle</th>
                <th>Confiance</th>
                <th>Candidatures</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]">
                  <td className="py-1">@{u.pseudo}</td>
                  <td>{u.role}</td>
                  <td>{u.trust_score}</td>
                  <td>{u.active_apps}</td>
                  <td>{u.banned_at ? "Banni" : "OK"}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => act({ action: u.banned_at ? "unban" : "ban", userId: u.id })}>
                      {u.banned_at ? "Débannir" : "Bannir"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: number }) {
  return (
    <div className="card p-3">
      <p className="text-2xl font-extrabold text-[var(--primary)]">{v}</p>
      <p className="text-[11px] text-muted">{k}</p>
    </div>
  );
}
