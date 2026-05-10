"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError, apiFetch, unwrapArray } from "@/lib/api";
import {
  createSession,
  updateSession,
  type Session,
  type SessionPayload,
} from "@/services/mentorshipService";

type ProgramOption = {
  id: number;
  title?: string;
};

type MentorOption = {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: string;
};

type Props = {
  open: boolean;
  session: Session | null;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (session: Session) => void;
};

type FieldErrors = Record<string, string[]>;

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
      fields[key] = [JSON.stringify(value)];
    }
  }
  if (fields.detail?.length) nonField = fields.detail[0];
  if (fields.non_field_errors?.length) nonField = fields.non_field_errors[0];
  return { fields, message: nonField };
}

function toLocalInputValue(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60_000;
  const local = new Date(d.getTime() - tzOffset);
  return local.toISOString().slice(0, 16);
}

function fullName(u: MentorOption): string {
  return (
    [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
    u.username ||
    u.email ||
    `Mentor #${u.id}`
  );
}

export default function SessionFormDrawer({
  open,
  session,
  isAdmin,
  onClose,
  onSaved,
}: Props) {
  const isEdit = Boolean(session?.id);

  const [program, setProgram] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | "">(60);
  const [url, setUrl] = useState("");
  const [recordingUrl, setRecordingUrl] = useState("");
  const [mentor, setMentor] = useState<number | "">("");

  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [loadingMentors, setLoadingMentors] = useState(false);

  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hydrate form from session prop when opening
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- hydratation form sur ouverture drawer */
    setErrors({});
    setErrorMessage(null);
    if (session) {
      setProgram(session.program ?? "");
      setTitle(session.title || "");
      setDescription(session.description || "");
      setScheduledAt(toLocalInputValue(session.scheduled_at));
      setDurationMinutes(
        typeof session.duration_minutes === "number"
          ? session.duration_minutes
          : 60,
      );
      setUrl(session.url || "");
      setRecordingUrl(session.recording_url || "");
      setMentor(session.mentor ?? "");
    } else {
      setProgram("");
      setTitle("");
      setDescription("");
      setScheduledAt("");
      setDurationMinutes(60);
      setUrl("");
      setRecordingUrl("");
      setMentor("");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, session]);

  // Load programs (always)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- chargement initial liste programmes */
    setLoadingPrograms(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    apiFetch<unknown>("/programs/programs/")
      .then((data) => {
        if (cancelled) return;
        setPrograms(unwrapArray<ProgramOption>(data));
      })
      .catch(() => {
        /* on laisse les programs vides en cas d'erreur — input numérique de secours */
      })
      .finally(() => {
        if (!cancelled) setLoadingPrograms(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Load mentors (admin only)
  useEffect(() => {
    if (!open || !isAdmin) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- chargement initial liste mentors */
    setLoadingMentors(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    apiFetch<unknown>("/users/auth/users/")
      .then((data) => {
        if (cancelled) return;
        const all = unwrapArray<MentorOption>(data);
        setMentors(all.filter((u) => u.role === "mentor" || u.role === "admin"));
      })
      .catch(() => {
        /* admin: pas de liste — l'admin pourra entrer un ID manuellement */
      })
      .finally(() => {
        if (!cancelled) setLoadingMentors(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isAdmin]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const programOptions = useMemo(() => {
    return programs
      .filter((p) => p.id != null)
      .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [programs]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setErrorMessage(null);

    if (!program || !title.trim() || !description.trim() || !scheduledAt || !url.trim()) {
      setErrorMessage(
        "Programme, titre, description, date et lien visio sont obligatoires.",
      );
      return;
    }

    const isoScheduled = (() => {
      try {
        return new Date(scheduledAt).toISOString();
      } catch {
        return scheduledAt;
      }
    })();

    const basePayload: Partial<SessionPayload> = {
      program: Number(program),
      title: title.trim(),
      description: description.trim(),
      scheduled_at: isoScheduled,
      url: url.trim(),
    };
    if (typeof durationMinutes === "number" && durationMinutes > 0) {
      basePayload.duration_minutes = durationMinutes;
    }
    if (recordingUrl.trim()) {
      basePayload.recording_url = recordingUrl.trim();
    } else if (isEdit) {
      basePayload.recording_url = null;
    }

    setPending(true);
    try {
      let saved: Session;
      if (isEdit && session) {
        const payload: Partial<SessionPayload> = { ...basePayload };
        if (isAdmin && mentor !== "" && mentor !== session.mentor) {
          payload.mentor = Number(mentor);
        }
        saved = await updateSession(session.id, payload);
      } else {
        saved = await createSession(basePayload as SessionPayload);
        // perform_create force mentor = request.user → admin doit PATCHer si autre mentor
        if (
          isAdmin &&
          mentor !== "" &&
          Number(mentor) !== saved.mentor
        ) {
          try {
            saved = await updateSession(saved.id, { mentor: Number(mentor) });
          } catch (patchErr) {
            // Notifier mais ne pas bloquer : la session a été créée
            setErrorMessage(
              `Session créée, mais l'assignation du mentor a échoué : ${
                patchErr instanceof Error ? patchErr.message : "erreur inconnue"
              }. Modifiez la session pour réessayer.`,
            );
          }
        }
      }
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError) {
        const parsed = extractFieldErrors(err.payload);
        setErrors(parsed.fields);
        setErrorMessage(parsed.message || err.message);
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : "Sauvegarde impossible.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-neutral-4 bg-neutral-1 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-4 px-6 py-4">
          <div>
            <h2 className="text-h6 font-semibold text-neutral-8">
              {isEdit ? "Modifier la session" : "Nouvelle session"}
            </h2>
            <p className="mt-1 text-xs text-neutral-6">
              {isEdit
                ? "Mettre à jour les informations de la session de mentorat."
                : "Planifier une session de mentorat live ou hybride."}
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
        </header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 px-6 py-5">
          {/* Programme */}
          <div>
            <label
              htmlFor="session-program"
              className="mb-1 block text-xs font-semibold text-neutral-7"
            >
              Programme <span className="text-red-500">*</span>
            </label>
            <select
              id="session-program"
              value={program === "" ? "" : String(program)}
              onChange={(event) =>
                setProgram(event.target.value ? Number(event.target.value) : "")
              }
              required
              disabled={loadingPrograms}
              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none disabled:opacity-60"
            >
              <option value="">
                {loadingPrograms ? "Chargement…" : "Sélectionner un programme"}
              </option>
              {programOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || `Programme #${p.id}`}
                </option>
              ))}
            </select>
            {errors.program?.[0] ? (
              <p className="mt-1 text-xs text-red-500">{errors.program[0]}</p>
            ) : null}
          </div>

          {/* Titre */}
          <div>
            <label
              htmlFor="session-title"
              className="mb-1 block text-xs font-semibold text-neutral-7"
            >
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              id="session-title"
              type="text"
              maxLength={255}
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex. Live Q&A — clôture du module Data Engineering"
              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
            />
            {errors.title?.[0] ? (
              <p className="mt-1 text-xs text-red-500">{errors.title[0]}</p>
            ) : null}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="session-description"
              className="mb-1 block text-xs font-semibold text-neutral-7"
            >
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="session-description"
              required
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Objectifs de la session, prérequis, agenda…"
              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
            />
            {errors.description?.[0] ? (
              <p className="mt-1 text-xs text-red-500">{errors.description[0]}</p>
            ) : null}
          </div>

          {/* Date + durée */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="session-scheduled-at"
                className="mb-1 block text-xs font-semibold text-neutral-7"
              >
                Début <span className="text-red-500">*</span>
              </label>
              <input
                id="session-scheduled-at"
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
              />
              {errors.scheduled_at?.[0] ? (
                <p className="mt-1 text-xs text-red-500">
                  {errors.scheduled_at[0]}
                </p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="session-duration"
                className="mb-1 block text-xs font-semibold text-neutral-7"
              >
                Durée (minutes)
              </label>
              <input
                id="session-duration"
                type="number"
                min={1}
                step={5}
                value={durationMinutes === "" ? "" : durationMinutes}
                onChange={(event) =>
                  setDurationMinutes(
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
                className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
              />
              {errors.duration_minutes?.[0] ? (
                <p className="mt-1 text-xs text-red-500">
                  {errors.duration_minutes[0]}
                </p>
              ) : null}
            </div>
          </div>

          {/* URL visio + replay */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="session-url"
                className="mb-1 block text-xs font-semibold text-neutral-7"
              >
                Lien visio <span className="text-red-500">*</span>
              </label>
              <input
                id="session-url"
                type="url"
                required
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://meet.google.com/abc-defg-hij"
                className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
              />
              {errors.url?.[0] ? (
                <p className="mt-1 text-xs text-red-500">{errors.url[0]}</p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="session-recording-url"
                className="mb-1 block text-xs font-semibold text-neutral-7"
              >
                Replay (optionnel)
              </label>
              <input
                id="session-recording-url"
                type="url"
                value={recordingUrl}
                onChange={(event) => setRecordingUrl(event.target.value)}
                placeholder="https://drive.google.com/…"
                className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
              />
              {errors.recording_url?.[0] ? (
                <p className="mt-1 text-xs text-red-500">
                  {errors.recording_url[0]}
                </p>
              ) : null}
            </div>
          </div>

          {/* Mentor (admin) */}
          {isAdmin ? (
            <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-2 p-3">
              <label
                htmlFor="session-mentor"
                className="mb-1 block text-xs font-semibold text-neutral-7"
              >
                Mentor animateur
              </label>
              <select
                id="session-mentor"
                value={mentor === "" ? "" : String(mentor)}
                onChange={(event) =>
                  setMentor(event.target.value ? Number(event.target.value) : "")
                }
                disabled={loadingMentors}
                className="w-full rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-small text-neutral-8 focus:border-primary-3 focus:outline-none disabled:opacity-60"
              >
                <option value="">
                  {isEdit
                    ? "Conserver le mentor actuel"
                    : "Vous (créateur) — modifiable après création"}
                </option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {fullName(m)} {m.email ? `· ${m.email}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-neutral-5">
                À la création, l’API force <code>mentor = créateur</code>. Si vous
                choisissez un autre mentor, un PATCH est appliqué automatiquement
                ensuite.
              </p>
              {errors.mentor?.[0] ? (
                <p className="mt-1 text-xs text-red-500">{errors.mentor[0]}</p>
              ) : null}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-auto flex flex-col-reverse gap-2 border-t border-neutral-4 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-4 px-4 py-2 text-small font-semibold text-neutral-7 hover:bg-neutral-3 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-1 px-4 py-2 text-small font-semibold text-white shadow-sm transition hover:bg-primary-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <Icon icon="svg-spinners:90-ring-with-bg" width={14} />
              ) : (
                <Icon
                  icon={isEdit ? "solar:diskette-bold" : "solar:add-circle-bold"}
                  width={14}
                />
              )}
              {isEdit ? "Enregistrer" : "Planifier la session"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
