"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { ProgramSummary } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

export default function ProgramDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const router = useRouter();
  const { user } = useAuth();
  const [program, setProgram] = useState<ProgramSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<
    "pending" | "approved" | "rejected"
  >("pending");
  const [validationComment, setValidationComment] = useState("");
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const p = await apiFetch<ProgramSummary>(`/programs/programs/${id}/`);
        if (!c) {
          setProgram(p);
          if (p.validation_status) setValidationStatus(p.validation_status);
          if (p.validation_comment) setValidationComment(p.validation_comment);
        }
      } catch (e) {
        if (!c)
          setError(e instanceof Error ? e.message : "Programme introuvable");
      }
    })();
    return () => {
      c = true;
    };
  }, [id]);

  async function saveValidation(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/programs/programs/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          validation_status: validationStatus,
          validation_comment: validationComment || undefined,
        }),
      });
      router.refresh();
      const p = await apiFetch<ProgramSummary>(`/programs/programs/${id}/`);
      setProgram(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  if (error && !program) {
    return (
      <Card>
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard/programs" className="mt-4 inline-block text-primary-1">
          Retour à la liste
        </Link>
      </Card>
    );
  }

  if (!program) {
    return (
      <div className="text-neutral-6">Chargement…</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/programs" className="text-sm text-primary-1">
          ← Programmes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-8">{program.title}</h1>
        <p className="text-sm text-neutral-6">{program.tag}</p>
      </div>
      <Card>
        <h2 className="font-medium text-neutral-8">Description</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-7">
          {program.description}
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-6">Période</dt>
            <dd className="text-neutral-8">
              {program.start_date} → {program.end_date}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-6">Prix</dt>
            <dd className="text-neutral-8">
              {program.price} {program.currency ?? ""}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-6">Durée</dt>
            <dd className="text-neutral-8">{program.length_in_weeks} semaines</dd>
          </div>
          <div>
            <dt className="text-neutral-6">Validation</dt>
            <dd>
              {program.validation_status ? (
                <Badge
                  tone={
                    program.validation_status === "approved"
                      ? "success"
                      : program.validation_status === "pending"
                        ? "warning"
                        : "danger"
                  }
                >
                  {program.validation_status}
                </Badge>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </Card>

      {isAdmin ? (
        <Card>
          <h2 className="font-medium text-neutral-8">Validation (admin)</h2>
          <form className="mt-4 flex flex-col gap-4" onSubmit={saveValidation}>
            <div>
              <label className="mb-1 block text-sm text-neutral-7">Statut</label>
              <select
                className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-base"
                value={validationStatus}
                onChange={(e) =>
                  setValidationStatus(e.target.value as typeof validationStatus)
                }
              >
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-7">Commentaire</label>
              <textarea
                className="min-h-[80px] w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-base"
                value={validationComment}
                onChange={(e) => setValidationComment(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" disabled={saving}>
              {saving ? "Enregistrement…" : "Mettre à jour la validation"}
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
