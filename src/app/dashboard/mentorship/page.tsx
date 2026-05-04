"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { apiFetch, unwrapArray } from "@/lib/api";
import type { SessionRow } from "@/lib/types";

export default function MentorshipPage() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await apiFetch<unknown>("/mentorship/sessions/");
        if (!c) setRows(unwrapArray<SessionRow>(data));
      } catch (e) {
        if (!c)
          setError(e instanceof Error ? e.message : "Chargement impossible");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-8">Mentorat</h1>
        <p className="text-sm text-neutral-6">
          Sessions staff (`GET /mentorship/sessions/`).
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-neutral-4 bg-neutral-2">
            <tr>
              <th className="px-4 py-3 font-medium text-neutral-7">ID</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Titre</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Début</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Fin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-neutral-4 last:border-0">
                <td className="px-4 py-3">{s.id}</td>
                <td className="px-4 py-3 font-medium text-neutral-8">
                  {(s.title as string) ?? "—"}
                </td>
                <td className="px-4 py-3 text-neutral-7">
                  {(s.starts_at as string) ?? "—"}
                </td>
                <td className="px-4 py-3 text-neutral-7">
                  {(s.ends_at as string) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !error ? (
          <p className="p-6 text-sm text-neutral-6">Aucune session.</p>
        ) : null}
      </Card>
    </div>
  );
}
