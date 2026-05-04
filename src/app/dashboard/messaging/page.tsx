"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { apiFetch, unwrapArray } from "@/lib/api";
import type { ConversationRow } from "@/lib/types";

export default function MessagingPage() {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await apiFetch<unknown>("/messaging/conversations/");
        if (!c) setRows(unwrapArray<ConversationRow>(data));
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
        <h1 className="text-2xl font-semibold text-neutral-8">Messagerie</h1>
        <p className="text-sm text-neutral-6">
          Conversations (`GET /messaging/conversations/`). Thread détaillé : endpoints messages dans Swagger.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="space-y-3">
        {rows.map((c) => (
          <Card key={c.id}>
            <p className="font-medium text-neutral-8">
              {c.title ?? `Conversation #${c.id}`}
            </p>
            <p className="text-xs text-neutral-6">ID {c.id}</p>
          </Card>
        ))}
        {rows.length === 0 && !error ? (
          <Card>
            <p className="text-sm text-neutral-6">Aucune conversation.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
