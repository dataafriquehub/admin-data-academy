"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import {
  createBlogPost,
  slugifyTitle,
  tagsToString,
  updateBlogPost,
  uploadFile,
  type BlogPost,
  type BlogPostStatus,
  type BlogPostWritePayload,
} from "@/services/blogService";

type Props = {
  open: boolean;
  postId: number | null;
  initial?: BlogPost | null;
  onClose: () => void;
  onSaved: (saved: BlogPost) => void;
};

type FieldErrors = Record<string, string[]>;

const INPUT_CLASS =
  "w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 transition focus:border-primary-3 focus:bg-neutral-1 focus:outline-none";

function extractFieldErrors(payload: unknown): {
  fields: FieldErrors;
  message: string | null;
} {
  if (!payload || typeof payload !== "object") {
    return { fields: {}, message: null };
  }
  const fields: FieldErrors = {};
  let nonField: string | null = null;
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      fields[key] = value.map((v) => String(v));
    } else if (typeof value === "string") {
      fields[key] = [value];
    }
  }
  if (fields.detail?.length) nonField = fields.detail[0];
  if (fields.non_field_errors?.length) nonField = fields.non_field_errors[0];
  return { fields, message: nonField };
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-small text-neutral-7">
      <span>
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-300">{error}</span>
      ) : null}
    </label>
  );
}

