"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError, apiFetch, unwrapArray } from "@/lib/api";
import {
  previewQuizDeadlineNotification,
  sendQuizDeadlineNotification,
  type QuizDeadlinePayload,
  type QuizDeadlinePreviewResponse,
  type QuizDeadlineSendResponse,
} from "@/services/notificationService";

type ModuleQuiz = {
  id: number;
  title: string;
};

type ModuleRow = {
  id: number;
  title: string;
  quizzes?: ModuleQuiz[];
};

type FlatQuiz = {
  quizId: number;
  quizTitle: string;
  moduleId: number;
  moduleTitle: string;
};

function normalize(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function parseIntList(raw: string): number[] {
  return raw
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function readableErr(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const payload = err.payload;
    if (payload && typeof payload === "object") {
      const obj = payload as Record<string, unknown>;
      if (typeof obj.detail === "string") return obj.detail;
      if (Array.isArray(obj.non_field_errors) && obj.non_field_errors.length) {
        return String(obj.non_field_errors[0]);
      }
      const firstKey = Object.keys(obj)[0];
      if (firstKey) {
        const first = obj[firstKey];
        if (Array.isArray(first) && first.length) {
          return `${firstKey}: ${first[0]}`;
        }
        if (typeof first === "string") return `${firstKey}: ${first}`;
      }
    }
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

export default function QuizReminderWizard() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);

  const [dueAt, setDueAt] = useState("");
  const [titleOverride, setTitleOverride] = useState("");
  const [messageOverride, setMessageOverride] = useState("");
  const [applicationIdsRaw, setApplicationIdsRaw] = useState("");

  const [previewPending, setPreviewPending] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<QuizDeadlinePreviewResponse | null>(null);
  const [sent, setSent] = useState<QuizDeadlineSendResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- chargement initial liste modules / quiz */
    setModulesLoading(true);
    setModulesError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    apiFetch<unknown>("/programs/modules/")
      .then((data) => {
        if (cancelled) return;
        setModules(unwrapArray<ModuleRow>(data));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setModulesError(
          err instanceof Error ? err.message : "Impossible de lister les quiz.",
        );
      })
      .finally(() => {
        if (!cancelled) setModulesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const flatQuizzes: FlatQuiz[] = useMemo(() => {
    const out: FlatQuiz[] = [];
    for (const mod of modules) {
      for (const quiz of mod.quizzes || []) {
        if (quiz?.id == null) continue;
        out.push({
          quizId: quiz.id,
          quizTitle: quiz.title || `Quiz #${quiz.id}`,
          moduleId: mod.id,
          moduleTitle: mod.title || `Module #${mod.id}`,
        });
      }
    }
    return out;
  }, [modules]);

  const filteredQuizzes = useMemo(() => {
    const q = normalize(search);
    if (!q) return flatQuizzes.slice(0, 30);
    return flatQuizzes
      .filter((quiz) => {
        const haystack = [
          quiz.quizTitle,
          quiz.moduleTitle,
          String(quiz.quizId),
        ]
          .map(normalize)
          .join(" ");
        return haystack.includes(q);
      })
      .slice(0, 50);
  }, [flatQuizzes, search]);

  const selectedQuiz = useMemo(
    () => flatQuizzes.find((q) => q.quizId === selectedQuizId) || null,
    [flatQuizzes, selectedQuizId],
  );

  function buildPayload(): QuizDeadlinePayload | null {
    if (selectedQuizId == null) return null;
    const applicationIds = parseIntList(applicationIdsRaw);
    return {
      quiz_id: selectedQuizId,
      ...(applicationIds.length ? { application_ids: applicationIds } : {}),
      ...(dueAt ? { due_at: new Date(dueAt).toISOString() } : {}),
      ...(titleOverride.trim() ? { title: titleOverride.trim() } : {}),
      ...(messageOverride.trim() ? { message: messageOverride.trim() } : {}),
    };
  }

  async function handlePreview() {
    setError(null);
    setPreview(null);
    setSent(null);
    const payload = buildPayload();
    if (!payload) {
      setError("Sélectionnez d’abord un quiz.");
      return;
    }
    setPreviewPending(true);
    try {
      const res = await previewQuizDeadlineNotification(payload);
      setPreview(res);
    } catch (err) {
      setError(readableErr(err, "Prévisualisation impossible."));
    } finally {
      setPreviewPending(false);
    }
  }

  async function handleSend() {
    setError(null);
    setSent(null);
    const payload = buildPayload();
    if (!payload) {
      setError("Sélectionnez d’abord un quiz.");
      return;
    }
    setSendPending(true);
    try {
      const res = await sendQuizDeadlineNotification(payload);
      setSent(res);
    } catch (err) {
      setError(readableErr(err, "Envoi impossible."));
    } finally {
      setSendPending(false);
    }
  }

  function reset() {
    setSelectedQuizId(null);
    setSearch("");
    setDueAt("");
    setTitleOverride("");
    setMessageOverride("");
    setApplicationIdsRaw("");
    setError(null);
    setPreview(null);
    setSent(null);
  }

  return (
    <section className="rounded-2xl border border-neutral-4 bg-neutral-1 p-5">
      <header className="flex items-start gap-3 border-b border-neutral-4 pb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-5 text-secondary-1">
          <Icon icon="solar:notebook-bold" width={18} />
        </span>
        <div>
          <h3 className="text-h6 font-semibold text-neutral-8">
            Rappel deadline quiz
          </h3>
          <p className="mt-1 text-xs text-neutral-6">
            Choisissez un quiz, prévisualisez les destinataires (étudiants
            approuvés sur un programme contenant le module du quiz), puis
            envoyez le rappel.
          </p>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          {/* Étape 1 — sélection quiz */}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-6">
              1. Choisir le quiz
            </p>
            <div className="relative">
              <Icon
                icon="solar:magnifer-linear"
                width={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-5"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  modulesLoading
                    ? "Chargement des modules…"
                    : "Rechercher un quiz par titre, module ou ID…"
                }
                disabled={modulesLoading}
                className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-9 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none disabled:opacity-60"
              />
            </div>
            {modulesError ? (
              <p className="mt-1 text-xs text-red-500">{modulesError}</p>
            ) : null}

            {!modulesLoading && flatQuizzes.length === 0 && !modulesError ? (
              <p className="mt-2 rounded-xl border border-dashed border-neutral-4 bg-neutral-2 p-3 text-xs text-neutral-6">
                Aucun quiz disponible dans les modules accessibles. Créez un
                quiz dans un module pour activer cette section.
              </p>
            ) : null}

            {!modulesLoading && flatQuizzes.length > 0 ? (
              <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-neutral-4 bg-neutral-1">
                {filteredQuizzes.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-neutral-6">
                    Aucun quiz ne correspond.
                  </li>
                ) : (
                  filteredQuizzes.map((quiz) => {
                    const active = quiz.quizId === selectedQuizId;
                    return (
                      <li key={`${quiz.moduleId}-${quiz.quizId}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedQuizId(quiz.quizId)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-small transition ${
                            active
                              ? "bg-secondary-5 text-secondary-1"
                              : "hover:bg-neutral-3"
                          }`}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-neutral-4">
                            {active ? (
                              <Icon
                                icon="solar:check-bold"
                                width={12}
                                className="text-secondary-1"
                              />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {quiz.quizTitle}
                            </span>
                            <span className="block truncate text-xs text-neutral-5">
                              Module : {quiz.moduleTitle} · ID quiz {quiz.quizId}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            ) : null}
          </div>

          {/* Étape 2 — surcharges */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-6">
              2. Paramètres (optionnels)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="quiz-due-at"
                  className="mb-1 block text-xs text-neutral-7"
                >
                  Date / heure limite
                </label>
                <input
                  id="quiz-due-at"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 focus:border-primary-3 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="quiz-applications"
                  className="mb-1 block text-xs text-neutral-7"
                >
                  IDs candidatures (filtre)
                </label>
                <input
                  id="quiz-applications"
                  type="text"
                  value={applicationIdsRaw}
                  onChange={(event) => setApplicationIdsRaw(event.target.value)}
                  placeholder="12, 34, 89"
                  className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-3">
              <label
                htmlFor="quiz-title-override"
                className="mb-1 block text-xs text-neutral-7"
              >
                Titre personnalisé
              </label>
              <input
                id="quiz-title-override"
                type="text"
                maxLength={255}
                value={titleOverride}
                onChange={(event) => setTitleOverride(event.target.value)}
                placeholder="Laisser vide pour utiliser le titre serveur par défaut"
                className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:outline-none"
              />
            </div>
            <div className="mt-3">
              <label
                htmlFor="quiz-message-override"
                className="mb-1 block text-xs text-neutral-7"
              >
                Message personnalisé
              </label>
              <textarea
                id="quiz-message-override"
                rows={3}
                value={messageOverride}
                onChange={(event) => setMessageOverride(event.target.value)}
                placeholder="Laisser vide pour utiliser le message serveur par défaut"
                className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Colonne droite — résumé + actions + résultats */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-4 bg-neutral-2 p-4 text-xs text-neutral-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-6">
              Récapitulatif
            </p>
            <dl className="mt-2 space-y-1.5">
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-5">Quiz</dt>
                <dd className="text-right">
                  {selectedQuiz ? (
                    <>
                      <span className="font-semibold text-neutral-8">
                        {selectedQuiz.quizTitle}
                      </span>
                      <span className="block text-[11px] text-neutral-5">
                        {selectedQuiz.moduleTitle} · ID {selectedQuiz.quizId}
                      </span>
                    </>
                  ) : (
                    <span className="italic text-neutral-5">Non sélectionné</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-5">Deadline</dt>
                <dd className="text-right">
                  {dueAt ? (
                    new Date(dueAt).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  ) : (
                    <span className="italic text-neutral-5">
                      Par défaut serveur
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-5">Restriction</dt>
                <dd className="text-right">
                  {parseIntList(applicationIdsRaw).length > 0 ? (
                    `${parseIntList(applicationIdsRaw).length} candidature(s)`
                  ) : (
                    <span className="italic text-neutral-5">
                      Tous les approuvés concernés
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewPending || sendPending || selectedQuizId == null}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-3 bg-primary-5 px-4 py-2 text-small font-semibold text-primary-1 transition hover:bg-primary-4/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {previewPending ? (
                <Icon icon="svg-spinners:90-ring-with-bg" width={14} />
              ) : (
                <Icon icon="solar:eye-bold" width={14} />
              )}
              Prévisualiser destinataires
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sendPending || previewPending || selectedQuizId == null}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-1 px-4 py-2 text-small font-semibold text-white shadow-sm transition hover:bg-primary-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendPending ? (
                <Icon icon="svg-spinners:90-ring-with-bg" width={14} />
              ) : (
                <Icon icon="solar:plain-bold" width={14} />
              )}
              Envoyer le rappel
            </button>
            {selectedQuizId != null ? (
              <button
                type="button"
                onClick={reset}
                disabled={previewPending || sendPending}
                className="text-xs text-neutral-5 hover:text-primary-1 disabled:opacity-40"
              >
                Réinitialiser le formulaire
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {preview ? (
            <div className="rounded-xl border border-primary-3 bg-primary-5 p-4 text-small text-primary-1">
              <p className="flex items-center gap-2 font-semibold">
                <Icon icon="solar:users-group-rounded-bold" width={16} />
                {preview.recipient_count ?? 0} destinataire
                {(preview.recipient_count ?? 0) > 1 ? "s" : ""} trouvé
                {(preview.recipient_count ?? 0) > 1 ? "s" : ""}
              </p>
              {preview.recipients && preview.recipients.length > 0 ? (
                <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
                  {preview.recipients.slice(0, 50).map((recipient) => (
                    <li key={recipient.id} className="truncate">
                      • {recipient.email}{" "}
                      <span className="text-primary-2">
                        (ID {recipient.id})
                      </span>
                    </li>
                  ))}
                  {preview.recipients.length > 50 ? (
                    <li className="italic text-primary-2">
                      … et {preview.recipients.length - 50} autres
                    </li>
                  ) : null}
                </ul>
              ) : null}
              <p className="mt-2 text-[11px] text-primary-2">
                Aucune notification n’a été créée à cette étape.
              </p>
            </div>
          ) : null}

          {sent ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-small text-emerald-700 dark:text-emerald-300">
              <p className="flex items-center gap-2 font-semibold">
                <Icon icon="solar:check-circle-bold" width={16} />
                Rappel envoyé.
              </p>
              <p className="mt-1 text-xs">
                <strong>{sent.created ?? 0}</strong> notifications créées
                {typeof sent.email_sent === "number" ? (
                  <>
                    {" "}
                    · <strong>{sent.email_sent}</strong> e-mails partis
                  </>
                ) : null}
                .
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
