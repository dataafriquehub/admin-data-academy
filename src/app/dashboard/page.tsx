"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, apiFetch } from "@/lib/api";

type AdminDashboardResponse = {
  generated_at: string;
  counts: {
    users: {
      total: number;
      by_role: Record<string, number>;
      new_last_7_days: number;
    };
    programs: {
      total: number;
      pending_validation: number;
      approved: number;
      rejected: number;
    };
    modules: { total: number };
    applications: {
      total: number;
      pending: number;
      under_review: number;
      approved: number;
      rejected: number;
      new_last_7_days: number;
    };
    certificates: { total: number };
    mentorship: {
      sessions_total: number;
      sessions_upcoming: number;
      sessions_in_past_30_days: number;
    };
    messaging: { conversations_total: number };
    notifications: { unread_total: number };
    uploads: { files_total: number };
  };
  recent: {
    applications: Array<{
      id: number;
      status: string;
      applied_at: string | null;
      program_title: string;
      student_email: string;
    }>;
    programs_pending_validation: Array<{
      id: number;
      title: string;
      updated_at: string | null;
      creator_email: string | null;
    }>;
    sessions_upcoming: Array<{
      id: number;
      title: string;
      scheduled_at: string | null;
      program_title: string;
      mentor_email: string | null;
    }>;
  };
};

type DashboardError =
  | { type: "forbidden"; message: string }
  | { type: "network"; message: string };

const numberFormatter = new Intl.NumberFormat("fr-FR");

const roleLabels: Record<string, string> = {
  student: "Apprenants",
  mentor: "Mentors",
  program_creator: "Concepteurs",
  admin: "Admins",
};

const statusLabels: Record<string, string> = {
  pending: "En attente",
  under_review: "En revue",
  approved: "Approuvées",
  rejected: "Rejetées",
  pending_validation: "À valider",
};

const chartColors = ["#0872E0", "#FF8A00", "#10B981", "#A855F7", "#EF4444"];

function formatNumber(value: number | undefined): string {
  return numberFormatter.format(value ?? 0);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function generatedAtLabel(value: string | undefined): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "approved") return "success";
  if (status === "pending" || status === "under_review") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}

function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function KpiCard({
  label,
  value,
  icon,
  href,
  hint,
  highlight,
}: {
  label: string;
  value: number;
  icon: string;
  href?: string;
  hint?: string;
  highlight?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary-5" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-small font-medium text-neutral-6">{label}</p>
          <p className="mt-2 text-h4 font-semibold text-neutral-8">
            {formatNumber(value)}
          </p>
          {hint ? <p className="mt-1 text-xs text-neutral-5">{hint}</p> : null}
          {href ? (
            <Link
              href={href}
              className="mt-4 inline-flex items-center gap-1 text-small font-semibold text-primary-1 hover:underline"
            >
              Voir la liste
              <Icon icon="solar:arrow-right-linear" width={14} />
            </Link>
          ) : null}
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-5 text-primary-1">
          <Icon icon={icon} width={22} height={22} />
        </span>
      </div>
      {highlight ? (
        <div className="relative mt-4 rounded-xl border border-secondary-4 bg-secondary-5 px-3 py-2 text-xs font-medium text-neutral-8">
          {highlight}
        </div>
      ) : null}
    </Card>
  );
}

