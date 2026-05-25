"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import {
  createCategory,
  slugifyLabel,
  updateCategory,
  type Category,
  type CategoryWritePayload,
} from "@/services/categoryService";

type Props = {
  open: boolean;
  categoryId: number | null;
  initial?: Category | null;
  onClose: () => void;
  onSaved: (saved: Category) => void;
};

type FieldErrors = Record<string, string[]>;

const INPUT_CLASS =
  "w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 transition focus:border-primary-3 focus:bg-neutral-1 focus:outline-none";

const ICON_OPTIONS = [
  "BarChart3",
  "Brain",
  "Code2",
  "Cloud",
  "Shield",
  "Database",
  "Smartphone",
  "TrendingUp",
  "BookOpen",
] as const;

const COLOR_PRESETS: { value: string; label: string }[] = [
  { value: "bg-orange-50 text-orange-600", label: "Orange" },
  { value: "bg-blue-50 text-blue-600", label: "Bleu" },
  { value: "bg-purple-50 text-purple-600", label: "Violet" },
  { value: "bg-sky-50 text-sky-600", label: "Ciel" },
  { value: "bg-red-50 text-red-600", label: "Rouge" },
  { value: "bg-green-50 text-green-600", label: "Vert" },
  { value: "bg-yellow-50 text-yellow-600", label: "Jaune" },
  { value: "bg-indigo-50 text-indigo-600", label: "Indigo" },
];

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

export default function CategoryFormDrawer({
  open,
  categoryId,
  initial,
  onClose,
  onSaved,
}: Props) {
  const mode: "create" | "edit" = categoryId ? "edit" : "create";

  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string>("BookOpen");
  const [color, setColor] = useState(COLOR_PRESETS[0].value);
  const [order, setOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setErrorMessage(null);
    setSlugTouched(Boolean(initial?.slug));

    setLabel(initial?.label ?? "");
    setSlug(initial?.slug ?? "");
    setDescription(initial?.description ?? "");
    setIcon(initial?.icon ?? "BookOpen");
    setColor(initial?.color ?? COLOR_PRESETS[0].value);
    setOrder(initial?.order ?? 0);
    setIsActive(initial?.is_active ?? true);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const suggestedSlug = useMemo(() => slugifyLabel(label), [label]);

  useEffect(() => {
    if (!open || slugTouched) return;
    setSlug(suggestedSlug);
  }, [open, suggestedSlug, slugTouched]);

  const fieldError = (key: string): string | null => {
    const list = errors[key];
    return list?.length ? list.join(" • ") : null;
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setErrorMessage(null);

    if (!label.trim()) {
      setErrors({ label: ["Le libellé est obligatoire."] });
      return;
    }
    const finalSlug = (slug.trim() || suggestedSlug).toLowerCase();
    if (!finalSlug) {
      setErrors({ slug: ["Le slug est obligatoire."] });
      return;
    }

    const payload: CategoryWritePayload = {
      label: label.trim(),
      slug: finalSlug,
      description: description.trim(),
      icon,
      color,
      order: Math.max(0, order),
      is_active: isActive,
    };

    setPending(true);
    try {
      const saved =
        mode === "edit" && categoryId
          ? await updateCategory(categoryId, payload)
          : await createCategory(payload);
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
      <div className="flex h-full w-full max-w-lg flex-col border-l border-neutral-4 bg-neutral-1 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-4 px-5 py-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-neutral-5 uppercase">
              {mode === "edit" ? "Modifier la catégorie" : "Nouvelle catégorie"}
            </p>
            <h2 className="text-h5 font-semibold text-neutral-8">
              {mode === "edit" ? label || "Catégorie" : "Catalogue programmes"}
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
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
        >
          {errorMessage ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-small text-red-600 dark:text-red-300">
              {errorMessage}
            </div>
          ) : null}

          <Field label="Libellé" error={fieldError("label")} required>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Ex. Science des données"
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
              placeholder="data-science"
            />
            <span className="text-xs text-neutral-5">
              Utilisé sur la landing : /programs/categorie/
              {slug || "…"}
            </span>
          </Field>

          <Field label="Description" error={fieldError("description")}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${INPUT_CLASS} resize-y`}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Icône (Lucide)" error={fieldError("icon")} required>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className={INPUT_CLASS}
                title="Icône"
              >
                {ICON_OPTIONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Couleur (Tailwind)" error={fieldError("color")}>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className={INPUT_CLASS}
                title="Couleur"
              >
                {COLOR_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Ordre d'affichage" error={fieldError("order")}>
            <input
              type="number"
              min={0}
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              className={INPUT_CLASS}
              title="Ordre"
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-small text-neutral-7">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-neutral-4"
            />
            Catégorie active (visible sur la landing)
          </label>

          <div className="mt-auto flex flex-col-reverse gap-2 border-t border-neutral-4 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-4 px-4 py-2 text-small font-semibold text-neutral-7 transition hover:bg-neutral-3"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary-1 px-4 py-2 text-small font-semibold text-white shadow-sm transition hover:bg-primary-2 disabled:opacity-60"
            >
              {pending ? (
                <Icon icon="svg-spinners:90-ring-with-bg" width={14} />
              ) : (
                <Icon
                  icon={
                    mode === "edit"
                      ? "solar:diskette-bold"
                      : "solar:add-circle-bold"
                  }
                  width={14}
                />
              )}
              {pending
                ? "Enregistrement…"
                : mode === "edit"
                  ? "Enregistrer"
                  : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
