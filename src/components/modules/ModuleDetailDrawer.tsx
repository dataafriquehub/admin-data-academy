"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError, apiFetch } from "@/lib/api";
import {
  getModule,
  type ModuleContentType,
  type ModuleDetail,
} from "@/services/moduleService";

type DirectoryUser = {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type Tab = "info" | "contents" | "quizzes";

type Props = {
  open: boolean;
  moduleId: number | null;
  /** Données déjà disponibles dans la liste — utilisées en attendant le détail. */
  fallback?: ModuleDetail | null;
  canEdit: boolean;
  canDelete: boolean;
  usersById: Map<number, DirectoryUser>;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const CONTENT_META: Record<
  ModuleContentType,
  { label: string; icon: string; classes: string }
> = {
  VIDEO: {
    label: "Vidéo",
    icon: "solar:videocamera-record-bold",
    classes: "bg-primary-5 text-primary-1 border border-primary-3",
  },
  TEXT: {
    label: "Texte",
    icon: "solar:document-text-bold",
    classes: "bg-neutral-3 text-neutral-7 border border-neutral-4",
  },
  QUIZ: {
    label: "Quiz",
    icon: "solar:question-circle-bold",
    classes:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
  },
  ASSIGNMENT: {
    label: "Devoir",
    icon: "solar:checklist-bold",
    classes:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
  },
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "Non renseignée";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Non renseignée";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function userLabel(user?: DirectoryUser): string {
  if (!user) return "Auteur non identifié";
  return (
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.email ||
    `Utilisateur #${user.id}`
  );
}

export default function ModuleDetailDrawer({
  open,
  moduleId,
  fallback,
  canEdit,
  canDelete,
  usersById,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const [detail, setDetail] = useState<ModuleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("info");
  const [extraUsers, setExtraUsers] = useState<Map<number, DirectoryUser>>(
    new Map(),
  );

  // Load detail when opening
  useEffect(() => {
    if (!open || !moduleId) return;
    const controller = new AbortController();
    /* eslint-disable react-hooks/set-state-in-effect -- chargement détail à l'ouverture */
    setLoading(true);
    setError(null);
    setDetail(null);
    setTab("info");
    /* eslint-enable react-hooks/set-state-in-effect */
    getModule(moduleId)
      .then((data) => {
        if (controller.signal.aborted) return;
        setDetail(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 403) {
          setError(
            "Détail réservé au créateur du module ou à un administrateur.",
          );
        } else if (err instanceof ApiError && err.status === 404) {
          setError("Module introuvable ou supprimé.");
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Détail du module indisponible.",
          );
        }
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
      });
    return () => controller.abort();
  }, [open, moduleId]);

  // Resolve missing creator if needed
  const view = detail ?? fallback ?? null;
  useEffect(() => {
    if (!open || !view?.created_by) return;
    if (usersById.has(view.created_by)) return;
    if (extraUsers.has(view.created_by)) return;
    let cancelled = false;
    apiFetch<unknown>(`/users/auth/users/${view.created_by}/`)
      .then((data) => {
        if (cancelled) return;
        if (data && typeof data === "object") {
          const user = data as DirectoryUser;
          setExtraUsers((prev) => {
            const next = new Map(prev);
            next.set(user.id, user);
            return next;
          });
        }
      })
      .catch(() => {
        /* on tolère un échec — le fallback "Utilisateur #id" reste affiché */
      });
    return () => {
      cancelled = true;
    };
  }, [open, view?.created_by, usersById, extraUsers]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sortedContents = useMemo(() => {
    const contents = view?.contents || [];
    return contents
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [view]);

  const sortedQuizzes = useMemo(() => view?.quizzes || [], [view]);

  if (!open) return null;

  const creatorId = view?.created_by ?? null;
  const creator =
    creatorId != null
      ? usersById.get(creatorId) || extraUsers.get(creatorId)
      : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-neutral-4 bg-neutral-1 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-neutral-4 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-semibold tracking-wide text-neutral-6 uppercase">
                Module #{view?.id ?? moduleId ?? "?"}
              </p>
              <h2 className="text-h6 font-semibold wrap-break-word text-neutral-8">
                {view?.title || "Chargement…"}
              </h2>
              {view?.objectives ? (
                <p className="mt-1 line-clamp-2 text-xs text-neutral-6">
                  {view.objectives}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-6 hover:bg-neutral-3"
              aria-label="Fermer"
            >
              <Icon icon="solar:close-bold" width={18} />
            </button>
          </div>

          <nav className="mt-4 inline-flex max-w-full overflow-x-auto rounded-2xl border border-neutral-4 bg-neutral-2 p-1 text-xs">
            <TabButton
              active={tab === "info"}
              icon="solar:info-circle-bold"
              label="Informations"
              onClick={() => setTab("info")}
            />
            <TabButton
              active={tab === "contents"}
              icon="solar:layers-bold"
              label={`Contenus (${sortedContents.length})`}
              onClick={() => setTab("contents")}
            />
            <TabButton
              active={tab === "quizzes"}
              icon="solar:question-circle-bold"
              label={`Quiz (${sortedQuizzes.length})`}
              onClick={() => setTab("quizzes")}
            />
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && !view ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-small text-red-600 dark:text-red-300">
              {error}
            </div>
          ) : !view ? (
            <p className="text-small text-neutral-6">Module introuvable.</p>
          ) : tab === "info" ? (
            <div className="space-y-4">
              {view.cover_url ? (
                /* eslint-disable-next-line @next/next/no-img-element -- image distante non maîtrisée, on évite next/image ici */
                <img
                  src={view.cover_url}
                  alt={view.title || "Couverture du module"}
                  className="aspect-video w-full rounded-2xl border border-neutral-4 object-cover"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-neutral-4 bg-neutral-2">
                  <Icon
                    icon="solar:gallery-bold"
                    width={28}
                    className="text-neutral-5"
                  />
                </div>
              )}

              <section>
                <h3 className="text-small font-semibold text-neutral-8">
                  Description
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-small text-neutral-7">
                  {view.description || "Non renseignée"}
                </p>
              </section>

              <section>
                <h3 className="text-small font-semibold text-neutral-8">
                  Objectifs pédagogiques
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-small text-neutral-7">
                  {view.objectives || "Non renseignés"}
                </p>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Créé par" value={userLabel(creator)} />
                <InfoRow
                  label="Créé le"
                  value={formatDate(view.created_at)}
                />
                <InfoRow
                  label="Mis à jour"
                  value={formatDate(view.updated_at)}
                />
                <InfoRow
                  label="Couverture"
                  value={view.cover_url ? "Disponible" : "Non renseignée"}
                />
              </section>
            </div>
          ) : tab === "contents" ? (
            <ContentsView contents={sortedContents} />
          ) : (
            <QuizzesView quizzes={sortedQuizzes} />
          )}
        </div>

        {(canEdit || canDelete) && view ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-4 bg-neutral-1 px-6 py-3">
            {canDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/20 dark:text-red-300"
              >
                <Icon icon="solar:trash-bin-trash-bold" width={14} />
                Supprimer
              </button>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2"
              >
                <Icon icon="solar:pen-bold" width={14} />
                Modifier
              </button>
            ) : null}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 font-semibold transition ${
        active
          ? "bg-primary-1 text-white shadow-sm"
          : "text-neutral-7 hover:bg-neutral-3"
      }`}
    >
      <Icon icon={icon} width={12} />
      {label}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-4 bg-neutral-2 p-3">
      <p className="text-[11px] font-semibold tracking-wide text-neutral-6 uppercase">
        {label}
      </p>
      <p className="mt-1 text-small font-medium text-neutral-8">{value}</p>
    </div>
  );
}

function ContentsView({ contents }: { contents: ModuleDetail["contents"] }) {
  if (!contents || contents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-2 p-6 text-center text-small text-neutral-6">
        Aucun contenu pour ce module.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {contents.map((content, index) => {
        const meta = CONTENT_META[content.type] ?? CONTENT_META.TEXT;
        return (
          <li
            key={content.id ?? `${content.title}-${index}`}
            className="rounded-2xl border border-neutral-4 bg-neutral-2 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.classes}`}
                  >
                    <Icon icon={meta.icon} width={10} />
                    {meta.label}
                  </span>
                  {typeof content.order === "number" ? (
                    <span className="rounded-full border border-neutral-4 bg-neutral-1 px-2 py-0.5 text-[11px] text-neutral-6">
                      Ordre {content.order}
                    </span>
                  ) : null}
                </div>
                <p className="font-semibold wrap-break-word text-neutral-8">
                  {content.title}
                </p>
                {content.description ? (
                  <p className="mt-1 line-clamp-3 text-xs text-neutral-7">
                    {content.description}
                  </p>
                ) : null}
              </div>
              {content.url ? (
                <a
                  href={content.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-primary-3 bg-primary-5 px-2.5 py-1 text-xs font-semibold text-primary-1 transition hover:bg-primary-4"
                  title="Ouvrir la ressource"
                >
                  <Icon icon="solar:link-bold" width={10} />
                  Ouvrir
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function QuizzesView({ quizzes }: { quizzes: ModuleDetail["quizzes"] }) {
  if (!quizzes || quizzes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-2 p-6 text-center text-small text-neutral-6">
        Aucun quiz associé à ce module.
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {quizzes.map((quiz, qIndex) => (
        <li
          key={quiz.id ?? `${quiz.title}-${qIndex}`}
          className="rounded-2xl border border-neutral-4 bg-neutral-2 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold wrap-break-word text-neutral-8">
                {quiz.title}
              </p>
              {quiz.description ? (
                <p className="mt-1 line-clamp-3 text-xs text-neutral-7">
                  {quiz.description}
                </p>
              ) : null}
            </div>
            {typeof quiz.min_score_rate === "number" ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-5 px-2 py-0.5 text-[11px] font-semibold text-primary-1">
                <Icon icon="solar:medal-star-bold" width={10} />
                {quiz.min_score_rate}% requis
              </span>
            ) : null}
          </div>

          {quiz.questions && quiz.questions.length > 0 ? (
            <details className="mt-3 rounded-xl border border-neutral-4 bg-neutral-1 p-2 text-xs text-neutral-7">
              <summary className="cursor-pointer font-semibold text-neutral-8">
                {quiz.questions.length} question
                {quiz.questions.length > 1 ? "s" : ""}
              </summary>
              <ol className="mt-2 space-y-2">
                {quiz.questions.map((question, qqIndex) => (
                  <li
                    key={question.id ?? `${quiz.title}-q-${qqIndex}`}
                    className="rounded-xl border border-neutral-4 bg-neutral-2 p-2"
                  >
                    <p className="font-semibold text-neutral-8">
                      {qqIndex + 1}. {question.content}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-6">
                      {question.type === "multiple"
                        ? "Choix multiples"
                        : "Choix unique"}{" "}
                      · {question.points ?? 1} point
                      {(question.points ?? 1) > 1 ? "s" : ""}
                    </p>
                    {question.answers && question.answers.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {question.answers.map((answer, aIndex) => (
                          <li
                            key={answer.id ?? `${qqIndex}-a-${aIndex}`}
                            className="flex items-center gap-2"
                          >
                            <Icon
                              icon={
                                answer.is_correct
                                  ? "solar:check-circle-bold"
                                  : "solar:close-circle-linear"
                              }
                              width={12}
                              className={
                                answer.is_correct
                                  ? "text-emerald-500"
                                  : "text-neutral-5"
                              }
                            />
                            <span>{answer.content}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
