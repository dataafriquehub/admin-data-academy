"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { RoleGate } from "@/components/role-gate";
import { apiFetch, unwrapArray } from "@/lib/api";
import type { User } from "@/lib/types";

function UsersTable() {
  const [rows, setRows] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await apiFetch<unknown>("/users/auth/users/");
        if (!c) setRows(unwrapArray<User>(data));
      } catch (e) {
        if (!c)
          setError(e instanceof Error ? e.message : "Accès refusé ou erreur");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-neutral-4 bg-neutral-2">
            <tr>
              <th className="px-4 py-3 font-medium text-neutral-7">ID</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Email</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Rôle</th>
              <th className="px-4 py-3 font-medium text-neutral-7">Nom</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-neutral-4 last:border-0">
                <td className="px-4 py-3">{u.id}</td>
                <td className="px-4 py-3 text-neutral-8">{u.email}</td>
                <td className="px-4 py-3 capitalize">{u.role}</td>
                <td className="px-4 py-3 text-neutral-7">
                  {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !error ? (
          <p className="p-6 text-sm text-neutral-6">Aucun utilisateur.</p>
        ) : null}
      </Card>
    </>
  );
}

export default function UsersPage() {
  return (
    <RoleGate roles={["admin"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-8">Utilisateurs</h1>
          <p className="text-sm text-neutral-6">
            `GET /users/auth/users/` — réservé admin.
          </p>
        </div>
        <UsersTable />
      </div>
    </RoleGate>
  );
}
