"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { apiFetch, unwrapArray } from "@/lib/api";
import type { ProgramSummary } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

export default function ProgramsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ProgramSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canCreate =
    user?.role === "admin" || user?.role === "program_creator";

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await apiFetch<unknown>("/programs/programs/");
        if (!c) setRows(unwrapArray<ProgramSummary>(data));
      } catch (e) {
        if (!c)
          setError(e instanceof Error ? e.message : "Impossible de charger");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  function tone(
    s: ProgramSummary["validation_status"],
  ): "neutral" | "success" | "warning" | "danger" {
    if (s === "approved") return "success";
    if (s === "pending") return "warning";
    if (s === "rejected") return "danger";
    return "neutral";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-8">Programmes</h1>
          <p className="text-sm text-neutral-6">
            Liste selon votre rôle (voir Swagger / programmes).
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/dashboard/programs/new"
            className="inline-flex items-center justify-center rounded-xl bg-primary-1 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-2"
          >
            Nouveau programme
          </Link>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-neutral-4 bg-neutral-2">
            <tr>
              <th className="px-4 py-3 font-medium text-neutral-7">Titre</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Tag</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Statut</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Prix</th>
              <th className="px-4 py-3 font-medium text-neutral-7" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-neutral-4 last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-8">{p.title}</td>
                <td className="px-4 py-3 text-neutral-7">{p.tag}</td>
                <td className="px-4 py-3">
                  {p.validation_status ? (
                    <Badge tone={tone(p.validation_status)}>
                      {p.validation_status}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-7">
                  {p.price} {p.currency ?? ""}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/dashboard/programs/${p.id}`}
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
          <p className="p-6 text-sm text-neutral-6">Aucun programme.</p>
        ) : null}
      </Card>
    </div>
  );
}
