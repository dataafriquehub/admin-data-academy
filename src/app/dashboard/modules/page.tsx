"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { apiFetch, unwrapArray } from "@/lib/api";

type ModuleRow = {
  id: number;
  title?: string;
  cover_url?: string | null;
};

export default function ModulesPage() {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await apiFetch<unknown>("/programs/modules/");
        if (!c) setRows(unwrapArray<ModuleRow>(data));
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
        <h1 className="text-2xl font-semibold text-neutral-8">Modules</h1>
        <p className="text-sm text-neutral-6">
          Catalogue des modules (création détaillée via API / schéma Module).
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-neutral-4 bg-neutral-2">
            <tr>
              <th className="px-4 py-3 font-medium text-neutral-7">ID</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Titre</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Couverture</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-neutral-4 last:border-0">
                <td className="px-4 py-3 text-neutral-8">{m.id}</td>
                <td className="px-4 py-3 font-medium text-neutral-8">
                  {m.title ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {m.cover_url ? (
                    <Link
                      href={m.cover_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-1"
                    >
                      lien
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !error ? (
          <p className="p-6 text-sm text-neutral-6">Aucun module.</p>
        ) : null}
      </Card>
    </div>
  );
}
