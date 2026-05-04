"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, unwrapArray } from "@/lib/api";
import type { ApplicationList } from "@/lib/types";

export default function AdmissionsPage() {
  const [rows, setRows] = useState<ApplicationList[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const q = new URLSearchParams();
        if (status.trim()) q.set("status", status.trim());
        if (search.trim()) q.set("search", search.trim());
        const path =
          q.toString().length > 0
            ? `/admissions/applications/?${q.toString()}`
            : "/admissions/applications/";
        const data = await apiFetch<unknown>(path);
        if (!c) setRows(unwrapArray<ApplicationList>(data));
      } catch (e) {
        if (!c)
          setError(e instanceof Error ? e.message : "Chargement impossible");
      }
    })();
    return () => {
      c = true;
    };
  }, [status, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-8">Candidatures</h1>
        <p className="text-sm text-neutral-6">
          Filtres query : statut, recherche (voir Swagger).
        </p>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-sm text-neutral-7">Statut</label>
          <Input
            placeholder="ex. pending"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-sm text-neutral-7">Recherche</label>
          <Input
            placeholder="email, programme…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-neutral-4 bg-neutral-2">
            <tr>
              <th className="px-4 py-3 font-medium text-neutral-7">ID</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Programme</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Candidat</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Statut</th>
              <th className="px-4 py-3 font-medium text-neutral-7" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-neutral-4 last:border-0">
                <td className="px-4 py-3">{a.id}</td>
                <td className="px-4 py-3 text-neutral-8">
                  {typeof a.program === "string"
                    ? a.program
                    : (a.program as { title?: string })?.title ?? "—"}
                </td>
                <td className="px-4 py-3 text-neutral-7">
                  {a.student?.email ?? "—"}
                </td>
                <td className="px-4 py-3">{a.status ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/dashboard/admissions/${a.id}`}
                    className="font-medium text-primary-1"
                  >
                    Détail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !error ? (
          <p className="p-6 text-sm text-neutral-6">Aucune candidature.</p>
        ) : null}
      </Card>
    </div>
  );
}
