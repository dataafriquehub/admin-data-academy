"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RoleGate } from "@/components/role-gate";
import { apiFetch, unwrapArray } from "@/lib/api";
import type { NotificationRow } from "@/lib/types";

export default function NotificationsPage() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sendTitle, setSendTitle] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendPending, setSendPending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);

  function reload() {
    apiFetch<unknown>("/notifications/")
      .then((d) => setRows(unwrapArray<NotificationRow>(d)))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Erreur"),
      );
  }

  useEffect(() => {
    reload();
  }, []);

  async function sendTargeted(e: React.FormEvent) {
    e.preventDefault();
    setSendErr(null);
    setSendPending(true);
    try {
      await apiFetch("/notifications/send/", {
        method: "POST",
        body: JSON.stringify({
          title: sendTitle,
          message: sendMessage,
          type: "general",
          priority: "medium",
        }),
      });
      setSendTitle("");
      setSendMessage("");
      reload();
    } catch (err) {
      setSendErr(err instanceof Error ? err.message : "Envoi impossible");
    } finally {
      setSendPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-8">Notifications</h1>
        <p className="text-sm text-neutral-6">
          Boîte de réception et envoi ciblé (admin, schéma `SendNotification`).
        </p>
      </div>

      <RoleGate roles={["admin"]}>
        <Card>
          <h2 className="font-medium text-neutral-8">Envoi ciblé</h2>
          <p className="mt-1 text-xs text-neutral-6">
            Compléter les champs selon Swagger (`roles`, `user_ids`, etc.).
          </p>
          <form className="mt-4 flex flex-col gap-4" onSubmit={sendTargeted}>
            <div>
              <label className="mb-1 block text-sm text-neutral-7">Titre</label>
              <Input
                required
                value={sendTitle}
                onChange={(e) => setSendTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-7">Message</label>
              <textarea
                required
                className="min-h-[100px] w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-base"
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
              />
            </div>
            {sendErr ? (
              <p className="text-sm text-red-600">{sendErr}</p>
            ) : null}
            <Button type="submit" disabled={sendPending}>
              {sendPending ? "Envoi…" : "Envoyer"}
            </Button>
          </form>
        </Card>
      </RoleGate>

      <div>
        <h2 className="mb-3 text-lg font-medium text-neutral-8">Mes notifications</h2>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="space-y-3">
          {rows.map((n) => (
            <Card key={n.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-neutral-8">{n.title}</p>
                {!n.is_read ? (
                  <span className="rounded-lg bg-primary-1/15 px-2 py-0.5 text-xs text-primary-1">
                    Non lu
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-neutral-7">{n.message}</p>
              <p className="mt-2 text-xs text-neutral-5">{n.created_at}</p>
            </Card>
          ))}
          {rows.length === 0 && !error ? (
            <Card>
              <p className="text-sm text-neutral-6">Aucune notification.</p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
