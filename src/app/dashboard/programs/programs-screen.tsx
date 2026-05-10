"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import ConfirmAction from "@/components/ConfirmAction";
import ProgramFormDrawer from "@/components/programs/ProgramFormDrawer";
import {
  deleteProgram,
  listPrograms,
  programIsEditableBy,
  updateProgram,
  type Program,
  type ValidationStatus,
} from "@/services/programService";

type StatusFilter = "all" | ValidationStatus;
type SortKey =
  | "updated_desc"
  | "updated_asc"
  | "title_asc"
  | "title_desc"
  | "start_asc"
  | "start_desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated_desc", label: "Récents en premier" },
  { value: "updated_asc", label: "Anciens en premier" },
  { value: "title_asc", label: "Titre A → Z" },
  { value: "title_desc", label: "Titre Z → A" },
  { value: "start_asc", label: "Début proche" },
  { value: "start_desc", label: "Début lointain" },
];

const STATUS_META: Record<
  ValidationStatus,
  { label: string; icon: string; classes: string }
> = {
  pending: {
    label: "En attente",
    icon: "solar:clock-circle-bold",
    classes:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  approved: {
    label: "En ligne",
    icon: "solar:check-circle-bold",
    classes:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejeté",
    icon: "solar:close-circle-bold",
    classes: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300",
  },
};

function normalize(value: string | undefined | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function formatDateRange(start: string, end: string): string {
  const fmt = (value: string) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  return `${fmt(start)} → ${fmt(end)}`;
}

function formatPrice(price: string, currency?: string | null): string {
  if (!price) return "Prix non renseigné";
  const num = Number(price);
  if (Number.isNaN(num)) return `${price} ${currency || ""}`.trim();
  if (num <= 0) return "Gratuit";
  return `${num.toLocaleString("fr-FR")} ${currency || ""}`.trim();
}

function userLabel(user?: Program["creator"]): string {
  if (!user) return "Auteur non renseigné";
  return (
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.email ||
    `Utilisateur #${user.id}`
  );
}

export default function ProgramsScreen() {
  const { user, ready } = useAuth();
  const role = user?.role;
  const isAdmin = role === "admin";
  const isCreator = role === "program_creator";
  const isMentor = role === "mentor";
  const canAccess = isAdmin || isCreator || isMentor;
  const canCreate = isAdmin || isCreator;

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tagFilter, setTagFilter] = useState<string | "all">("all");
  const [sort, setSort] = useState<SortKey>("updated_desc");

  const [formOpen, setFormOpen] = useState(false);
  const [formProgram, setFormProgram] = useState<Program | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Program | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [validatingId, setValidatingId] = useState<number | null>(null);

  const [actionMessage, setActionMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPrograms();
      setPrograms(data);
    } catch (err) {
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
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!canAccess) {
      /* eslint-disable react-hooks/set-state-in-effect -- pas d'API si rôle non autorisé */
      setLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    void loadPrograms();
  }, [ready, canAccess, loadPrograms]);

  useEffect(() => {
    if (!actionMessage) return;
    const id = setTimeout(() => setActionMessage(null), 4500);
    return () => clearTimeout(id);
  }, [actionMessage]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const p of programs) {
      if (p.tag) set.add(p.tag);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [programs]);

  const kpis = useMemo(() => {
    const counts: Record<ValidationStatus, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    for (const p of programs) {
      if (p.validation_status) counts[p.validation_status] += 1;
    }
    return { total: programs.length, ...counts };
  }, [programs]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return programs
      .filter((p) => {
        if (statusFilter !== "all" && p.validation_status !== statusFilter)
          return false;
        if (tagFilter !== "all" && p.tag !== tagFilter) return false;
        if (q) {
          const haystack = [p.title, p.tag, p.description]
            .map(normalize)
            .join(" ");
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sort) {
          case "title_asc":
            return (a.title || "").localeCompare(b.title || "");
          case "title_desc":
            return (b.title || "").localeCompare(a.title || "");
          case "start_asc":
            return (a.start_date || "").localeCompare(b.start_date || "");
          case "start_desc":
            return (b.start_date || "").localeCompare(a.start_date || "");
          case "updated_asc":
            return (
              new Date(a.updated_at || 0).getTime() -
              new Date(b.updated_at || 0).getTime()
            );
          case "updated_desc":
          default:
            return (
              new Date(b.updated_at || 0).getTime() -
              new Date(a.updated_at || 0).getTime()
            );
        }
      });
  }, [programs, search, statusFilter, tagFilter, sort]);

  function openCreate() {
    setFormProgram(null);
    setFormOpen(true);
  }

  function openEdit(program: Program) {
    setFormProgram(program);
    setFormOpen(true);
  }

  function handleSaved(saved: Program) {
    setPrograms((prev) => {
      const existing = prev.findIndex((p) => p.id === saved.id);
      if (existing >= 0) {
        const next = prev.slice();
        next[existing] = { ...prev[existing], ...saved };
        return next;
      }
      return [saved, ...prev];
    });
    setActionMessage({
      kind: "success",
      text: formProgram
        ? "Programme mis à jour."
        : "Programme créé. Vous pouvez maintenant rattacher des modules.",
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProgram(deleteTarget.id);
      setPrograms((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setActionMessage({ kind: "success", text: "Programme supprimé." });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Suppression impossible.";
      setActionMessage({ kind: "error", text: message });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function describeApiError(err: unknown, fallback: string): string {
    if (err instanceof ApiError) {
      if (err.status >= 500)
        return `Erreur serveur (${err.status}). Réessayez plus tard ou contactez l'équipe technique.`;
      return err.message || fallback;
    }
    return err instanceof Error ? err.message : fallback;
  }

  async function quickApprove(program: Program) {
    setValidatingId(program.id);
    try {
      const saved = await updateProgram(program.id, {
        validation_status: "approved",
      });
      setPrograms((prev) =>
        prev.map((item) =>
          item.id === saved.id ? { ...item, ...saved } : item,
        ),
      );
      setActionMessage({
        kind: "success",
        text: `« ${program.title} » a été approuvé.`,
      });
    } catch (err) {
      setActionMessage({
        kind: "error",
        text: describeApiError(err, "Approbation impossible."),
      });
    } finally {
      setValidatingId(null);
    }
  }

  async function quickUnapprove(program: Program) {
    setValidatingId(program.id);
    try {
      const saved = await updateProgram(program.id, {
        validation_status: "pending",
      });
      setPrograms((prev) =>
        prev.map((item) =>
          item.id === saved.id ? { ...item, ...saved } : item,
        ),
      );
      setActionMessage({
        kind: "success",
        text: `« ${program.title} » a été repassé en attente.`,
      });
    } catch (err) {
      setActionMessage({
        kind: "error",
        text: describeApiError(err, "Désapprobation impossible."),
      });
    } finally {
      setValidatingId(null);
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

  if (!canAccess) {
    return (
      <div className="px-4 py-10 lg:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-neutral-4 bg-neutral-1 p-8 text-center shadow-sm">
          <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-3 text-neutral-6">
            <Icon icon="solar:lock-keyhole-bold" width={22} />
          </span>
          <h1 className="text-h5 font-semibold text-neutral-8">
            Catalogue programmes restreint
          </h1>
          <p className="mt-2 text-small text-neutral-6">
            Cette console est réservée aux équipes pédagogiques (admin,
            concepteur, mentor).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h4 font-semibold text-neutral-8">Programmes</h1>
            {isCreator ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-3 bg-primary-5 px-2 py-0.5 text-[11px] font-semibold text-primary-1">
                <Icon icon="solar:user-bold" width={10} />
                Vos programmes
              </span>
            ) : isMentor ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-neutral-4 bg-neutral-2 px-2 py-0.5 text-[11px] font-semibold text-neutral-7">
                <Icon icon="solar:eye-bold" width={10} />
                Lecture seule
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-small text-neutral-6">
            Offre de formation et validation catalogue.
          </p>
          {isCreator ? (
            <p className="mt-1 text-xs text-neutral-5">
              Toute modification d&apos;un programme déjà publié le repassera
              automatiquement en{" "}
              <span className="font-semibold text-neutral-7">en attente</span>{" "}
              côté API.
            </p>
          ) : null}
          {isMentor ? (
            <p className="mt-1 text-xs text-neutral-5">
              Vous voyez uniquement les programmes publiés (<em>approved</em>).
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadPrograms()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3 disabled:opacity-50"
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
          {canCreate ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2"
            >
              <Icon icon="solar:add-circle-bold" width={14} />
              Nouveau programme
            </button>
          ) : null}
        </div>
      </header>

      {actionMessage ? (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-small ${
            actionMessage.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300"
          }`}
        >
          <Icon
            icon={
              actionMessage.kind === "success"
                ? "solar:check-circle-bold"
                : "solar:danger-triangle-bold"
            }
            width={16}
            className="mt-0.5 shrink-0"
          />
          <p>{actionMessage.text}</p>
        </div>
      ) : null}

      {/* KPI */}
      <section
        aria-label="Indicateurs"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <KpiPill
          icon="solar:clipboard-list-bold"
          label="Total"
          value={kpis.total}
          tone="neutral"
        />
        <KpiPill
          icon={STATUS_META.approved.icon}
          label={STATUS_META.approved.label}
          value={kpis.approved}
          tone="success"
        />
        <KpiPill
          icon={STATUS_META.pending.icon}
          label={STATUS_META.pending.label}
          value={kpis.pending}
          tone="warning"
        />
        <KpiPill
          icon={STATUS_META.rejected.icon}
          label={STATUS_META.rejected.label}
          value={kpis.rejected}
          tone="danger"
        />
      </section>

      {/* Toolbar */}
      <section className="rounded-2xl border border-neutral-4 bg-neutral-1 p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Icon
              icon="solar:magnifer-linear"
              width={14}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-neutral-5"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher (titre, tag, description)…"
              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-9 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusChips value={statusFilter} onChange={setStatusFilter} />

            <label htmlFor="programs-tag" className="sr-only">
              Tag
            </label>
            <select
              id="programs-tag"
              value={tagFilter}
              onChange={(event) =>
                setTagFilter(
                  event.target.value === "all" ? "all" : event.target.value,
                )
              }
              className="rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs text-neutral-8 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
              title="Filtrer par tag"
            >
              <option value="all">Tous les tags</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>

            <label htmlFor="programs-sort" className="sr-only">
              Trier
            </label>
            <select
              id="programs-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs text-neutral-8 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
              title="Trier"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {(search ||
              statusFilter !== "all" ||
              tagFilter !== "all" ||
              sort !== "updated_desc") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setTagFilter("all");
                  setSort("updated_desc");
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-neutral-4 px-3 py-2 text-xs text-neutral-7 hover:bg-neutral-3"
              >
                <Icon icon="solar:close-circle-linear" width={12} />
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Body */}
      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <ErrorState
          status={error.status}
          message={error.message}
          onRetry={() => loadPrograms()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          hasPrograms={programs.length > 0}
          canCreate={canCreate}
          onCreate={openCreate}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              showCreator={isAdmin}
              canEdit={programIsEditableBy(program, user)}
              canValidate={isAdmin}
              validating={validatingId === program.id}
              onApprove={() => void quickApprove(program)}
              onUnapprove={() => void quickUnapprove(program)}
              onEdit={() => openEdit(program)}
              onDelete={() => setDeleteTarget(program)}
            />
          ))}
        </ul>
      )}

      <ProgramFormDrawer
        open={formOpen}
        programId={formProgram?.id ?? null}
        initial={formProgram}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmAction
        isOpen={Boolean(deleteTarget)}
        title="Supprimer ce programme ?"
        description={
          deleteTarget
            ? `« ${deleteTarget.title} » sera retiré du catalogue. Cette action est irréversible.`
            : ""
        }
        confirmLabel={deleting ? "Suppression…" : "Supprimer"}
        cancelLabel="Annuler"
        variant="danger"
        icon="solar:trash-bin-trash-bold"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function KpiPill({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClasses = {
    neutral: "bg-neutral-3 text-neutral-7",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    danger: "bg-red-500/15 text-red-600 dark:text-red-300",
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-4 bg-neutral-1 p-3 shadow-sm">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses}`}
      >
        <Icon icon={icon} width={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-neutral-6 uppercase">
          {label}
        </p>
        <p className="text-h6 font-semibold text-neutral-8">{value}</p>
      </div>
    </div>
  );
}

function StatusChips({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  const options: { id: StatusFilter; label: string; icon?: string }[] = [
    { id: "all", label: "Tous" },
    {
      id: "approved",
      label: STATUS_META.approved.label,
      icon: STATUS_META.approved.icon,
    },
    {
      id: "pending",
      label: STATUS_META.pending.label,
      icon: STATUS_META.pending.icon,
    },
    {
      id: "rejected",
      label: STATUS_META.rejected.label,
      icon: STATUS_META.rejected.icon,
    },
  ];
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-neutral-4 bg-neutral-2 p-1 text-xs">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition ${
            value === option.id
              ? "bg-primary-1 text-white shadow-sm"
              : "text-neutral-7 hover:bg-neutral-3"
          }`}
        >
          {option.icon ? <Icon icon={option.icon} width={12} /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ProgramCard({
  program,
  showCreator,
  canEdit,
  canValidate,
  validating,
  onApprove,
  onUnapprove,
  onEdit,
  onDelete,
}: {
  program: Program;
  showCreator: boolean;
  canEdit: boolean;
  canValidate: boolean;
  validating: boolean;
  onApprove: () => void;
  onUnapprove: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = program.validation_status;
  const meta = status ? STATUS_META[status] : null;
  const modulesCount = program.modules?.length ?? 0;

  return (
    <li className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-4 bg-neutral-1 shadow-sm transition hover:border-primary-3">
      <Link
        href={`/dashboard/programs/${program.id}`}
        className="block"
        aria-label={`Ouvrir ${program.title}`}
      >
        {program.cover_url ? (
          /* eslint-disable-next-line @next/next/no-img-element -- couverture distante non maîtrisée */
          <img
            src={program.cover_url}
            alt={program.title}
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-neutral-2 text-neutral-5">
            <Icon icon="solar:gallery-bold" width={28} />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/dashboard/programs/${program.id}`}
            className="min-w-0 text-left"
          >
            <p className="text-small font-semibold wrap-break-word text-neutral-8 hover:text-primary-1">
              {program.title || "Programme sans titre"}
            </p>
            {program.tag ? (
              <p className="mt-1 text-[11px] font-semibold tracking-wide text-neutral-6 uppercase">
                {program.tag}
              </p>
            ) : null}
          </Link>
          {meta ? (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.classes}`}
            >
              <Icon icon={meta.icon} width={10} />
              {meta.label}
            </span>
          ) : null}
        </div>

        {program.description ? (
          <p className="line-clamp-2 text-xs text-neutral-6">
            {program.description}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-4 bg-neutral-2 px-2 py-0.5 text-neutral-7">
            <Icon icon="solar:calendar-bold" width={10} />
            {program.length_in_weeks} sem.
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-4 bg-neutral-2 px-2 py-0.5 text-neutral-7">
            <Icon icon="solar:wallet-money-bold" width={10} />
            {formatPrice(program.price, program.currency)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-4 bg-neutral-2 px-2 py-0.5 text-neutral-7">
            <Icon icon="solar:layers-bold" width={10} />
            {modulesCount} module{modulesCount > 1 ? "s" : ""}
          </span>
        </div>

        <p className="text-[11px] text-neutral-5">
          {formatDateRange(program.start_date, program.end_date)}
        </p>

        {showCreator ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-6">
            <Icon icon="solar:user-bold" width={10} />
            <span className="truncate">{userLabel(program.creator)}</span>
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center justify-end gap-1.5 pt-3">
          {canValidate && status !== "approved" ? (
            <button
              type="button"
              onClick={onApprove}
              disabled={validating}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon
                icon={
                  validating
                    ? "svg-spinners:90-ring-with-bg"
                    : "solar:check-circle-bold"
                }
                width={12}
              />
              {validating ? "Approbation…" : "Approuver"}
            </button>
          ) : null}
          {canValidate && status === "approved" ? (
            <button
              type="button"
              onClick={onUnapprove}
              disabled={validating}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-300"
            >
              <Icon
                icon={
                  validating
                    ? "svg-spinners:90-ring-with-bg"
                    : "solar:clock-circle-bold"
                }
                width={12}
              />
              {validating ? "Changement…" : "Désapprouver"}
            </button>
          ) : null}
          {canEdit ? (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-4 px-2.5 py-1.5 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
              >
                <Icon icon="solar:pen-2-linear" width={12} />
                Modifier
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500/10 dark:text-red-300"
              >
                <Icon icon="solar:trash-bin-trash-linear" width={12} />
                Supprimer
              </button>
            </>
          ) : null}
          <Link
            href={`/dashboard/programs/${program.id}`}
            className="inline-flex items-center gap-1 rounded-lg bg-primary-1 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2"
          >
            <Icon icon="solar:eye-bold" width={12} />
            Ouvrir
          </Link>
        </div>
      </div>
    </li>
  );
}

function SkeletonGrid() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <li
          key={index}
          className="h-72 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2"
        />
      ))}
    </ul>
  );
}

function EmptyState({
  hasPrograms,
  canCreate,
  onCreate,
}: {
  hasPrograms: boolean;
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-1 px-4 py-12 text-center">
      <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-3 text-neutral-6">
        <Icon icon="solar:clipboard-list-bold" width={22} />
      </span>
      <h2 className="text-h6 font-semibold text-neutral-8">
        {hasPrograms
          ? "Aucun programme ne correspond aux filtres."
          : "Aucun programme dans le catalogue."}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-small text-neutral-6">
        {hasPrograms
          ? "Ajustez votre recherche ou réinitialisez les filtres."
          : "Créez votre premier programme et associez-y des modules pour bâtir une offre."}
      </p>
      {!hasPrograms && canCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2"
        >
          <Icon icon="solar:add-circle-bold" width={14} />
          Nouveau programme
        </button>
      ) : null}
    </div>
  );
}

function ErrorState({
  status,
  message,
  onRetry,
}: {
  status?: number;
  message: string;
  onRetry: () => void;
}) {
  if (status === 403) {
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
          Vous n&apos;avez pas accès au catalogue programmes.
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
        {message}
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