export default function BlogPostFormDrawer({
  open,
  postId,
  initial,
  onClose,
  onSaved,
}: Props) {
  const mode: "create" | "edit" = postId ? "edit" : "create";

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<BlogPostStatus>("draft");
  const [featured, setFeatured] = useState(false);
  const [tags, setTags] = useState("");
  const [authorDisplayName, setAuthorDisplayName] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setErrorMessage(null);
    setCoverError(null);
    setCoverUploading(false);
    setSlugTouched(Boolean(initial?.slug));

    setTitle(initial?.title ?? "");
    setSlug(initial?.slug ?? "");
    setExcerpt(initial?.excerpt ?? "");
    setBody(initial?.body ?? "");
    setStatus(initial?.status ?? "draft");
    setFeatured(initial?.featured ?? false);
    setTags(tagsToString(initial?.tags));
    setAuthorDisplayName(initial?.author_display_name ?? "");
    setMetaTitle(initial?.meta_title ?? "");
    setMetaDescription(initial?.meta_description ?? "");
    setCoverUrl(initial?.cover_image_url ?? "");
    setCoverPreview(initial?.cover_image_url ?? null);
  }, [open, initial]);

  useEffect(() => {
    if (!open || slugTouched || mode === "edit") return;
    setSlug(slugifyTitle(title));
  }, [title, open, slugTouched, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const fieldError = (key: string): string | null => {
    const list = errors[key];
    return list?.length ? list.join(" • ") : null;
  };

  const canSubmit = useMemo(
    () => title.trim() && body.trim() && slug.trim(),
    [title, body, slug],
  );

  async function handleCoverFile(file: File | null) {
    if (!file) return;
    setCoverError(null);
    setCoverUploading(true);
    try {
      const uploaded = await uploadFile(file);
      setCoverUrl(uploaded.url);
      setCoverPreview(uploaded.url);
    } catch (err) {
      setCoverError(
        err instanceof Error ? err.message : "Échec du téléversement.",
      );
    } finally {
      setCoverUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    const payload: BlogPostWritePayload = {
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim(),
      body: body.trim(),
      cover_image_url: coverUrl.trim() || null,
      author_display_name: authorDisplayName.trim(),
      status,
      featured,
      tags: tags.trim(),
      meta_title: metaTitle.trim() || title.trim(),
      meta_description: metaDescription.trim() || excerpt.trim(),
    };

    setPending(true);
    try {
      const saved =
        mode === "edit" && postId
          ? await updateBlogPost(postId, payload)
          : await createBlogPost(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const { fields, message } = extractFieldErrors(err.payload);
        setErrors(fields);
        setErrorMessage(message ?? err.message);
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : "Enregistrement impossible.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Fermer le panneau"
        onClick={onClose}
        className="flex-1 bg-black/40 backdrop-blur-sm"
      />
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-neutral-4 bg-neutral-1 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-4 px-5 py-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-neutral-5 uppercase">
              {mode === "edit" ? "Modifier l'article" : "Nouvel article"}
            </p>
            <h2 className="text-h5 font-semibold text-neutral-8">
              {mode === "edit" ? title || "Article" : "Publication blog"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-6 transition hover:bg-neutral-3 hover:text-neutral-8"
            aria-label="Fermer"
          >
            <Icon icon="solar:close-bold" width={18} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5"
        >
          {errorMessage ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-small text-red-600 dark:text-red-300">
              {errorMessage}
            </div>
          ) : null}

          <fieldset className="flex flex-col gap-3">
            <legend className="text-xs font-semibold tracking-wide text-neutral-5 uppercase">
              Contenu
            </legend>

            <Field label="Titre" error={fieldError("title")} required>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Titre de l'article"
              />
            </Field>

            <Field label="Slug (URL)" error={fieldError("slug")} required>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                className={INPUT_CLASS}
                placeholder="mon-article"
              />
            </Field>

            <Field label="Résumé" error={fieldError("excerpt")}>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={3}
                className={`${INPUT_CLASS} resize-y`}
                placeholder="Court résumé pour la liste et le SEO"
              />
            </Field>

            <Field label="Corps de l'article" error={fieldError("body")} required>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className={`${INPUT_CLASS} resize-y font-mono text-xs`}
                placeholder="Paragraphes séparés par une ligne vide…"
              />
            </Field>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-xs font-semibold tracking-wide text-neutral-5 uppercase">
              Publication
            </legend>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Statut" error={fieldError("status")}>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as BlogPostStatus)
                  }
                  className={INPUT_CLASS}
                  title="Statut"
                >
                  <option value="draft">Brouillon</option>
                  <option value="published">Publié</option>
                </select>
              </Field>
              <Field label="Nom affiché (auteur)" error={fieldError("author_display_name")}>
                <input
                  type="text"
                  value={authorDisplayName}
                  onChange={(e) => setAuthorDisplayName(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Optionnel"
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-small text-neutral-7">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="rounded border-neutral-4"
              />
              Mettre à la une sur le blog public
            </label>

            <Field label="Tags" error={fieldError("tags")}>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className={INPUT_CLASS}
                placeholder="data science, carrière"
              />
            </Field>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-xs font-semibold tracking-wide text-neutral-5 uppercase">
              Couverture & SEO
            </legend>

            {coverPreview ? (
              <div className="overflow-hidden rounded-xl border border-neutral-4 bg-neutral-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverPreview}
                  alt="Aperçu couverture"
                  className="aspect-video w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-neutral-4 bg-neutral-2 text-neutral-5">
                <Icon icon="solar:gallery-bold" width={28} />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs font-semibold text-neutral-7 hover:bg-neutral-3">
                <Icon icon="solar:upload-bold" width={14} />
                {coverUploading ? "Envoi…" : "Téléverser"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={coverUploading}
                  onChange={(e) => void handleCoverFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            {coverError ? (
              <p className="text-xs text-red-600">{coverError}</p>
            ) : null}

            <Field label="URL couverture" error={fieldError("cover_image_url")}>
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => {
                  setCoverUrl(e.target.value);
                  setCoverPreview(e.target.value || null);
                }}
                className={INPUT_CLASS}
                placeholder="https://…"
              />
            </Field>

            <Field label="Meta title" error={fieldError("meta_title")}>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Par défaut : titre"
              />
            </Field>

            <Field label="Meta description" error={fieldError("meta_description")}>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={2}
                className={`${INPUT_CLASS} resize-y`}
                placeholder="Par défaut : résumé"
              />
            </Field>
          </fieldset>

          <div className="mt-auto flex items-center justify-end gap-2 border-t border-neutral-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-4 px-4 py-2 text-xs font-semibold text-neutral-7 hover:bg-neutral-3"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending || !canSubmit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2 disabled:opacity-50"
            >
              {pending ? (
                <Icon icon="solar:refresh-bold" width={14} className="animate-spin" />
              ) : (
                <Icon icon="solar:diskette-bold" width={14} />
              )}
              {pending
                ? "Enregistrement…"
                : mode === "edit"
                  ? "Enregistrer"
                  : "Créer l'article"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
