"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { ApiError, apiFetch, unwrapArray } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { User } from "@/lib/types";
import {
  getApplicationProgress,
  listApplications,
  reviewApplication,
  type ApplicationProgressResponse,
  type ApplicationRow,
  type ApplicationStatus,
  type PaymentStatus,
} from "@/services/applicationService";

const STATUSES: ApplicationStatus[] = [
  "pending",
  "under_review",
  "approved",
  "rejected",
];

const STATUS_META: Record<
  ApplicationStatus,
  { label: string; icon: string; classes: string }
> = {
  pending: {
    label: "En attente",
    icon: "solar:clock-circle-bold",
    classes:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  under_review: {
    label: "En revue",
    icon: "solar:document-text-bold",
    classes: "border-primary-3 bg-primary-5 text-primary-1",
  },
  approved: {
    label: "Approuvée",
    icon: "solar:check-circle-bold",
    classes:
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
  },
  rejected: {
    label: "Rejetée",
    icon: "solar:close-circle-bold",
    classes: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300",
  },
};

const PAYMENT_META: Record<string, { label: string; classes: string }> = {
  not_applicable: {
    label: "Non applicable",
    classes: "bg-neutral-3 text-neutral-7",
  },
  pending: {
    label: "Paiement en attente",
    classes: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  paid: {
    label: "Payé",
    classes: "bg-green-500/10 text-green-700 dark:text-green-300",
  },
  failed: {
    label: "Échec paiement",
    classes: "bg-red-500/10 text-red-600 dark:text-red-300",
  },
  waived: {
    label: "Dispensé",
    classes: "bg-primary-5 text-primary-1",
  },
};

const FUNDING_LABELS: Record<string, string> = {
  pay_now: "Paiement direct",
  scholarship_request: "Demande de bourse",
};

const ORDER_OPTIONS = [
  { value: "-applied_at", label: "Plus récentes" },
  { value: "applied_at", label: "Plus anciennes" },
  { value: "status", label: "Statut A → Z" },
  { value: "-status", label: "Statut Z → A" },
];

type ProgramOption = { id: number; title?: string };
type DrawerTab = "summary" | "progress";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Non renseignée";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseignée";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeDate(value: string | undefined): string {
  if (!value) return "Date non renseignée";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date non renseignée";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays <= 0) return "Aujourd’hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 30) return `Il y a ${diffDays} jours`;
  return formatDate(value);
}

function getProgramLabel(row: ApplicationRow): string {
  if (typeof row.program === "string") return row.program || "Programme";
  return row.program?.title || `Programme #${row.program?.id ?? "?"}`;
}

function getStudentLabel(user: User | null | undefined): string {
  if (!user) return "Candidat non renseigné";
  return (
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.email ||
    `Utilisateur #${user.id}`
  );
}

function getReviewerLabel(user: User | null | undefined): string {
  if (!user) return "Non assigné";
  return getStudentLabel(user);
}

function normalize(value: string | undefined | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Non renseigné";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.payload && typeof err.payload === "object") {
      const payload = err.payload as Record<string, unknown>;
      const status = payload.status;
      if (Array.isArray(status) && status.length > 0) return String(status[0]);
      if (typeof payload.detail === "string") return payload.detail;
      if (typeof payload.non_field_errors === "string") {
        return payload.non_field_errors;
      }
      if (Array.isArray(payload.non_field_errors)) {
        return String(payload.non_field_errors[0]);
      }
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Une erreur est survenue.";
}

export default function AdmissionsScreen() {
  const { user, ready } = useAuth();
  const isAdmin = user?.role === "admin";
  const isMentor = user?.role === "mentor";
  const canRead = isAdmin || isMentor || user?.role === "student";
  const isProgramCreator = user?.role === "program_creator";

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const initialApplicationId = useMemo(() => {
    const raw = searchParams.get("application");
    return raw ? Number(raw) : null;
  }, [searchParams]);

  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(
    null,
  );

  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [students, setStudents] = useState<User[]>([]);

  const [status, setStatus] = useState<ApplicationStatus | "all">(
    (searchParams.get("status") as ApplicationStatus | null) || "all",
  );
  const [program, setProgram] = useState<number | "all">(
    searchParams.get("program") ? Number(searchParams.get("program")) : "all",
  );
  const [student, setStudent] = useState<number | "">(
    searchParams.get("student") ? Number(searchParams.get("student")) : "",
  );
  const [ordering, setOrdering] = useState(
    searchParams.get("ordering") || "-applied_at",
  );
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(
    searchParams.get("search") || "",
  );

  const [selected, setSelected] = useState<ApplicationRow | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("summary");
  const [progress, setProgress] = useState<ApplicationProgressResponse | null>(
    null,
  );
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);

  const [reviewStatus, setReviewStatus] = useState<ApplicationStatus>("pending");
  const [reviewPending, setReviewPending] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const syncUrl = useCallback(
    (next: {
      status: ApplicationStatus | "all";
      program: number | "all";
      student: number | "";
      search: string;
      ordering: string;
    }) => {
      const params = new URLSearchParams();
      if (initialApplicationId && !selected) {
        params.set("application", String(initialApplicationId));
      }
      if (next.status !== "all") params.set("status", next.status);
      if (next.program !== "all") params.set("program", String(next.program));
      if (next.student !== "") params.set("student", String(next.student));
      if (next.search.trim()) params.set("search", next.search.trim());
      if (next.ordering !== "-applied_at") params.set("ordering", next.ordering);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [initialApplicationId, pathname, router, selected],
  );

  const loadApplications = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const data = await listApplications(
          {
            status,
            program,
            student,
            search: debouncedSearch,
            ordering,
          },
          { signal },
        );
        setRows(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof ApiError) {
          setError({ status: err.status, message: err.message });
        } else {
          setError({
            message:
              err instanceof Error ? err.message : "Chargement impossible.",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [status, program, student, debouncedSearch, ordering],
  );

  useEffect(() => {
    if (!ready) return;
    if (!canRead) {
      /* eslint-disable react-hooks/set-state-in-effect -- accès refusé sans requête */
      setLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    const controller = new AbortController();
    syncUrl({ status, program, student, search: debouncedSearch, ordering });
    void loadApplications(controller.signal);
    return () => controller.abort();
  }, [
    ready,
    canRead,
    status,
    program,
    student,
    debouncedSearch,
    ordering,
    loadApplications,
    syncUrl,
  ]);

  useEffect(() => {
    if (!ready || !canRead) return;
    let cancelled = false;
    apiFetch<unknown>("/programs/programs/")
      .then((data) => {
        if (!cancelled) setPrograms(unwrapArray<ProgramOption>(data));
      })
      .catch(() => {
        /* les options programmes sont un confort, pas bloquant */
      });

    if (isAdmin || isMentor) {
      apiFetch<unknown>("/users/auth/users/")
        .then((data) => {
          if (cancelled) return;
          const users = unwrapArray<User>(data);
          setStudents(users.filter((u) => u.role === "student"));
        })
        .catch(() => {
          /* le filtre étudiant reste possible via l'ID transmis dans l'URL */
        });
    }

    return () => {
      cancelled = true;
    };
  }, [ready, canRead, isAdmin, isMentor]);

  useEffect(() => {
    if (!selected) return;
    /* eslint-disable react-hooks/set-state-in-effect -- synchronisation drawer depuis ligne sélectionnée */
    setReviewStatus(selected.status || "pending");
    setReviewError(null);
    setDrawerTab("summary");
    setProgress(null);
    setProgressError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selected]);

  useEffect(() => {
    if (!initialApplicationId || selected || rows.length === 0) return;
    const match = rows.find((row) => row.id === initialApplicationId);
    /* eslint-disable react-hooks/set-state-in-effect -- ouverture du drawer depuis l'URL legacy */
    if (match) setSelected(match);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialApplicationId, rows, selected]);

  useEffect(() => {
    if (!selected || drawerTab !== "progress") return;
    const controller = new AbortController();
    /* eslint-disable react-hooks/set-state-in-effect -- chargement progress à l'ouverture d'onglet */
    setProgressLoading(true);
    setProgressError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    getApplicationProgress(selected.id, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setProgress(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setProgressError(getErrorMessage(err));
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setProgressLoading(false);
      });
    return () => controller.abort();
    // On ne dépend pas de `progress`/`progressLoading` pour éviter une boucle
    // d'auto-annulation, ni de `selected` complet (muté lors d'un PATCH review) :
    // le re-fetch n'est nécessaire qu'au changement de candidature ou d'onglet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, drawerTab]);

  const kpis = useMemo(() => {
    const counts: Record<ApplicationStatus, number> = {
      pending: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
    };
    for (const row of rows) {
      if (row.status) counts[row.status] += 1;
    }
    return {
      total: rows.length,
      waiting: counts.pending + counts.under_review,
      ...counts,
    };
  }, [rows]);

  const programOptions = useMemo(() => {
    const byTitle = new Map<string, ProgramOption>();
    for (const p of programs) {
      if (p.id) byTitle.set(p.title || `Programme #${p.id}`, p);
    }
    return Array.from(byTitle.values()).sort((a, b) =>
      (a.title || "").localeCompare(b.title || ""),
    );
  }, [programs]);

  const visibleStudents = useMemo(() => {
    const selectedIds = new Set(rows.map((r) => r.student?.id).filter(Boolean));
    const merged = new Map<number, User>();
    for (const u of students) merged.set(u.id, u);
    for (const row of rows) {
      if (row.student?.id) merged.set(row.student.id, row.student);
    }
    return Array.from(merged.values())
      .filter((u) => selectedIds.has(u.id) || normalize(searchInput).length > 0)
      .sort((a, b) => getStudentLabel(a).localeCompare(getStudentLabel(b)));
  }, [students, rows, searchInput]);

  function resetFilters() {
    setStatus("all");
    setProgram("all");
    setStudent("");
    setSearchInput("");
    setDebouncedSearch("");
    setOrdering("-applied_at");
  }

  async function submitReview() {
    if (!selected || !isAdmin) return;
    setReviewPending(true);
    setReviewError(null);
    try {
      const updated = await reviewApplication(selected.id, reviewStatus);
      setRows((prev) =>
        prev.map((row) =>
          row.id === selected.id ? { ...row, ...updated } : row,
        ),
      );
      setSelected((prev) => (prev ? { ...prev, ...updated } : updated));
      setToast({ kind: "success", text: "Statut de candidature mis à jour." });
    } catch (err) {
      setReviewError(getErrorMessage(err));
    } finally {
      setReviewPending(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Icon
          icon="svg-spinners:90-ring-with-bg"
          width={28}
          className="text-neutral-5"
        />
      </div>
    );
  }

  if (!canRead || isProgramCreator) {
    return (
      <div className="px-4 py-10 lg:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-neutral-4 bg-neutral-1 p-8 text-center shadow-sm">
          <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-3 text-neutral-6">
            <Icon icon="solar:lock-keyhole-bold" width={22} />
          </span>
          <h1 className="text-h5 font-semibold text-neutral-8">
            Accès candidatures non configuré
          </h1>
          <p className="mt-2 text-small text-neutral-6">
            L’API actuelle autorise la consultation backoffice aux administrateurs
            et mentors. Les comptes concepteurs de programme reçoivent un 403 sur
            ces endpoints.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-h4 font-semibold text-neutral-8">Candidatures</h1>
          <p className="mt-1 text-small text-neutral-6">
            Dossiers, revue et suivi des admissions.
          </p>
          {isMentor ? (
            <p className="mt-1 text-xs text-neutral-5">
              Lecture et filtres uniquement : la revue est réservée aux
              administrateurs.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => loadApplications()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3 disabled:opacity-50"
        >
          <Icon
            icon={
              loading
                ? "svg-spinners:90-ring-with-bg"
                : "solar:refresh-circle-linear"
            }
            width={14}
          />
          Rafraîchir
        </button>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6" aria-label="KPI">
        <KpiCard icon="solar:folder-with-files-bold" label="Total" value={kpis.total} />
        <KpiCard
          icon="solar:alarm-bold"
          label="À traiter"
          value={kpis.waiting}
          tone="primary"
        />
        {STATUSES.map((s) => (
          <KpiCard
            key={s}
            icon={STATUS_META[s].icon}
            label={STATUS_META[s].label}
            value={kpis[s]}
            tone={s}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-neutral-4 bg-neutral-1 p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-[240px] flex-1">
            <Icon
              icon="solar:magnifer-linear"
              width={14}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-neutral-5"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Rechercher par email, nom ou programme…"
              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-9 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusChips value={status} onChange={setStatus} />

            <label htmlFor="applications-program" className="sr-only">
              Programme
            </label>
            <select
              id="applications-program"
              value={program === "all" ? "all" : String(program)}
              onChange={(event) =>
                setProgram(
                  event.target.value === "all"
                    ? "all"
                    : Number(event.target.value),
                )
              }
              className="rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs text-neutral-8 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
              title="Filtrer par programme"
            >
              <option value="all">Tous les programmes</option>
              {programOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || `Programme #${p.id}`}
                </option>
              ))}
            </select>

            <label htmlFor="applications-student" className="sr-only">
              Étudiant
            </label>
            <select
              id="applications-student"
              value={student === "" ? "" : String(student)}
              onChange={(event) =>
                setStudent(event.target.value ? Number(event.target.value) : "")
              }
              className="rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs text-neutral-8 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
              title="Filtrer par étudiant"
            >
              <option value="">Tous les étudiants</option>
              {visibleStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {getStudentLabel(s)}
                </option>
              ))}
              {student !== "" && !visibleStudents.some((s) => s.id === student) ? (
                <option value={student}>Étudiant #{student}</option>
              ) : null}
            </select>

            <label htmlFor="applications-ordering" className="sr-only">
              Tri
            </label>
            <select
              id="applications-ordering"
              value={ordering}
              onChange={(event) => setOrdering(event.target.value)}
              className="rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs text-neutral-8 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
              title="Trier"
            >
              {ORDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {(status !== "all" ||
              program !== "all" ||
              student !== "" ||
              searchInput ||
              ordering !== "-applied_at") && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-xl border border-neutral-4 px-3 py-2 text-xs text-neutral-7 hover:bg-neutral-3"
              >
                <Icon icon="solar:close-circle-linear" width={12} />
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </section>

      {toast ? (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
            toast.kind === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300"
              : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300"
          }`}
        >
          <Icon
            icon={
              toast.kind === "success"
                ? "solar:check-circle-bold"
                : "solar:danger-triangle-bold"
            }
            width={14}
          />
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto text-neutral-5 hover:text-neutral-7"
            aria-label="Masquer"
          >
            <Icon icon="solar:close-bold" width={12} />
          </button>
        </div>
      ) : null}

      {loading ? (
        <SkeletonTable />
      ) : error ? (
        <ErrorState error={error} onRetry={() => loadApplications()} />
      ) : rows.length === 0 ? (
        <EmptyState hasFilters={status !== "all" || Boolean(searchInput) || student !== ""} />
      ) : (
        <>
          <ApplicationsTable
            rows={rows}
            isAdmin={isAdmin}
            onOpen={setSelected}
          />
          <ApplicationsCards rows={rows} isAdmin={isAdmin} onOpen={setSelected} />
        </>
      )}

      <ApplicationDrawer
        row={selected}
        tab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={() => setSelected(null)}
        isAdmin={isAdmin}
        reviewStatus={reviewStatus}
        setReviewStatus={setReviewStatus}
        reviewPending={reviewPending}
        reviewError={reviewError}
        onReview={submitReview}
        progress={progress}
        progressLoading={progressLoading}
        progressError={progressError}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: string;
  label: string;
  value: number;
  tone?: ApplicationStatus | "neutral" | "primary";
}) {
  const classes =
    tone === "neutral"
      ? "bg-neutral-3 text-neutral-7"
      : tone === "primary"
        ? "bg-primary-5 text-primary-1"
        : STATUS_META[tone].classes;
  return (
    <div className="rounded-2xl border border-neutral-4 bg-neutral-1 p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${classes}`}
        >
          <Icon icon={icon} width={15} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold tracking-wide text-neutral-6 uppercase">
            {label}
          </p>
          <p className="text-h6 font-semibold text-neutral-8">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusChips({
  value,
  onChange,
}: {
  value: ApplicationStatus | "all";
  onChange: (value: ApplicationStatus | "all") => void;
}) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-neutral-4 bg-neutral-2 p-1 text-xs">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`shrink-0 rounded-lg px-2.5 py-1 font-semibold transition ${
          value === "all"
            ? "bg-primary-1 text-white shadow-sm"
            : "text-neutral-7 hover:bg-neutral-3"
        }`}
      >
        Toutes
      </button>
      {STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => onChange(status)}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition ${
            value === status
              ? "bg-primary-1 text-white shadow-sm"
              : "text-neutral-7 hover:bg-neutral-3"
          }`}
        >
          <Icon icon={STATUS_META[status].icon} width={12} />
          {STATUS_META[status].label}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status?: ApplicationStatus }) {
  if (!status) return <span className="text-neutral-5">Non renseigné</span>;
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.classes}`}
    >
      <Icon icon={meta.icon} width={10} />
      {meta.label}
    </span>
  );
}

function PaymentBadge({ status }: { status?: PaymentStatus | string }) {
  if (!status) return <span className="text-neutral-5">Non renseigné</span>;
  const meta = PAYMENT_META[status] || {
    label: status,
    classes: "bg-neutral-3 text-neutral-7",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.classes}`}
    >
      <Icon icon="solar:card-bold" width={10} />
      {meta.label}
    </span>
  );
}

function ApplicationsTable({
  rows,
  isAdmin,
  onOpen,
}: {
  rows: ApplicationRow[];
  isAdmin: boolean;
  onOpen: (row: ApplicationRow) => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-neutral-4 bg-neutral-1 shadow-sm lg:block">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="border-b border-neutral-4 bg-neutral-2">
          <tr>
            <th className="px-4 py-3 text-xs font-semibold tracking-wide text-neutral-6 uppercase">
              Candidat
            </th>
            <th className="px-4 py-3 text-xs font-semibold tracking-wide text-neutral-6 uppercase">
              Programme
            </th>
            <th className="px-4 py-3 text-xs font-semibold tracking-wide text-neutral-6 uppercase">
              Statut
            </th>
            <th className="px-4 py-3 text-xs font-semibold tracking-wide text-neutral-6 uppercase">
              Soumis
            </th>
            <th className="px-4 py-3 text-xs font-semibold tracking-wide text-neutral-6 uppercase">
              Paiement
            </th>
            <th className="px-4 py-3 text-xs font-semibold tracking-wide text-neutral-6 uppercase">
              Reviewer
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-neutral-6 uppercase">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-neutral-4 last:border-0 hover:bg-neutral-2/70"
            >
              <td className="px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-8">
                    {getStudentLabel(row.student)}
                  </p>
                  <p className="truncate text-xs text-neutral-6">
                    {row.student?.email || "Email non renseigné"}
                  </p>
                </div>
              </td>
              <td className="px-4 py-3 text-neutral-8">{getProgramLabel(row)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3">
                <p className="text-neutral-8">{relativeDate(row.applied_at)}</p>
                <p className="text-xs text-neutral-5">{formatDate(row.applied_at)}</p>
              </td>
              <td className="px-4 py-3">
                <PaymentBadge status={row.payment_status} />
                <p className="mt-1 text-[11px] text-neutral-5">
                  {FUNDING_LABELS[row.funding_type || ""] || "Financement non renseigné"}
                </p>
              </td>
              <td className="px-4 py-3 text-neutral-7">
                {getReviewerLabel(row.reviewed_by)}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  className="inline-flex items-center gap-1 rounded-xl border border-neutral-4 px-3 py-1.5 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
                >
                  <Icon icon="solar:eye-bold" width={12} />
                  {isAdmin ? "Voir / revoir" : "Voir dossier"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApplicationsCards({
  rows,
  isAdmin,
  onOpen,
}: {
  rows: ApplicationRow[];
  isAdmin: boolean;
  onOpen: (row: ApplicationRow) => void;
}) {
  return (
    <ul className="grid gap-3 lg:hidden">
      {rows.map((row) => (
        <li
          key={row.id}
          className="rounded-2xl border border-neutral-4 bg-neutral-1 p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-neutral-8">
                {getStudentLabel(row.student)}
              </p>
              <p className="truncate text-xs text-neutral-6">
                {row.student?.email || "Email non renseigné"}
              </p>
            </div>
            <StatusBadge status={row.status} />
          </div>
          <div className="mt-3 space-y-2 text-xs text-neutral-6">
            <p>
              <span className="font-semibold text-neutral-7">Programme : </span>
              {getProgramLabel(row)}
            </p>
            <p>
              <span className="font-semibold text-neutral-7">Soumis : </span>
              {relativeDate(row.applied_at)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <PaymentBadge status={row.payment_status} />
              <span>
                {FUNDING_LABELS[row.funding_type || ""] ||
                  "Financement non renseigné"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpen(row)}
            className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-neutral-4 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
          >
            <Icon icon="solar:eye-bold" width={12} />
            {isAdmin ? "Voir / revoir" : "Voir dossier"}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ApplicationDrawer({
  row,
  tab,
  onTabChange,
  onClose,
  isAdmin,
  reviewStatus,
  setReviewStatus,
  reviewPending,
  reviewError,
  onReview,
  progress,
  progressLoading,
  progressError,
}: {
  row: ApplicationRow | null;
  tab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
  isAdmin: boolean;
  reviewStatus: ApplicationStatus;
  setReviewStatus: (status: ApplicationStatus) => void;
  reviewPending: boolean;
  reviewError: string | null;
  onReview: () => void;
  progress: ApplicationProgressResponse | null;
  progressLoading: boolean;
  progressError: string | null;
}) {
  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-neutral-4 bg-neutral-1 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-neutral-4 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={row.status} />
                <span className="rounded-full border border-neutral-4 bg-neutral-2 px-2 py-0.5 text-[11px] text-neutral-6">
                  Candidature #{row.id}
                </span>
              </div>
              <h2 className="text-h6 font-semibold text-neutral-8">
                {getStudentLabel(row.student)}
              </h2>
              <p className="mt-1 truncate text-xs text-neutral-6">
                {getProgramLabel(row)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-6 hover:bg-neutral-3"
              aria-label="Fermer"
            >
              <Icon icon="solar:close-bold" width={18} />
            </button>
          </div>

          <nav className="mt-4 inline-flex rounded-2xl border border-neutral-4 bg-neutral-2 p-1 text-xs">
            <button
              type="button"
              onClick={() => onTabChange("summary")}
              className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                tab === "summary"
                  ? "bg-primary-1 text-white"
                  : "text-neutral-7 hover:bg-neutral-3"
              }`}
            >
              Dossier
            </button>
            <button
              type="button"
              onClick={() => onTabChange("progress")}
              className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                tab === "progress"
                  ? "bg-primary-1 text-white"
                  : "text-neutral-7 hover:bg-neutral-3"
              }`}
            >
              Parcours
            </button>
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "summary" ? (
            <div className="space-y-5">
              <section className="grid gap-3 sm:grid-cols-2">
                <InfoCard label="Candidat" value={getStudentLabel(row.student)} />
                <InfoCard label="Email" value={row.student?.email || "Non renseigné"} />
                <InfoCard label="Programme" value={getProgramLabel(row)} />
                <InfoCard label="Soumis le" value={formatDate(row.applied_at)} />
                <InfoCard label="Reviewer" value={getReviewerLabel(row.reviewed_by)} />
                <InfoCard label="Revu le" value={formatDate(row.review_at)} />
              </section>

              <section className="rounded-2xl border border-neutral-4 bg-neutral-2 p-4">
                <h3 className="text-small font-semibold text-neutral-8">Motivation</h3>
                <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-small text-neutral-7">
                  {row.motivation || "Non renseignée"}
                </p>
              </section>

              <section className="rounded-2xl border border-neutral-4 bg-neutral-2 p-4">
                <h3 className="text-small font-semibold text-neutral-8">
                  Parcours professionnel
                </h3>
                <p className="mt-2 text-small text-neutral-7">
                  <span className="font-semibold">Profession actuelle : </span>
                  {row.current_profession || "Non renseignée"}
                </p>
                <pre className="mt-3 max-h-52 overflow-auto rounded-xl border border-neutral-4 bg-neutral-1 p-3 text-xs wrap-break-word text-neutral-7">
                  {stringifyValue(row.employment_history)}
                </pre>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-neutral-4 bg-neutral-2 p-4">
                  <h3 className="text-small font-semibold text-neutral-8">
                    Financement
                  </h3>
                  <p className="mt-2 text-small text-neutral-7">
                    {FUNDING_LABELS[row.funding_type || ""] ||
                      "Financement non renseigné"}
                  </p>
                  {row.scholarship_justification ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-neutral-6">
                      {row.scholarship_justification}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-neutral-4 bg-neutral-2 p-4">
                  <h3 className="text-small font-semibold text-neutral-8">
                    Paiement
                  </h3>
                  <div className="mt-2">
                    <PaymentBadge status={row.payment_status} />
                  </div>
                  {row.payment_provider_ref ? (
                    <p className="mt-2 text-xs text-neutral-6">
                      Réf. {row.payment_provider_ref}
                    </p>
                  ) : null}
                  {row.payment_receipt_url ? (
                    <a
                      href={row.payment_receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-1"
                    >
                      <Icon icon="solar:document-text-bold" width={12} />
                      Voir le reçu
                    </a>
                  ) : null}
                </div>
              </section>

              {isAdmin ? (
                <section className="rounded-2xl border border-primary-3 bg-primary-5/50 p-4">
                  <h3 className="text-small font-semibold text-neutral-8">
                    Revue admin
                  </h3>
                  <p className="mt-1 text-xs text-neutral-6">
                    Le changement de statut déclenche les notifications prévues côté
                    backend.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <select
                      value={reviewStatus}
                      onChange={(event) =>
                        setReviewStatus(event.target.value as ApplicationStatus)
                      }
                      className="rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-small text-neutral-8 focus:border-primary-3 focus:outline-none"
                      title="Statut de revue"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={onReview}
                      disabled={reviewPending || reviewStatus === row.status}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-1 px-4 py-2 text-small font-semibold text-white transition hover:bg-primary-2 disabled:opacity-50"
                    >
                      <Icon
                        icon={
                          reviewPending
                            ? "svg-spinners:90-ring-with-bg"
                            : "solar:diskette-bold"
                        }
                        width={14}
                      />
                      Enregistrer
                    </button>
                  </div>
                  {reviewError ? (
                    <p className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-300">
                      {reviewError}
                    </p>
                  ) : null}
                </section>
              ) : (
                <section className="rounded-2xl border border-neutral-4 bg-neutral-2 p-4 text-small text-neutral-6">
                  <Icon icon="solar:info-circle-bold" width={14} className="mr-1 inline" />
                  La revue de statut est réservée aux administrateurs.
                </section>
              )}
            </div>
          ) : (
            <ProgressPanel
              progress={progress}
              loading={progressLoading}
              error={progressError}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-4 bg-neutral-2 p-3">
      <p className="text-[11px] font-semibold tracking-wide text-neutral-6 uppercase">
        {label}
      </p>
      <p className="mt-1 text-small font-medium text-neutral-8">{value}</p>
    </div>
  );
}

function ProgressPanel({
  progress,
  loading,
  error,
}: {
  progress: ApplicationProgressResponse | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-small text-red-600 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="rounded-2xl border border-neutral-4 bg-neutral-2 p-6 text-center text-small text-neutral-6">
        Ouvrez cet onglet pour charger la progression.
      </div>
    );
  }

  const summary = progress.summary;
  const modules = progress.modules || [];

  return (
    <div className="space-y-4">
      {summary ? (
        <section className="rounded-2xl border border-neutral-4 bg-neutral-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-small font-semibold text-neutral-8">
                Progression globale
              </h3>
              <p className="text-xs text-neutral-6">
                {summary.completed_modules ?? 0}/{summary.total_modules ?? 0} modules
                terminés
              </p>
            </div>
            <span className="text-h5 font-semibold text-primary-1">
              {summary.progress_percent ?? 0}%
            </span>
          </div>
          <progress
            className="mt-3 h-2 w-full overflow-hidden rounded-full accent-primary-1"
            max={100}
            value={Math.min(Math.max(summary.progress_percent ?? 0, 0), 100)}
            aria-label="Progression globale"
          />
          {summary.overall_status ? (
            <p className="mt-2 text-xs text-neutral-6">{summary.overall_status}</p>
          ) : null}
        </section>
      ) : null}

      {modules.length > 0 ? (
        <ul className="space-y-2">
          {modules.map((mod, index) => (
            <li
              key={mod.id || mod.module_id || index}
              className="rounded-2xl border border-neutral-4 bg-neutral-2 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-8">
                    {mod.title || `Module #${mod.module_id || mod.id || index + 1}`}
                  </p>
                  <p className="text-xs text-neutral-6">
                    {mod.status || (mod.completed ? "Terminé" : "En cours")}
                  </p>
                </div>
                <span className="rounded-full bg-primary-5 px-2 py-0.5 text-xs font-semibold text-primary-1">
                  {mod.progress_percent ?? (mod.completed ? 100 : 0)}%
                </span>
              </div>
              {mod.quizzes?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {mod.quizzes.map((quiz) => (
                    <span
                      key={quiz.quiz_id || quiz.title}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                        quiz.passed
                          ? "bg-green-500/10 text-green-700 dark:text-green-300"
                          : "bg-neutral-3 text-neutral-7"
                      }`}
                    >
                      <Icon
                        icon={
                          quiz.passed
                            ? "solar:check-circle-bold"
                            : "solar:question-circle-linear"
                        }
                        width={10}
                      />
                      {quiz.title || "Quiz"} · {quiz.best_score_percent ?? 0}%
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-2 p-6 text-center text-small text-neutral-6">
          Aucun module de progression retourné.
        </div>
      )}
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2"
        />
      ))}
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: { status?: number; message: string };
  onRetry: () => void;
}) {
  if (error.status === 403) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-8 text-center">
        <Icon
          icon="solar:lock-keyhole-bold"
          width={28}
          className="mx-auto text-red-600 dark:text-red-300"
        />
        <h2 className="mt-3 text-h6 font-semibold text-red-600 dark:text-red-300">
          Accès refusé
        </h2>
        <p className="mt-1 text-small text-red-600/80 dark:text-red-200">
          Votre rôle n’a pas accès à la liste des candidatures dans l’API actuelle.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-8 text-center">
      <Icon
        icon="solar:danger-triangle-bold"
        width={28}
        className="mx-auto text-red-600 dark:text-red-300"
      />
      <h2 className="mt-3 text-h6 font-semibold text-red-600 dark:text-red-300">
        Chargement impossible
      </h2>
      <p className="mt-1 text-small text-red-600/80 dark:text-red-200">
        {error.message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/25 dark:text-red-300"
      >
        <Icon icon="solar:refresh-circle-linear" width={14} />
        Réessayer
      </button>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-1 px-4 py-12 text-center">
      <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-3 text-neutral-6">
        <Icon icon="solar:folder-open-bold" width={22} />
      </span>
      <h2 className="text-h6 font-semibold text-neutral-8">
        {hasFilters
          ? "Aucune candidature ne correspond aux filtres."
          : "Aucune candidature pour le moment."}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-small text-neutral-6">
        {hasFilters
          ? "Ajustez les filtres ou la recherche pour élargir les résultats."
          : "Les nouveaux dossiers soumis par les apprenants apparaîtront ici."}
      </p>
    </div>
  );
}