function MiniMetric({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: number;
  icon: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-4 bg-neutral-1 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-2 text-neutral-8">
          <Icon icon={icon} width={18} height={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-neutral-5">{label}</p>
          <p className="text-h6 font-semibold text-neutral-8">
            {formatNumber(value)}
          </p>
        </div>
      </div>
      {hint ? <p className="mt-2 text-xs text-neutral-5">{hint}</p> : null}
    </div>
  );
}

function DonutChart({
  entries,
}: {
  entries: Array<{ label: string; value: number; color: string }>;
}) {
  const total = entries.reduce((sum, item) => sum + item.value, 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const segments = entries.reduce<
    Array<{ label: string; color: string; dash: number; offset: number }>
  >((acc, item) => {
    const previousOffset = acc.reduce((sum, segment) => sum + segment.dash, 0);
    const dash = total > 0 ? (item.value / total) * circumference : 0;
    acc.push({
      label: item.label,
      color: item.color,
      dash,
      offset: previousOffset,
    });
    return acc;
  }, []);

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
      <div className="relative mx-auto h-44 w-44 shrink-0">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="transparent"
            stroke="var(--color-neutral-4)"
            strokeWidth="18"
          />
          {segments.map((segment) => (
              <circle
                key={segment.label}
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke={segment.color}
                strokeWidth="18"
                strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
                strokeDashoffset={-segment.offset}
                strokeLinecap="round"
              />
          ))}
        </svg>
        <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full bg-neutral-1 text-center">
          <span className="text-xs text-neutral-5">Total</span>
          <span className="text-h5 font-semibold text-neutral-8">
            {formatNumber(total)}
          </span>
        </div>
      </div>
      <div className="grid flex-1 gap-3">
        {entries.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-small text-neutral-7">
              <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 shrink-0">
                <circle cx="5" cy="5" r="5" fill={item.color} />
              </svg>
              <span className="truncate">{item.label}</span>
            </span>
            <span className="text-small font-semibold text-neutral-8">
              {formatNumber(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({
  entries,
}: {
  entries: Array<{ label: string; value: number; color: string }>;
}) {
  const max = Math.max(...entries.map((e) => e.value), 1);
  const total = entries.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-4">
      {entries.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-small text-neutral-7">{item.label}</span>
            <span className="text-small font-semibold text-neutral-8">
              {formatNumber(item.value)}
              <span className="ml-1 font-normal text-neutral-5">
                ({percent(item.value, total)}%)
              </span>
            </span>
          </div>
          <svg
            viewBox="0 0 100 10"
            preserveAspectRatio="none"
            className="h-2.5 w-full overflow-hidden rounded-full"
          >
            <rect width="100" height="10" rx="5" fill="var(--color-neutral-2)" />
            <rect
              width={Math.max(4, (item.value / max) * 100)}
              height="10"
              rx="5"
              fill={item.color}
            />
          </svg>
        </div>
      ))}
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-6 px-4 py-8 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="h-8 w-56 animate-pulse rounded-lg bg-neutral-4/40" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-neutral-4/30" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-xl bg-neutral-4/30" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Card key={item}>
            <div className="h-4 w-28 animate-pulse rounded bg-neutral-4/30" />
            <div className="mt-4 h-10 w-24 animate-pulse rounded bg-neutral-4/40" />
            <div className="mt-5 h-4 w-32 animate-pulse rounded bg-neutral-4/30" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {[0, 1].map((item) => (
          <Card key={item}>
            <div className="h-5 w-40 animate-pulse rounded bg-neutral-4/40" />
            <div className="mt-6 h-56 animate-pulse rounded-2xl bg-neutral-4/20" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Card key={item}>
            <div className="h-5 w-44 animate-pulse rounded bg-neutral-4/40" />
            <div className="mt-5 space-y-3">
              {[0, 1, 2, 3, 4].map((line) => (
                <div key={line} className="h-12 animate-pulse rounded-xl bg-neutral-4/20" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const router = useRouter();
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [error, setError] = useState<DashboardError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadDashboard({ silent = false } = {}) {
    if (!silent) setLoading(true);
    setRefreshing(silent);
    setError(null);
    try {
      const payload = await apiFetch<AdminDashboardResponse>(
        "/users/admin/dashboard/",
      );
      setData(payload);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        setError({
          type: "forbidden",
          message: "Accès réservé aux administrateurs.",
        });
        return;
      }
      setError({
        type: "network",
        message:
          err instanceof Error
            ? err.message
            : "Impossible de charger le tableau de bord.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadDashboard();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <SkeletonDashboard />;

  if (error?.type === "forbidden") {
    return (
      <div className="px-4 py-8 lg:px-8">
        <Card className="border-secondary-4 bg-secondary-5/40">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary-5 text-secondary-1">
              <Icon icon="solar:shield-warning-bold" width={22} height={22} />
            </span>
            <div>
              <h1 className="text-h6 font-semibold text-neutral-8">
                Accès réservé aux administrateurs
              </h1>
              <p className="mt-1 text-small text-neutral-6">
                Votre compte est authentifié, mais le serveur refuse l’accès aux
                statistiques agrégées du backoffice.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-4 py-8 lg:px-8">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-h6 font-semibold text-neutral-8">
                Tableau de bord indisponible
              </h1>
              <p className="mt-1 text-small text-neutral-6">
                {error?.message || "Une erreur inconnue est survenue."}
              </p>
            </div>
            <Button onClick={() => loadDashboard()} type="button">
              Réessayer
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { counts, recent } = data;
  const roleEntries = Object.entries(counts.users.by_role || {}).map(
    ([role, value], index) => ({
      label: roleLabels[role] || role.replaceAll("_", " "),
      value,
      color: chartColors[index % chartColors.length],
    }),
  );
  const applicationStatusEntries = [
    { label: statusLabels.pending, value: counts.applications.pending, color: "#F59E0B" },
    {
      label: statusLabels.under_review,
      value: counts.applications.under_review,
      color: "#0872E0",
    },
    { label: statusLabels.approved, value: counts.applications.approved, color: "#10B981" },
    { label: statusLabels.rejected, value: counts.applications.rejected, color: "#EF4444" },
  ];
  const programStatusEntries = [
    {
      label: statusLabels.pending_validation,
      value: counts.programs.pending_validation,
      color: "#F59E0B",
    },
    { label: "Validés", value: counts.programs.approved, color: "#10B981" },
    { label: "Rejetés", value: counts.programs.rejected, color: "#EF4444" },
  ];

  return (
    <div className="space-y-8 px-4 py-8 lg:px-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-h4 font-semibold text-neutral-8">
              Tableau de bord
            </h1>
            <Badge tone="neutral">Admin</Badge>
          </div>
          <p className="mt-1 text-small text-neutral-6">
            Vue d’ensemble des programmes, candidatures, utilisateurs et
            sessions.
          </p>
          <p className="mt-2 text-xs text-neutral-5">
            Données à {generatedAtLabel(data.generated_at)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => loadDashboard({ silent: true })}
          disabled={refreshing}
          className="self-start border border-neutral-4 bg-neutral-1"
        >
          <Icon
            icon={refreshing ? "svg-spinners:90-ring-with-bg" : "solar:refresh-bold"}
            width={16}
          />
          Actualiser
        </Button>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        <KpiCard
          label="Programmes"
          value={counts.programs.total}
          icon="solar:clipboard-list-bold"
          href="/dashboard/programs"
          hint={`${formatNumber(counts.programs.approved)} validés · ${formatNumber(
            counts.programs.rejected,
          )} rejetés`}
          highlight={
            counts.programs.pending_validation > 0
              ? `${formatNumber(counts.programs.pending_validation)} en attente de validation`
              : undefined
          }
        />
        <KpiCard
          label="Candidatures"
          value={counts.applications.total}
          icon="solar:document-text-bold"
          href="/dashboard/admissions"
          hint={`${formatNumber(counts.applications.new_last_7_days)} nouvelles sur 7 jours`}
          highlight={
            counts.applications.pending + counts.applications.under_review > 0
              ? `${formatNumber(
                  counts.applications.pending + counts.applications.under_review,
                )} à traiter`
              : undefined
          }
        />
        <KpiCard
          label="Sessions mentorat"
          value={counts.mentorship.sessions_total}
          icon="fluent:video-person-16-regular"
          href="/dashboard/mentorship"
          hint={`${formatNumber(counts.mentorship.sessions_in_past_30_days)} tenues sur 30 jours`}
          highlight={
            counts.mentorship.sessions_upcoming > 0
              ? `${formatNumber(counts.mentorship.sessions_upcoming)} à venir`
              : undefined
          }
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-h6 font-semibold text-neutral-8">
                Utilisateurs par rôle
              </h2>
              <p className="text-xs text-neutral-5">
                {formatNumber(counts.users.total)} utilisateurs au total
              </p>
            </div>
            <Icon
              icon="solar:users-group-rounded-bold"
              width={22}
              className="text-primary-1"
            />
          </div>
          <DonutChart entries={roleEntries} />
        </Card>

        <Card className="xl:col-span-4">
          <div className="mb-5">
            <h2 className="text-h6 font-semibold text-neutral-8">
              Candidatures par statut
            </h2>
            <p className="text-xs text-neutral-5">
              Pipeline d’admission actuel
            </p>
          </div>
          <BarChart entries={applicationStatusEntries} />
        </Card>

        <Card className="xl:col-span-3">
          <div className="mb-5">
            <h2 className="text-h6 font-semibold text-neutral-8">
              État des programmes
            </h2>
            <p className="text-xs text-neutral-5">
              Validation catalogue
            </p>
          </div>
          <BarChart entries={programStatusEntries} />
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <MiniMetric
          label="Nouveaux utilisateurs"
          value={counts.users.new_last_7_days}
          icon="solar:user-plus-bold"
          hint="7 derniers jours"
        />
        <MiniMetric
          label="Nouvelles candidatures"
          value={counts.applications.new_last_7_days}
          icon="solar:inbox-in-bold"
          hint="7 derniers jours"
        />
        <MiniMetric
          label="Notifications non lues"
          value={counts.notifications.unread_total}
          icon="solar:bell-bold"
          hint="Centre de notifications"
        />
        <MiniMetric
          label="Conversations"
          value={counts.messaging.conversations_total}
          icon="solar:chat-round-dots-bold"
        />
        <MiniMetric
          label="Certificats"
          value={counts.certificates.total}
          icon="solar:medal-ribbons-star-bold"
        />
        <MiniMetric
          label="Fichiers"
          value={counts.uploads.files_total}
          icon="solar:folder-with-files-bold"
        />
        <MiniMetric
          label="Sessions passées"
          value={counts.mentorship.sessions_in_past_30_days}
          icon="solar:calendar-mark-bold"
          hint="30 derniers jours"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="p-0">
          <div className="border-b border-neutral-4 px-5 py-4">
            <h2 className="text-h6 font-semibold text-neutral-8">
              Dernières candidatures
            </h2>
          </div>
          <div className="divide-y divide-neutral-4">
            {recent.applications.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/admissions/${item.id}`}
                className="block px-5 py-3 hover:bg-neutral-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-small font-semibold text-neutral-8">
                      {item.student_email}
                    </p>
                    <p className="truncate text-xs text-neutral-6">
                      {item.program_title}
                    </p>
                  </div>
                  <Badge tone={statusTone(item.status)}>
                    {statusLabels[item.status] || item.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-neutral-5">
                  {formatDateTime(item.applied_at)}
                </p>
              </Link>
            ))}
            {recent.applications.length === 0 ? (
              <p className="px-5 py-8 text-center text-small text-neutral-6">
                Aucune candidature récente.
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="p-0">
          <div className="border-b border-neutral-4 px-5 py-4">
            <h2 className="text-h6 font-semibold text-neutral-8">
              Programmes à valider
            </h2>
          </div>
          <div className="divide-y divide-neutral-4">
            {recent.programs_pending_validation.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/programs/${item.id}`}
                className="block px-5 py-3 hover:bg-neutral-3"
              >
                <p className="truncate text-small font-semibold text-neutral-8">
                  {item.title}
                </p>
                <p className="truncate text-xs text-neutral-6">
                  {item.creator_email || "Créateur non renseigné"}
                </p>
                <p className="mt-1 text-xs text-neutral-5">
                  {formatDateTime(item.updated_at)}
                </p>
              </Link>
            ))}
            {recent.programs_pending_validation.length === 0 ? (
              <p className="px-5 py-8 text-center text-small text-neutral-6">
                Aucun programme en attente.
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="p-0">
          <div className="border-b border-neutral-4 px-5 py-4">
            <h2 className="text-h6 font-semibold text-neutral-8">
              Prochaines sessions
            </h2>
          </div>
          <div className="divide-y divide-neutral-4">
            {recent.sessions_upcoming.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href="/dashboard/mentorship"
                className="block px-5 py-3 hover:bg-neutral-3"
              >
                <p className="truncate text-small font-semibold text-neutral-8">
                  {item.title}
                </p>
                <p className="truncate text-xs text-neutral-6">
                  {item.program_title}
                </p>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs text-neutral-5">
                  <span className="truncate">
                    {item.mentor_email || "Mentor non renseigné"}
                  </span>
                  <span className="shrink-0">
                    {formatDateTime(item.scheduled_at)}
                  </span>
                </div>
              </Link>
            ))}
            {recent.sessions_upcoming.length === 0 ? (
              <p className="px-5 py-8 text-center text-small text-neutral-6">
                Aucune session planifiée.
              </p>
            ) : null}
          </div>
        </Card>
      </section>
    </div>
  );
}
