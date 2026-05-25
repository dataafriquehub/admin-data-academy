"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import ConfirmAction from "@/components/ConfirmAction";
import BlogPostFormDrawer from "@/components/blog/BlogPostFormDrawer";
import {
  blogPostIsEditableBy,
  deleteBlogPost,
  listBlogPosts,
  type BlogPost,
  type BlogPostStatus,
} from "@/services/blogService";

type StatusFilter = "all" | BlogPostStatus;
type SortKey = "updated_desc" | "updated_asc" | "title_asc" | "title_desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated_desc", label: "Récents en premier" },
  { value: "updated_asc", label: "Anciens en premier" },
  { value: "title_asc", label: "Titre A → Z" },
  { value: "title_desc", label: "Titre Z → A" },
];

const STATUS_META: Record<
  BlogPostStatus,
  { label: string; icon: string; classes: string }
> = {
  draft: {
    label: "Brouillon",
    icon: "solar:document-bold",
    classes:
      "border-neutral-500/30 bg-neutral-500/10 text-neutral-700 dark:text-neutral-300",
  },
  published: {
    label: "Publié",
    icon: "solar:check-circle-bold",
    classes:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

function normalize(value: string | undefined | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getPublicPostUrl(slug: string): string | null {
  const base = process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/blog/${slug}`;
}

export default function BlogScreen() {
  const { user, ready } = useAuth();
  const role = user?.role;
  const isAdmin = role === "admin";
  const isCreator = role === "program_creator";
  const canAccess = isAdmin || isCreator;
  const canCreate = canAccess;

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("updated_desc");

  const [formOpen, setFormOpen] = useState(false);
  const [formPost, setFormPost] = useState<BlogPost | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [actionMessage, setActionMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBlogPosts();
      setPosts(data);
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
      setLoading(false);
      return;
    }
    void loadPosts();
  }, [ready, canAccess, loadPosts]);

  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!actionMessage) return;
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setActionMessage(null), 5000);
    return () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, [actionMessage]);

  const canEdit = useCallback(
    (post: BlogPost) => blogPostIsEditableBy(post, user),
    [user],
  );

  const kpis = useMemo(() => {
    let published = 0;
    let draft = 0;
    let featured = 0;
    for (const p of posts) {
      if (p.status === "published") published += 1;
      else draft += 1;
      if (p.featured) featured += 1;
    }
    return { total: posts.length, published, draft, featured };
  }, [posts]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    let list = posts.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      const hay = normalize(
        [p.title, p.excerpt, p.slug, p.author_name, ...(p.tags ?? [])].join(" "),
      );
      return hay.includes(q);
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "title_asc":
          return a.title.localeCompare(b.title, "fr");
        case "title_desc":
          return b.title.localeCompare(a.title, "fr");
        case "updated_asc":
          return (
            new Date(a.updated_at ?? 0).getTime() -
            new Date(b.updated_at ?? 0).getTime()
          );
        default:
          return (
            new Date(b.updated_at ?? 0).getTime() -
            new Date(a.updated_at ?? 0).getTime()
          );
      }
    });
    return list;
  }, [posts, search, statusFilter, sort]);

  function openCreate() {
    setFormPost(null);
    setFormOpen(true);
  }

  function openEdit(post: BlogPost) {
    setFormPost(post);
    setFormOpen(true);
  }

  function handleSaved(saved: BlogPost) {
    setPosts((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setActionMessage({
      kind: "success",
      text: `Article « ${saved.title} » enregistré.`,
    });
  }

  function handleDelete(post: BlogPost) {
    if (!canEdit(post)) return;
    setDeleteTarget(post);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBlogPost(deleteTarget.id);
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setActionMessage({
        kind: "success",
        text: "Article supprimé.",
      });
    } catch (err) {
      setActionMessage({
        kind: "error",
        text:
          err instanceof ApiError && err.status === 403
            ? "Suppression refusée."
            : err instanceof Error
              ? err.message
              : "Suppression impossible.",
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
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
          <h1 className="text-h5 font-semibold text-neutral-8">Blog réservé</h1>
          <p className="mt-2 text-small text-neutral-6">
            La gestion du blog est limitée aux administrateurs et aux concepteurs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-h4 font-semibold text-neutral-8">Blog</h1>
          <p className="mt-1 text-small text-neutral-6">
            Articles publiés sur la landing Data Afrique Hub.
          </p>
          {isCreator && !isAdmin ? (
            <p className="mt-1 text-xs text-neutral-5">
              Vous ne voyez que vos propres articles — comportement normal côté
              API.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadPosts()}
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
              Nouvel article
            </button>
          ) : null}
        </div>
      </header>

      <section
        aria-label="Indicateurs"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <KpiPill icon="solar:notebook-bold" label="Total" value={kpis.total} tone="neutral" />
        <KpiPill
          icon="solar:check-circle-bold"
          label="Publiés"
          value={kpis.published}
          tone="success"
        />
        <KpiPill
          icon="solar:document-bold"
          label="Brouillons"
          value={kpis.draft}
          tone="warning"
        />
        <KpiPill
          icon="solar:star-bold"
          label="À la une"
          value={kpis.featured}
          tone="primary"
        />
      </section>

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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (titre, résumé, tags)…"
              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-9 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs text-neutral-8 focus:border-primary-3 focus:outline-none"
              title="Filtrer par statut"
            >
              <option value="all">Tous les statuts</option>
              <option value="published">Publiés</option>
              <option value="draft">Brouillons</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs text-neutral-8 focus:border-primary-3 focus:outline-none"
              title="Trier"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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
          />
          <span>{actionMessage.text}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="text-small text-red-600 dark:text-red-300">
            {error.message}
          </p>
          <button
            type="button"
            onClick={() => loadPosts()}
            className="mt-3 text-xs font-semibold text-primary-1 hover:underline"
          >
            Réessayer
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-1 p-12 text-center">
          <Icon
            icon="solar:notebook-bold"
            width={40}
            className="mx-auto text-neutral-5"
          />
          <p className="mt-3 text-small text-neutral-6">
            {posts.length === 0
              ? "Aucun article pour le moment."
              : "Aucun article ne correspond aux filtres."}
          </p>
          {canCreate && posts.length === 0 ? (
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-4 py-2 text-xs font-semibold text-white"
            >
              <Icon icon="solar:add-circle-bold" width={14} />
              Créer le premier article
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((post) => (
            <BlogPostCard
              key={post.id}
              post={post}
              canEdit={canEdit(post)}
              onEdit={() => openEdit(post)}
              onDelete={() => handleDelete(post)}
            />
          ))}
        </ul>
      )}

      <BlogPostFormDrawer
        open={formOpen}
        postId={formPost?.id ?? null}
        initial={formPost}
        onClose={() => {
          setFormOpen(false);
          setFormPost(null);
        }}
        onSaved={handleSaved}
      />

      <ConfirmAction
        isOpen={Boolean(deleteTarget)}
        title="Supprimer cet article ?"
        description={
          deleteTarget
            ? `« ${deleteTarget.title} » sera supprimé définitivement.`
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
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-neutral-6 uppercase">
          {label}
        </p>
        <p className="text-h6 font-semibold text-neutral-8">{value}</p>
      </div>
    </div>
  );
}

function BlogPostCard({
  post,
  canEdit,
  onEdit,
  onDelete,
}: {
  post: BlogPost;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = STATUS_META[post.status];
  const publicUrl =
    post.status === "published" ? getPublicPostUrl(post.slug) : null;

  return (
    <li className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-4 bg-neutral-1 shadow-sm transition hover:border-primary-3">
      {post.cover_image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={post.cover_image_url}
          alt=""
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-neutral-2 text-neutral-5">
          <Icon icon="solar:gallery-bold" width={28} />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.classes}`}
          >
            <Icon icon={status.icon} width={10} />
            {status.label}
          </span>
          {post.featured ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              <Icon icon="solar:star-bold" width={10} />
              À la une
            </span>
          ) : null}
        </div>

        <h2 className="text-small font-semibold text-neutral-8">{post.title}</h2>
        {post.excerpt ? (
          <p className="line-clamp-2 text-xs text-neutral-6">{post.excerpt}</p>
        ) : null}

        <p className="text-[11px] text-neutral-5">
          {post.author_name} · {formatDate(post.published_at ?? post.updated_at)}
        </p>

        {post.tags?.length ? (
          <div className="flex flex-wrap gap-1">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-2 px-2 py-0.5 text-[10px] text-neutral-6"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-neutral-4 pt-3">
          {publicUrl ? (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-1 hover:underline"
            >
              <Icon icon="solar:link-round-bold" width={12} />
              Voir en ligne
            </a>
          ) : null}
          {canEdit ? (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-4 px-2 py-1 text-[11px] font-semibold text-neutral-7 hover:bg-neutral-3"
              >
                <Icon icon="solar:pen-bold" width={12} />
                Modifier
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-500/10"
              >
                <Icon icon="solar:trash-bin-trash-bold" width={12} />
                Supprimer
              </button>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}
