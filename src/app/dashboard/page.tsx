"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { apiFetch, unwrapArray } from "@/lib/api";
import type {
  ApplicationList,
  ProgramSummary,
  SessionRow,
} from "@/lib/types";

export default function DashboardHome() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [applications, setApplications] = useState<ApplicationList[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, a, s] = await Promise.all([
          apiFetch<unknown>("/programs/programs/"),
          apiFetch<unknown>("/admissions/applications/").catch(() => []),
          apiFetch<unknown>("/mentorship/sessions/").catch(() => []),
        ]);
        if (cancelled) return;
        setPrograms(unwrapArray<ProgramSummary>(p));
        setApplications(unwrapArray<ApplicationList>(a));
        setSessions(unwrapArray<SessionRow>(s));
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Erreur de chargement");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-8">Tableau de bord</h1>
        <p className="text-sm text-neutral-6">
          Vue d’ensemble des programmes, candidatures et sessions.
        </p>
      </div>
      {err ? (
        <p className="text-sm text-red-600">{err}</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-neutral-6">Programmes</p>
          <p className="mt-1 text-3xl font-semibold text-neutral-8">
            {programs.length}
          </p>
          <Link
            href="/dashboard/programs"
            className="mt-3 inline-block text-sm font-medium text-primary-1"
          >
            Voir la liste →
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-neutral-6">Candidatures</p>
          <p className="mt-1 text-3xl font-semibold text-neutral-8">
            {applications.length}
          </p>
          <Link
            href="/dashboard/admissions"
            className="mt-3 inline-block text-sm font-medium text-primary-1"
          >
            Voir la liste →
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-neutral-6">Sessions mentorat</p>
          <p className="mt-1 text-3xl font-semibold text-neutral-8">
            {sessions.length}
          </p>
          <Link
            href="/dashboard/mentorship"
            className="mt-3 inline-block text-sm font-medium text-primary-1"
          >
            Voir la liste →
          </Link>
        </Card>
      </div>
    </div>
  );
}
