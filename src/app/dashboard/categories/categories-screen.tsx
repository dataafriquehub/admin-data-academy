"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import ConfirmAction from "@/components/ConfirmAction";
import CategoryFormDrawer from "@/components/categories/CategoryFormDrawer";
import {
  deleteCategory,
  listCategories,
  type Category,
} from "@/services/categoryService";

function normalize(value: string | undefined | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function getMarketingCategoryUrl(slug: string): string | null {
  const base = process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/programs/categorie/${slug}`;
}

export default function CategoriesScreen() {
  const { user, ready } = useAuth();
  const isAdmin = user?.role === "admin";

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [formCategory, setFormCategory] = useState<Category | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [actionMessage, setActionMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCategories({ activeOnly: false });
      setCategories(data);
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
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void loadCategories();
  }, [ready, isAdmin, loadCategories]);

  useEffect(() => {
    if (!actionMessage) return;
    const id = setTimeout(() => setActionMessage(null), 4500);
    return () => clearTimeout(id);
  }, [actionMessage]);

  const kpis = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let programs = 0;
    for (const c of categories) {
      if (c.is_active) active += 1;
      else inactive += 1;
      programs += c.program_count ?? 0;
    }
    return { total: categories.length, active, inactive, programs };
  }, [categories]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return categories
      .filter((c) => {
        if (!showInactive && !c.is_active) return false;
        if (!q) return true;
        const hay = normalize(
          [c.label, c.slug, c.description, c.icon].join(" "),
        );
        return hay.includes(q);
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [categories, search, showInactive]);

  function openCreate() {
    setFormCategory(null);
    setFormOpen(true);
  }

  function openEdit(cat: Category) {
    setFormCategory(cat);
    setFormOpen(true);
  }

  function handleSaved(saved: Category) {
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      }
      return [...prev, saved].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });
    setActionMessage({
      kind: "success",
      text: `Catégorie « ${saved.label} » enregistrée.`,
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCategory(deleteTarget.id);
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setActionMessage({
        kind: "success",
        text: `Catégorie « ${deleteTarget.label} » supprimée.`,
      });
      setDeleteTarget(null);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Suppression impossible.";
      setActionMessage({ kind: "error", text: msg });
    } finally {
      setDeleting(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-neutral-5">
        <Icon icon="svg-spinners:90-ring-with-bg" width={28} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-neutral-4 bg-neutral-2 p-8 text-center">
        <Icon
          icon="solar:shield-warning-bold"
          width={40}
          className="mx-auto text-amber-500"
        />
        <h1 className="mt-4 text-h5 font-semibold text-neutral-8">
          Accès réservé aux administrateurs
        </h1>
        <p className="mt-2 text-small text-neutral-6">
          La gestion des catégories catalogue est limitée au rôle admin.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h4 font-semibold text-neutral-8">Catégories</h1>
          <p className="mt-1 max-w-xl text-small text-neutral-6">
            Organisez le catalogue affiché sur la landing (filtres et pages
            /programs/categorie/…).
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl bg-primary-1 px-4 py-2.5 text-small font-semibold text-white shadow-sm transition hover:bg-primary-2"
        >
          <Icon icon="solar:add-circle-bold" width={16} />
          Nouvelle catégorie
        </button>
      </header>

      {actionMessage ? (
        <div
          className={`rounded-xl border px-4 py-3 text-small ${
            actionMessage.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          {actionMessage.text}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total" value={String(kpis.total)} icon="solar:tag-bold" />
        <KpiCard
          label="Actives"
          value={String(kpis.active)}
          icon="solar:check-circle-bold"
        />
        <KpiCard
          label="Inactives"
          value={String(kpis.inactive)}
          icon="solar:eye-closed-bold"
        />
        <KpiCard
          label="Programmes rattachés"
          value={String(kpis.programs)}
          icon="solar:clipboard-list-bold"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-4 bg-neutral-2 p-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Icon
            icon="solar:magnifer-linear"
            width={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-5"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (libellé, slug…)…"
            className="w-full rounded-xl border border-neutral-4 bg-neutral-1 py-2 pr-3 pl-9 text-small text-neutral-8 focus:border-primary-3 focus:outline-none"
          />
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-small text-neutral-7">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-neutral-4"
          />
          Afficher les inactives
        </label>
        <button
          type="button"
          onClick={() => void loadCategories()}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-neutral-4 px-3 py-2 text-xs font-semibold text-neutral-7 hover:bg-neutral-3"
        >
          <Icon icon="solar:refresh-linear" width={14} />
          Actualiser
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-small text-red-700">
          {error.status ? `[${error.status}] ` : null}
          {error.message}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16 text-neutral-5">
          <Icon icon="svg-spinners:90-ring-with-bg" width={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-4 py-16 text-center text-small text-neutral-6">
          Aucune catégorie trouvée.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-4">
          <table className="w-full min-w-[640px] border-collapse text-left text-small">
            <thead className="border-b border-neutral-4 bg-neutral-3/80 text-xs font-semibold tracking-wide text-neutral-6 uppercase">
              <tr>
                <th className="px-4 py-3">Ordre</th>
                <th className="px-4 py-3">Libellé</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Programmes</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cat) => {
                const publicUrl = getMarketingCategoryUrl(cat.slug);
                return (
                  <tr
                    key={cat.id}
                    className="border-b border-neutral-4/80 last:border-0 hover:bg-neutral-3/50"
                  >
                    <td className="px-4 py-3 text-neutral-6">{cat.order ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${cat.color ?? "bg-neutral-3 text-neutral-7"}`}
                        >
                          {cat.icon?.slice(0, 2) ?? "—"}
                        </span>
                        <span className="font-semibold text-neutral-8">
                          {cat.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-6">
                      {cat.slug}
                    </td>
                    <td className="px-4 py-3 text-neutral-7">
                      {cat.program_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {cat.is_active ? (
                        <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-neutral-500/30 bg-neutral-500/10 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {publicUrl ? (
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg p-2 text-neutral-6 hover:bg-neutral-3 hover:text-primary-1"
                            title="Voir sur la landing"
                          >
                            <Icon icon="solar:link-round-linear" width={16} />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openEdit(cat)}
                          className="rounded-lg p-2 text-neutral-6 hover:bg-neutral-3 hover:text-neutral-8"
                          title="Modifier"
                        >
                          <Icon icon="solar:pen-linear" width={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cat)}
                          disabled={(cat.program_count ?? 0) > 0}
                          className="rounded-lg p-2 text-neutral-6 hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            (cat.program_count ?? 0) > 0
                              ? "Impossible : programmes rattachés"
                              : "Supprimer"
                          }
                        >
                          <Icon icon="solar:trash-bin-trash-linear" width={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CategoryFormDrawer
        open={formOpen}
        categoryId={formCategory?.id ?? null}
        initial={formCategory}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmAction
        isOpen={Boolean(deleteTarget)}
        title="Supprimer cette catégorie ?"
        description={
          deleteTarget
            ? `« ${deleteTarget.label} » sera définitivement supprimée.`
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

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-4 bg-neutral-2 p-4">
      <div className="flex items-center gap-2 text-neutral-5">
        <Icon icon={icon} width={18} />
        <span className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-neutral-8">{value}</p>
    </div>
  );
}
