"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

type Detail = {
  id: number;
  motivation?: string;
  status?: string;
  program?: unknown;
  student?: { email?: string; first_name?: string; last_name?: string };
};

export default function AdmissionDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [row, setRow] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState("pending");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const d = await apiFetch<Detail>(`/admissions/applications/${id}/`);
        if (!c) {
          setRow(d);
          if (d.status) setReviewStatus(d.status);
          else setReviewStatus("pending");
        }
      } catch (e) {
        if (!c)
          setError(e instanceof Error ? e.message : "Introuvable");
      }
    })();
    return () => {
      c = true;
    };
  }, [id]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admissions/applications/review/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: reviewStatus }),
      });
      const d = await apiFetch<Detail>(`/admissions/applications/${id}/`);
      setRow(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  if (error && !row) {
    return (
      <Card>
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard/admissions" className="mt-4 inline-block text-primary-1">
          Retour
        </Link>
      </Card>
    );
  }

  if (!row) return <div className="text-neutral-6">Chargement…</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/dashboard/admissions" className="text-sm text-primary-1">
        ← Candidatures
      </Link>
      <Card>
        <h1 className="text-xl font-semibold text-neutral-8">
          Candidature #{row.id}
        </h1>
        <p className="mt-1 text-sm text-neutral-6">
          {row.student?.email}
          {row.student?.first_name
            ? ` — ${row.student.first_name} ${row.student.last_name ?? ""}`
            : null}
        </p>
        <div className="mt-4 space-y-2 text-sm">
          <p>
            <span className="text-neutral-6">Motivation : </span>
            <span className="text-neutral-8 whitespace-pre-wrap">
              {row.motivation ?? "—"}
            </span>
          </p>
          <p>
            <span className="text-neutral-6">Statut actuel : </span>
            {row.status ?? "—"}
          </p>
        </div>
      </Card>
      <Card>
        <h2 className="font-medium text-neutral-8">Revue</h2>
        <p className="mt-1 text-xs text-neutral-6">
          Corps exact selon Swagger (`ApplicationReview` / serializer revue).
        </p>
        <form className="mt-4 flex flex-col gap-4" onSubmit={submitReview}>
          <div>
            <label className="mb-1 block text-sm text-neutral-7">Statut</label>
            <select
              required
              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-base text-neutral-8"
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value)}
            >
              <option value="pending">pending</option>
              <option value="under_review">under_review</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Envoi…" : "Enregistrer la revue"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
