"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import { listCategories, type Category } from "@/services/categoryService";
import {
  createProgram,
  updateProgram,
  uploadFile,
  type Currency,
  type Program,
  type ProgramWritePayload,
} from "@/services/programService";

type Props = {
  open: boolean;
  programId: number | null;
  initial?: Program | null;
  onClose: () => void;
  onSaved: (saved: Program) => void;
};

type FieldErrors = Record<string, string[]>;

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
  { value: "XOF", label: "XOF" },
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
    } else if (value && typeof value === "object") {
      try {
        fields[key] = [JSON.stringify(value)];
      } catch {
        fields[key] = [String(value)];
      }
    }
  }
  if (fields.detail?.length) nonField = fields.detail[0];
  if (fields.non_field_errors?.length) nonField = fields.non_field_errors[0];
  return { fields, message: nonField };
}

export default function ProgramFormDrawer({
  open,
  programId,
  initial,
  onClose,
  onSaved,
}: Props) {
  const mode: "create" | "edit" = programId ? "edit" : "create";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [lengthInWeeks, setLengthInWeeks] = useState<number>(8);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [price, setPrice] = useState("0");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- hydratation à l'ouverture */
    setErrors({});
    setErrorMessage(null);
    setCoverError(null);
    setCoverUploading(false);

    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setCategoryId(initial?.category?.id ?? "");
    setLengthInWeeks(initial?.length_in_weeks ?? 8);
    setStartDate(initial?.start_date ?? "");
    setEndDate(initial?.end_date ?? "");
    setPrice(initial?.price ?? "0");
    setCurrency((initial?.currency as Currency) ?? "EUR");
    setCoverUrl(initial?.cover_url ?? "");
    setCoverPreview(initial?.cover_url ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCategoriesLoading(true);
    listCategories()
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !initial || categoryId !== "") return;
    const match = categories.find((c) => c.slug === initial.tag);
    if (match) setCategoryId(match.id);
  }, [open, initial, categories, categoryId]);

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
    return list && list.length ? list.join(" • ") : null;
  };

  const datesInvalid = useMemo(() => {
    if (!startDate || !endDate) return false;
    return new Date(endDate).getTime() < new Date(startDate).getTime();
  }, [startDate, endDate]);

  async function handlePickCoverFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCoverError("Seules les images sont acceptées.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setCoverError("L'image doit faire moins de 4 Mo.");
      return;
    }
    setCoverError(null);
    setCoverUploading(true);
    try {
      const uploaded = await uploadFile(file, {
        folder: "programs",
        resourceType: "image",
      });
      setCoverUrl(uploaded.url);
      setCoverPreview(uploaded.url);
    } catch (err) {
      setCoverError(
        err instanceof Error ? err.message : "Upload de l'image impossible.",
      );
    } finally {
      setCoverUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setErrorMessage(null);

    if (!title.trim()) {
      setErrors({ title: ["Le titre est obligatoire."] });
      return;
    }
    if (!description.trim()) {
      setErrors({ description: ["La description est obligatoire."] });
      return;
    }
    if (categoryId === "") {
      setErrors({ category_id: ["La catégorie est obligatoire."] });
      return;
    }
    if (!startDate || !endDate) {
      setErrors({
        start_date: !startDate ? ["Date de début requise."] : [],
        end_date: !endDate ? ["Date de fin requise."] : [],
      });
      return;
    }
    if (datesInvalid) {
      setErrors({
        end_date: ["La date de fin doit être postérieure au début."],
      });
      return;
    }
    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      setErrors({ price: ["Le prix doit être un nombre positif."] });
      return;
    }
    if (lengthInWeeks <= 0) {
      setErrors({ length_in_weeks: ["La durée doit être au moins 1 semaine."] });
      return;
    }

    const payload: ProgramWritePayload = {
      title: title.trim(),
      description: description.trim(),
      category_id: Number(categoryId),
      length_in_weeks: lengthInWeeks,
      start_date: startDate,
      end_date: endDate,
      price: String(numericPrice),
      currency,
      cover_url: coverUrl.trim() || null,
    };

    setPending(true);
    try {
      const saved =
        mode === "edit" && programId
          ? await updateProgram(programId, payload)
          : await createProgram(payload);
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
              {mode === "edit" ? "Modifier le programme" : "Nouveau programme"}
            </p>
            <h2 className="text-h5 font-semibold text-neutral-8">
              {mode === "edit"
                ? title || "Programme"
                : "Création d'une offre de formation"}
            </h2>
            {mode === "edit" ? (
              <p className="mt-1 text-xs text-neutral-5">
                Une modification post-validation par un concepteur repasse le
                programme en{" "}
                <span className="font-semibold text-neutral-7">en attente</span>{" "}
                côté API.
              </p>
            ) : null}
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
              Informations
            </legend>

            <Field label="Titre" error={fieldError("title")} required>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Ex. Data Engineering Bootcamp"
              />
            </Field>

            <Field label="Description" error={fieldError("description")} required>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className={`${INPUT_CLASS} resize-y`}
                placeholder="Présentez les objectifs, le public visé, etc."
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Catégorie"
                error={fieldError("category_id") ?? fieldError("tag")}
                required
              >
                <select
                  value={categoryId}
                  onChange={(e) =>
                    setCategoryId(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className={INPUT_CLASS}
                  disabled={categoriesLoading}
                  title="Catégorie du programme"
                >
                  <option value="">
                    {categoriesLoading
                      ? "Chargement…"
                      : "Sélectionner une catégorie"}
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Durée (semaines)"
                error={fieldError("length_in_weeks")}
                required
              >
                <input
                  type="number"
                  min={1}
                  value={lengthInWeeks}
                  onChange={(e) => setLengthInWeeks(Number(e.target.value))}
                  className={INPUT_CLASS}
                  title="Durée du programme en semaines"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Début" error={fieldError("start_date")} required>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={INPUT_CLASS}
                  title="Date de début du programme"
                />
              </Field>
              <Field label="Fin" error={fieldError("end_date")} required>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={INPUT_CLASS}
                  title="Date de fin du programme"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field label="Prix" error={fieldError("price")} required>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={INPUT_CLASS}
                  title="Prix du programme"
                />
              </Field>
              <Field label="Devise" error={fieldError("currency")}>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className={INPUT_CLASS}
                  title="Devise"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-xs font-semibold tracking-wide text-neutral-5 uppercase">
              Couverture
            </legend>
            <p className="text-xs text-neutral-5">
              L&apos;API <code>ProgramSerializer</code> n&apos;accepte que{" "}
              <code>cover_url</code>. Téléversez le fichier via{" "}
              <code>POST /uploads/</code> ou collez une URL absolue.
            </p>

            {coverPreview ? (
              <div className="overflow-hidden rounded-xl border border-neutral-4 bg-neutral-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview distante non maîtrisée */}
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

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3">
                <Icon
                  icon={
                    coverUploading
                      ? "svg-spinners:90-ring-with-bg"
                      : "solar:upload-linear"
                  }
                  width={14}
                />
                {coverUploading ? "Upload…" : "Téléverser une image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void handlePickCoverFile(file);
                    event.target.value = "";
                  }}
                />
              </label>
              {coverUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    setCoverUrl("");
                    setCoverPreview(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-neutral-4 px-3 py-2 text-xs text-neutral-7 hover:bg-neutral-3"
                >
                  <Icon icon="solar:trash-bin-trash-linear" width={12} />
                  Retirer
                </button>
              ) : null}
            </div>

            <Field
              label="URL de couverture"
              error={fieldError("cover_url") ?? coverError}
            >
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => {
                  setCoverUrl(e.target.value);
                  setCoverPreview(e.target.value || null);
                }}
                placeholder="https://…"
                className={INPUT_CLASS}
              />
            </Field>
          </fieldset>

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
              disabled={pending || coverUploading}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary-1 px-4 py-2 text-small font-semibold text-white shadow-sm transition hover:bg-primary-2 disabled:cursor-not-allowed disabled:opacity-60"
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
                  : "Créer le programme"}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 transition focus:border-primary-3 focus:bg-neutral-1 focus:outline-none";

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
