"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import {
  listModules,
  type ModuleSummary,
} from "@/services/moduleService";
import {
  updateProgram,
  type Program,
  type ProgramModuleEntry,
  type ProgramModuleWriteEntry,
} from "@/services/programService";

type Props = {
  program: Program;
  canEdit: boolean;
  onSaved: (next: Program) => void;
};

type DraftRow = {
  _key: string;
  module_id: number;
  order: number;
  start_date: string;
  end_date: string;
  length_in_weeks: number;
};

type FieldErrors = Record<string, string[]>;

function generateKey(): string {
  return `pmrow-${Math.random().toString(36).slice(2, 9)}`;
}

function moduleLabel(
  module: ModuleSummary | null | undefined,
  fallbackId?: number,
): string {
  if (module?.title?.trim()) return module.title;
  if (typeof fallbackId === "number") return `Module #${fallbackId}`;
  return "Module";
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function entryToDraft(entry: ProgramModuleEntry, index: number): DraftRow {
  const moduleId =
    typeof entry.module === "number"
      ? entry.module
      : entry.module_details?.id ?? 0;
  return {
    _key: generateKey(),
    module_id: moduleId,
    order: typeof entry.order === "number" ? entry.order : index + 1,
    start_date: entry.start_date ?? "",
    end_date: entry.end_date ?? "",
    length_in_weeks: entry.length_in_weeks ?? 1,
  };
}

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

export default function ProgramModulesEditor({
  program,
  canEdit,
  onSaved,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [catalog, setCatalog] = useState<ModuleSummary[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const moduleIndex = useMemo(() => {
    const map = new Map<number, ModuleSummary>();
    for (const mod of catalog) map.set(mod.id, mod);
    if (program.modules) {
      for (const entry of program.modules) {
        if (entry.module_details) {
          map.set(entry.module_details.id, entry.module_details);
        }
      }
    }
    return map;
  }, [catalog, program.modules]);

  // Hydrate la liste lecture
  const readonlyEntries = useMemo(() => {
    return [...(program.modules ?? [])].sort((a, b) => {
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }, [program.modules]);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- chargement du catalogue à l'ouverture de l'édition */
    setCatalogLoading(true);
    setCatalogError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    listModules()
      .then((data) => {
        if (cancelled) return;
        setCatalog(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setCatalogError(
          err instanceof Error
            ? err.message
            : "Catalogue de modules indisponible.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editing]);

  function startEdit() {
    setRows(readonlyEntries.map((entry, index) => entryToDraft(entry, index)));
    setErrors({});
    setErrorMessage(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setRows([]);
  }

  function reindex(list: DraftRow[]): DraftRow[] {
    return list.map((row, index) => ({ ...row, order: index + 1 }));
  }

  function addRow(moduleId?: number) {
    setRows((prev) =>
      reindex([
        ...prev,
        {
          _key: generateKey(),
          module_id: moduleId ?? 0,
          order: prev.length + 1,
          start_date: "",
          end_date: "",
          length_in_weeks: 1,
        },
      ]),
    );
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((prev) =>
      prev.map((row) => (row._key === key ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(key: string) {
    setRows((prev) => reindex(prev.filter((row) => row._key !== key)));
  }

  function moveRow(key: string, direction: -1 | 1) {
    setRows((prev) => {
      const index = prev.findIndex((row) => row._key === key);
      if (index < 0) return prev;
      const next = index + direction;
      if (next < 0 || next >= prev.length) return prev;
      const copy = prev.slice();
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return reindex(copy);
    });
  }

  async function handleSave() {
    setErrors({});
    setErrorMessage(null);

    const usedModuleIds = new Set<number>();
    for (const row of rows) {
      if (!row.module_id) {
        setErrorMessage("Sélectionnez un module pour chaque ligne.");
        return;
      }
      if (usedModuleIds.has(row.module_id)) {
        setErrorMessage("Un même module ne peut apparaître qu'une fois.");
        return;
      }
      usedModuleIds.add(row.module_id);
      if (!row.length_in_weeks || row.length_in_weeks < 1) {
        setErrorMessage("La durée d'un module doit être d'au moins 1 semaine.");
        return;
      }
      if (
        row.start_date &&
        row.end_date &&
        new Date(row.end_date).getTime() < new Date(row.start_date).getTime()
      ) {
        setErrorMessage(
          "La date de fin d'un module doit être postérieure à sa date de début.",
        );
        return;
      }
    }

    const payload: ProgramModuleWriteEntry[] = rows.map((row) => ({
      module_id: row.module_id,
      order: row.order,
      start_date: row.start_date || undefined,
      end_date: row.end_date || undefined,
      length_in_weeks: row.length_in_weeks,
    }));

    setPending(true);
    try {
      const saved = await updateProgram(program.id, {
        program_modules: payload,
      });
      onSaved(saved);
      setEditing(false);
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

  const fieldError = (key: string): string | null => {
    const list = errors[key];
    return list && list.length ? list.join(" • ") : null;
  };

  if (!editing) {
    return (
      <section className="rounded-2xl border border-neutral-4 bg-neutral-1 shadow-sm">
        <header className="flex flex-col gap-2 border-b border-neutral-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-h6 font-semibold text-neutral-8">
              Parcours du programme
            </h2>
            <p className="text-xs text-neutral-5">
              Modules associés via <code>program_modules</code>. Les dates de
              cohorte sont configurées par programme.
            </p>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
            >
              <Icon icon="solar:pen-2-linear" width={14} />
              Modifier le parcours
            </button>
          ) : null}
        </header>

        {readonlyEntries.length === 0 ? (
          <div className="px-4 py-8 text-center text-small text-neutral-6">
            Aucun module associé pour l&apos;instant.
            {canEdit ? (
              <p className="mt-1 text-xs text-neutral-5">
                Cliquez sur «&nbsp;Modifier le parcours&nbsp;» pour ajouter des
                modules depuis votre catalogue.
              </p>
            ) : null}
          </div>
        ) : (
          <ol className="divide-y divide-neutral-4">
            {readonlyEntries.map((entry, index) => {
              const moduleData = entry.module_details;
              return (
                <li
                  key={entry.id ?? `${entry.module}-${index}`}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-4 bg-neutral-2 text-xs font-semibold text-neutral-7">
                      {entry.order ?? index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-small font-semibold text-neutral-8">
                        {moduleLabel(
                          moduleData,
                          typeof entry.module === "number"
                            ? entry.module
                            : undefined,
                        )}
                      </p>
                      <p className="text-xs text-neutral-5">
                        Durée&nbsp;: {entry.length_in_weeks ?? 1} sem.
                        {entry.start_date
                          ? ` • Démarre le ${fmtDate(entry.start_date)}`
                          : ""}
                        {entry.end_date
                          ? ` • Fin ${fmtDate(entry.end_date)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-primary-3 bg-neutral-1 shadow-sm ring-1 ring-primary-3/30">
      <header className="flex flex-col gap-2 border-b border-neutral-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-h6 font-semibold text-neutral-8">
            Édition du parcours
          </h2>
          <p className="text-xs text-neutral-5">
            La sauvegarde remplace les liens <code>ProgramModule</code> existants.
            Pas de mélange avec <code>module_ids</code>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={cancelEdit}
            className="rounded-xl border border-neutral-4 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <Icon icon="svg-spinners:90-ring-with-bg" width={14} />
            ) : (
              <Icon icon="solar:diskette-bold" width={14} />
            )}
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </header>

      <div className="space-y-3 px-4 py-4">
        {errorMessage ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-small text-red-600 dark:text-red-300">
            {errorMessage}
          </div>
        ) : null}

        {fieldError("program_modules") ? (
          <p className="text-xs text-red-600 dark:text-red-300">
            {fieldError("program_modules")}
          </p>
        ) : null}

        {catalogError ? (
          <p className="text-xs text-amber-600 dark:text-amber-300">
            {catalogError}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-4 bg-neutral-2 px-4 py-6 text-center text-small text-neutral-6">
            Aucun module sélectionné. Ajoutez votre premier module ci-dessous.
          </div>
        ) : (
          <ol className="space-y-2">
            {rows.map((row, index) => {
              const usedIds = new Set(
                rows
                  .filter((r) => r._key !== row._key)
                  .map((r) => r.module_id)
                  .filter(Boolean),
              );
              const moduleData = moduleIndex.get(row.module_id);
              return (
                <li
                  key={row._key}
                  className="rounded-xl border border-neutral-4 bg-neutral-2 p-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-1 text-xs font-semibold text-white">
                      {row.order}
                    </span>
                    <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                      <label className="flex flex-col gap-1 text-xs text-neutral-7">
                        <span>Module</span>
                        <select
                          value={row.module_id}
                          onChange={(event) =>
                            updateRow(row._key, {
                              module_id: Number(event.target.value),
                            })
                          }
                          className="rounded-lg border border-neutral-4 bg-neutral-1 px-2 py-1.5 text-small text-neutral-8 focus:border-primary-3 focus:outline-none"
                        >
                          <option value={0}>— Sélectionnez —</option>
                          {moduleData && !catalog.some((m) => m.id === moduleData.id)
                            ? (
                                <option value={moduleData.id}>
                                  {moduleLabel(moduleData)}
                                </option>
                              )
                            : null}
                          {catalog.map((catalogModule) => (
                            <option
                              key={catalogModule.id}
                              value={catalogModule.id}
                              disabled={usedIds.has(catalogModule.id)}
                            >
                              {moduleLabel(catalogModule)}
                            </option>
                          ))}
                        </select>
                        {catalogLoading ? (
                          <span className="text-[11px] text-neutral-5">
                            Chargement du catalogue…
                          </span>
                        ) : null}
                      </label>

                      <label className="flex flex-col gap-1 text-xs text-neutral-7">
                        <span>Début (optionnel)</span>
                        <input
                          type="date"
                          value={row.start_date}
                          onChange={(event) =>
                            updateRow(row._key, {
                              start_date: event.target.value,
                            })
                          }
                          className="rounded-lg border border-neutral-4 bg-neutral-1 px-2 py-1.5 text-small text-neutral-8 focus:border-primary-3 focus:outline-none"
                        />
                      </label>

                      <label className="flex flex-col gap-1 text-xs text-neutral-7">
                        <span>Fin (optionnel)</span>
                        <input
                          type="date"
                          value={row.end_date}
                          onChange={(event) =>
                            updateRow(row._key, {
                              end_date: event.target.value,
                            })
                          }
                          className="rounded-lg border border-neutral-4 bg-neutral-1 px-2 py-1.5 text-small text-neutral-8 focus:border-primary-3 focus:outline-none"
                        />
                      </label>

                      <label className="flex flex-col gap-1 text-xs text-neutral-7">
                        <span>Sem.</span>
                        <input
                          type="number"
                          min={1}
                          value={row.length_in_weeks}
                          onChange={(event) =>
                            updateRow(row._key, {
                              length_in_weeks: Number(event.target.value),
                            })
                          }
                          className="w-20 rounded-lg border border-neutral-4 bg-neutral-1 px-2 py-1.5 text-small text-neutral-8 focus:border-primary-3 focus:outline-none"
                        />
                      </label>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => moveRow(row._key, -1)}
                        disabled={index === 0}
                        className="rounded-lg border border-neutral-4 bg-neutral-1 p-1.5 text-neutral-7 transition hover:bg-neutral-3 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Monter"
                      >
                        <Icon icon="solar:alt-arrow-up-linear" width={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRow(row._key, 1)}
                        disabled={index === rows.length - 1}
                        className="rounded-lg border border-neutral-4 bg-neutral-1 p-1.5 text-neutral-7 transition hover:bg-neutral-3 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Descendre"
                      >
                        <Icon icon="solar:alt-arrow-down-linear" width={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(row._key)}
                        className="rounded-lg border border-red-500/30 bg-red-500/5 p-1.5 text-red-600 transition hover:bg-red-500/10 dark:text-red-300"
                        aria-label="Supprimer"
                      >
                        <Icon icon="solar:trash-bin-trash-linear" width={12} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addRow()}
            className="inline-flex items-center gap-1 rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
          >
            <Icon icon="solar:add-circle-linear" width={14} />
            Ajouter un module
          </button>
          {catalog.length > 0 ? (
            <p className="text-[11px] text-neutral-5">
              {catalog.length} module(s) disponibles dans votre catalogue.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
