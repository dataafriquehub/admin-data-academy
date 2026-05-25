"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError, apiFetch, unwrapArray } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import {
  deleteModule,
  listModules,
  type ModuleSummary,
} from "@/services/moduleService";
import ConfirmAction from "@/components/ConfirmAction";
import ModuleDetailDrawer from "@/components/modules/ModuleDetailDrawer";
import ModuleFormDrawer from "@/components/modules/ModuleFormDrawer";

type DirectoryUser = {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type SortKey = "updated_desc" | "updated_asc" | "title_asc" | "title_desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated_desc", label: "Récents en premier" },
  { value: "updated_asc", label: "Anciens en premier" },
  { value: "title_asc", label: "Titre A → Z" },
  { value: "title_desc", label: "Titre Z → A" },
];

function normalize(value: string | undefined | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function userLabel(user?: DirectoryUser, id?: number | null): string {
  if (user) {
    return (
      [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      user.username ||
      user.email ||
      `Utilisateur #${user.id}`
    );
  }
  return id ? `Utilisateur #${id}` : "Auteur non identifié";
}

function relativeDate(value: string | null | undefined): string {
  if (!value) return "Jamais mis à jour";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Jamais mis à jour";
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 30) return `Il y a ${days} jours`;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date inconnue";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date inconnue";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ModulesScreen() {
  const { user, ready } = useAuth();
  const role = user?.role;
  const isAdmin = role === "admin";
  const isProgramCreator = role === "program_creator";
  const canAccess = isAdmin || isProgramCreator;
  const canCreate = canAccess;

  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("updated_desc");
  const [authorFilter, setAuthorFilter] = useState<number | "all" | "mine">(
    "all",
  );

  const [detailId, setDetailId] = useState<number | null>(null);
  const [formId, setFormId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [actionMessage, setActionMessage] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModuleSummary | null>(null);

  const loadModules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listModules();
      setModules(data);
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
      /* eslint-disable react-hooks/set-state-in-effect -- pas d'API call si rôle non autorisé */
      setLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    void loadModules();
  }, [ready, canAccess, loadModules]);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    let cancelled = false;
    apiFetch<unknown>("/users/auth/users/")
      .then((data) => {
        if (cancelled) return;
        setUsers(unwrapArray<DirectoryUser>(data));
      })
      .catch(() => {
        /* le filtre auteur restera limité aux IDs présents dans la liste */
      });
    return () => {
      cancelled = true;
    };
  }, [ready, isAdmin]);

  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!actionMessage) return;
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setActionMessage(null), 5000);
    return () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, [actionMessage]);

  const usersById = useMemo(() => {
    const map = new Map<number, DirectoryUser>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const authorOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of modules) {
      if (m.created_by == null) continue;
      const u = usersById.get(m.created_by);
      const label = userLabel(u, m.created_by);
      if (!map.has(m.created_by)) map.set(m.created_by, label);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [modules, usersById]);

  const kpis = useMemo(() => {
    let withCover = 0;
    let totalContents = 0;
    let totalQuizzes = 0;
    for (const m of modules) {
      if (m.cover_url) withCover += 1;
      totalContents += m.contents?.length ?? 0;
      totalQuizzes += m.quizzes?.length ?? 0;
    }
    return {
      total: modules.length,
      withCover,
      totalContents,
      totalQuizzes,
    };
  }, [modules]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    const myId = user?.id;
    return modules
      .filter((m) => {
        if (authorFilter === "mine") {
          if (myId == null || m.created_by !== myId) return false;
        } else if (authorFilter !== "all") {
          if (m.created_by !== authorFilter) return false;
        }
        if (q) {
          const haystack = [m.title, m.description, m.objectives]
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
          case "updated_asc": {
            const da = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const db = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return da - db;
          }
          case "updated_desc":
          default: {
            const da = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const db = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return db - da;
          }
        }
      });
  }, [modules, search, authorFilter, sort, user]);

  function canEdit(module: ModuleSummary): boolean {
    if (isAdmin) return true;
    if (
      isProgramCreator &&
      user?.id != null &&
      module.created_by === user.id
    ) {
      return true;
    }
    return false;
  }

  function openDetail(module: ModuleSummary) {
    setDetailId(module.id);
  }

  function openCreate() {
    setFormId(null);
    setFormOpen(true);
  }

  function openEdit(module: ModuleSummary) {
    setFormId(module.id);
    setFormOpen(true);
  }

  function handleSaved(saved: ModuleSummary) {
    setModules((prev) => {
      const index = prev.findIndex((m) => m.id === saved.id);
      if (index >= 0) {
        const next = prev.slice();
        next[index] = { ...prev[index], ...saved };
        return next;
      }
      return [saved, ...prev];
    });
    setFormOpen(false);
    setFormId(null);
    setActionMessage({
      kind: "success",
      text: formId ? "Module mis à jour." : "Module créé avec succès.",
    });
  }

  function handleDelete(module: ModuleSummary) {
    setDeleteTarget(module);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const targetModule = deleteTarget;
    setDeletingId(targetModule.id);
    try {
      await deleteModule(targetModule.id);
      setModules((prev) => prev.filter((m) => m.id !== targetModule.id));
      setActionMessage({ kind: "success", text: "Module supprimé." });
      if (detailId === targetModule.id) setDetailId(null);
    } catch (err) {
      setActionMessage({
        kind: "error",
        text:
          err instanceof ApiError && err.status === 403
            ? "Suppression refusée : vous n'êtes pas le créateur de ce module."
            : err instanceof Error
              ? err.message
              : "Suppression impossible.",
      });
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }

  // ─────────── Guards ───────────

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
            Catalogue modules réservé
          </h1>
          <p className="mt-2 text-small text-neutral-6">
            L&apos;accès au catalogue est limité aux administrateurs et aux
            concepteurs de programme.
          </p>
        </div>
      </div>
    );
  }

  const detailModule = detailId
    ? modules.find((m) => m.id === detailId) || null
    : null;
  const formInitial = formId
    ? modules.find((m) => m.id === formId) || null
    : null;

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h4 font-semibold text-neutral-8">Modules</h1>
            {isProgramCreator ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-3 bg-primary-5 px-2 py-0.5 text-[11px] font-semibold text-primary-1">
                <Icon icon="solar:user-bold" width={10} />
                Vos modules
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-small text-neutral-6">
            Catalogue de modules de formation — contenus et évaluations
            réutilisables.
          </p>
          {isProgramCreator ? (
            <p className="mt-1 text-xs text-neutral-5">
              Vous voyez uniquement les modules dont vous êtes l&apos;auteur ;
              c&apos;est normal côté API.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadModules()}
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
              Nouveau module
            </button>
          ) : null}
        </div>
      </header>

      {/* KPI */}
      <section
        aria-label="Indicateurs"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <KpiPill
          icon="solar:layers-bold"
          label="Total"
          value={kpis.total}
          tone="neutral"
        />
        <KpiPill
          icon="solar:gallery-bold"
          label="Avec couverture"
          value={kpis.withCover}
          tone="primary"
        />
        <KpiPill
          icon="solar:document-text-bold"
          label="Contenus"
          value={kpis.totalContents}
          tone="success"
          hint="Tous modules confondus"
        />
        <KpiPill
          icon="solar:question-circle-bold"
          label="Quiz"
          value={kpis.totalQuizzes}
          tone="warning"
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
              placeholder="Rechercher (titre, description, objectifs)…"
              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-9 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <>
                <label className="sr-only" htmlFor="modules-author">
                  Filtrer par auteur
                </label>
                <select
                  id="modules-author"
                  value={
                    authorFilter === "all"
                      ? "all"
                      : authorFilter === "mine"
                        ? "mine"
                        : String(authorFilter)
                  }
                  onChange={(event) => {
                    const v = event.target.value;
                    if (v === "all") setAuthorFilter("all");
                    else if (v === "mine") setAuthorFilter("mine");
                    else setAuthorFilter(Number(v));
                  }}
                  className="rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs text-neutral-8 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
                  title="Filtrer par auteur"
                >
                  <option value="all">Tous les auteurs</option>
                  {user?.id ? <option value="mine">Créés par moi</option> : null}
                  {authorOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            <label className="sr-only" htmlFor="modules-sort">
              Trier
            </label>
            <select
              id="modules-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs text-neutral-8 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
              title="Trier"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {(search || authorFilter !== "all" || sort !== "updated_desc") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setAuthorFilter("all");
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

      {actionMessage ? (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
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
            width={14}
            className="mt-0.5 shrink-0"
          />
          <span>{actionMessage.text}</span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="ml-auto text-neutral-5 hover:text-neutral-7"
            aria-label="Masquer"
          >
            <Icon icon="solar:close-bold" width={12} />
          </button>
        </div>
      ) : null}

      {/* Content */}
      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <ErrorState
          status={error.status}
          message={error.message}
          onRetry={() => loadModules()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          hasModules={modules.length > 0}
          canCreate={canCreate}
          onCreate={openCreate}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              creatorLabel={userLabel(
                module.created_by != null
                  ? usersById.get(module.created_by)
                  : undefined,
                module.created_by ?? null,
              )}
              canEdit={canEdit(module)}
              deleting={deletingId === module.id}
              onOpen={() => openDetail(module)}
              onEdit={() => openEdit(module)}
              onDelete={() => handleDelete(module)}
            />
          ))}
        </ul>
      )}

      <ModuleDetailDrawer
        open={detailId != null}
        moduleId={detailId}
        fallback={detailModule}
        canEdit={detailModule ? canEdit(detailModule) : false}
        canDelete={detailModule ? canEdit(detailModule) : false}
        usersById={usersById}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          if (!detailModule) return;
          setDetailId(null);
          openEdit(detailModule);
        }}
        onDelete={() => {
          if (!detailModule) return;
          void handleDelete(detailModule);
        }}
      />

      <ModuleFormDrawer
        open={formOpen}
        moduleId={formId}
        initial={formInitial}
        onClose={() => {
          setFormOpen(false);
          setFormId(null);
        }}
        onSaved={handleSaved}
      />

      <ConfirmAction
        isOpen={Boolean(deleteTarget)}
        title="Supprimer ce module ?"
        description={
          deleteTarget
            ? `« ${deleteTarget.title || `#${deleteTarget.id}`} » sera supprimé. Cette action est irréversible.`
            : ""
        }
        confirmLabel={deletingId ? "Suppression…" : "Supprimer"}
        cancelLabel="Annuler"
        variant="danger"
        icon="solar:trash-bin-trash-bold"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ────────────────────── Sub-components ──────────────────────

function KpiPill({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: string;
  label: string;
  value: number;
  hint?: string;
  tone: "neutral" | "primary" | "success" | "warning";
}) {
  const toneClasses = {
    neutral: "bg-neutral-3 text-neutral-7",
    primary: "bg-primary-5 text-primary-1",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
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
        {hint ? <p className="text-[11px] text-neutral-5">{hint}</p> : null}
      </div>
    </div>
  );
}

function ModuleCard({
  module,
  creatorLabel,
  canEdit,
  deleting,
  onOpen,
  onEdit,
  onDelete,
}: {
  module: ModuleSummary;
  creatorLabel: string;
  canEdit: boolean;
  deleting: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const contentsCount = module.contents?.length ?? 0;
  const quizzesCount = module.quizzes?.length ?? 0;
  const updated = relativeDate(module.updated_at);
  const updatedFull = formatDate(module.updated_at);

  return (
    <li className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-4 bg-neutral-1 shadow-sm transition hover:border-primary-3">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
        aria-label={`Voir le module ${module.title}`}
      >
        {module.cover_url ? (
          /* eslint-disable-next-line @next/next/no-img-element -- couverture distante */
          <img
            src={module.cover_url}
            alt={module.title || "Couverture du module"}
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-neutral-2 text-neutral-5">
            <Icon icon="solar:gallery-bold" width={28} />
          </div>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="text-left"
            aria-label={`Ouvrir le module ${module.title}`}
          >
            <p className="text-small font-semibold wrap-break-word text-neutral-8 hover:text-primary-1">
              {module.title || "Module sans titre"}
            </p>
          </button>
        </div>

        {module.description ? (
          <p className="line-clamp-2 text-xs text-neutral-6">
            {module.description}
          </p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-4 bg-neutral-2 px-2 py-0.5 text-neutral-7">
            <Icon icon="solar:document-text-bold" width={10} />
            {contentsCount} contenu{contentsCount > 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-4 bg-neutral-2 px-2 py-0.5 text-neutral-7">
            <Icon icon="solar:question-circle-bold" width={10} />
            {quizzesCount} quiz
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-6">
          <Icon icon="solar:user-bold" width={10} />
          <span className="truncate">{creatorLabel}</span>
        </div>
        <div
          className="text-[11px] text-neutral-5"
          title={`Mis à jour le ${updatedFull}`}
        >
          Mis à jour {updated}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-end gap-1.5 border-t border-neutral-4 pt-3">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-4 px-2.5 py-1.5 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
          >
            <Icon icon="solar:eye-bold" width={12} />
            Voir
          </button>
          {canEdit ? (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-4 px-2.5 py-1.5 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
              >
                <Icon icon="solar:pen-bold" width={12} />
                Modifier
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
              >
                <Icon
                  icon={
                    deleting
                      ? "svg-spinners:90-ring-with-bg"
                      : "solar:trash-bin-trash-bold"
                  }
                  width={12}
                />
                Supprimer
              </button>
            </>
          ) : null}
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
  hasModules,
  canCreate,
  onCreate,
}: {
  hasModules: boolean;
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-1 px-4 py-12 text-center">
      <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-3 text-neutral-6">
        <Icon icon="solar:layers-bold" width={22} />
      </span>
      <h2 className="text-h6 font-semibold text-neutral-8">
        {hasModules
          ? "Aucun module ne correspond aux filtres."
          : "Aucun module dans le catalogue."}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-small text-neutral-6">
        {hasModules
          ? "Ajustez votre recherche ou réinitialisez les filtres pour voir plus de résultats."
          : "Commencez par créer votre premier module — il pourra ensuite être réutilisé dans plusieurs programmes."}
      </p>
      {!hasModules && canCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2"
        >
          <Icon icon="solar:add-circle-bold" width={14} />
          Nouveau module
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
          Le catalogue de modules est réservé aux administrateurs et concepteurs.
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
