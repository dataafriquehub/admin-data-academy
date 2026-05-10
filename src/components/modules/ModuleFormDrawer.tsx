"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import {
  createModule,
  fileToBase64,
  getModule,
  updateModule,
  type Answer,
  type ModuleContent,
  type ModuleContentType,
  type ModuleDetail,
  type ModulePayload,
  type Question,
  type QuestionType,
  type Quiz,
} from "@/services/moduleService";

type Props = {
  open: boolean;
  moduleId: number | null;
  /** Données déjà disponibles (liste) — utilisées comme base si le détail n'est pas chargé. */
  initial?: ModuleDetail | null;
  onClose: () => void;
  onSaved: (saved: ModuleDetail) => void;
};

type FieldErrors = Record<string, string[]>;

type Mode = "create" | "edit";

const CONTENT_TYPES: { value: ModuleContentType; label: string }[] = [
  { value: "VIDEO", label: "Vidéo" },
  { value: "TEXT", label: "Texte" },
  { value: "QUIZ", label: "Quiz" },
  { value: "ASSIGNMENT", label: "Devoir" },
];

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "single", label: "Choix unique" },
  { value: "multiple", label: "Choix multiples" },
];

type Step = "info" | "cover" | "contents" | "quizzes";

const STEPS: { id: Step; icon: string; label: string }[] = [
  { id: "info", icon: "solar:info-circle-bold", label: "Informations" },
  { id: "cover", icon: "solar:gallery-bold", label: "Couverture" },
  { id: "contents", icon: "solar:layers-bold", label: "Contenus" },
  { id: "quizzes", icon: "solar:question-circle-bold", label: "Quiz" },
];

function generateId(): string {
  return `tmp-${Math.random().toString(36).slice(2, 9)}`;
}

type DraftContent = {
  id?: number;
  title: string;
  description: string;
  type: ModuleContentType;
  order?: number;
  url?: string | null;
  _key: string;
};

type DraftAnswer = {
  id?: number;
  content: string;
  is_correct?: boolean;
  _key: string;
};

type DraftQuestion = {
  id?: number;
  content: string;
  type?: QuestionType;
  points?: number;
  order?: number;
  answers: DraftAnswer[];
  _key: string;
};

type DraftQuiz = {
  id?: number;
  title: string;
  description?: string;
  min_score_rate?: number;
  questions: DraftQuestion[];
  _key: string;
};

function toDraftContent(content: ModuleContent): DraftContent {
  return {
    id: content.id,
    title: content.title || "",
    description: content.description || "",
    type: content.type ?? "TEXT",
    order: content.order ?? 0,
    url: content.url ?? "",
    _key: generateId(),
  };
}

function toDraftAnswer(answer: Answer): DraftAnswer {
  return {
    id: answer.id,
    content: answer.content || "",
    is_correct: answer.is_correct ?? false,
    _key: generateId(),
  };
}

function toDraftQuestion(question: Question): DraftQuestion {
  return {
    id: question.id,
    content: question.content || "",
    type: question.type ?? "single",
    points: question.points ?? 1,
    order: question.order ?? 0,
    answers: (question.answers ?? []).map(toDraftAnswer),
    _key: generateId(),
  };
}

function toDraftQuiz(quiz: Quiz): DraftQuiz {
  return {
    id: quiz.id,
    title: quiz.title || "",
    description: quiz.description ?? "",
    min_score_rate: quiz.min_score_rate ?? 0,
    questions: (quiz.questions ?? []).map(toDraftQuestion),
    _key: generateId(),
  };
}

function fromDraftContent(content: DraftContent, index: number): ModuleContent {
  return {
    id: content.id,
    title: content.title,
    description: content.description,
    type: content.type,
    order: typeof content.order === "number" ? content.order : index,
    url: content.url?.toString().trim() ? content.url : null,
  };
}

function fromDraftAnswer(answer: DraftAnswer): Answer {
  return {
    id: answer.id,
    content: answer.content,
    is_correct: Boolean(answer.is_correct),
  };
}

function fromDraftQuestion(
  question: DraftQuestion,
  index: number,
): Question {
  return {
    id: question.id,
    content: question.content,
    type: question.type,
    points: question.points,
    order: typeof question.order === "number" ? question.order : index,
    answers: question.answers.map(fromDraftAnswer),
  };
}

function fromDraftQuiz(quiz: DraftQuiz): Quiz {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    min_score_rate: quiz.min_score_rate,
    questions: quiz.questions.map(fromDraftQuestion),
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

export default function ModuleFormDrawer({
  open,
  moduleId,
  initial,
  onClose,
  onSaved,
}: Props) {
  const mode: Mode = moduleId ? "edit" : "create";

  const [step, setStep] = useState<Step>("info");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objectives, setObjectives] = useState("");

  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverBase64, setCoverBase64] = useState<string | null>(null);
  const [coverFileName, setCoverFileName] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);

  const [contents, setContents] = useState<DraftContent[]>([]);
  const [editContents, setEditContents] = useState(false);
  const [contentsTouched, setContentsTouched] = useState(false);

  const [quizzes, setQuizzes] = useState<DraftQuiz[]>([]);
  const [editQuizzes, setEditQuizzes] = useState(false);
  const [quizzesTouched, setQuizzesTouched] = useState(false);

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hydrate the form on open / module change
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- hydratation à l'ouverture du drawer */
    setStep("info");
    setErrors({});
    setErrorMessage(null);
    setCoverError(null);
    setCoverBase64(null);
    setCoverFileName(null);
    setLoadError(null);
    setEditContents(false);
    setEditQuizzes(false);
    setContentsTouched(false);
    setQuizzesTouched(false);

    const seed = initial ?? null;
    setTitle(seed?.title || "");
    setDescription(seed?.description || "");
    setObjectives(seed?.objectives || "");
    setCoverPreview(seed?.cover_url || null);
    setContents((seed?.contents ?? []).map(toDraftContent));
    setQuizzes((seed?.quizzes ?? []).map(toDraftQuiz));
    /* eslint-enable react-hooks/set-state-in-effect */

    if (mode === "edit" && moduleId) {
      const controller = new AbortController();
      setLoadingDetail(true);
      getModule(moduleId)
        .then((data) => {
          if (controller.signal.aborted) return;
          setTitle(data.title || "");
          setDescription(data.description || "");
          setObjectives(data.objectives || "");
          setCoverPreview(data.cover_url || null);
          setContents((data.contents ?? []).map(toDraftContent));
          setQuizzes((data.quizzes ?? []).map(toDraftQuiz));
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          if (err instanceof ApiError && err.status === 403) {
            setLoadError(
              "Édition réservée au créateur du module ou à un administrateur.",
            );
          } else if (err instanceof ApiError && err.status === 404) {
            setLoadError("Module introuvable.");
          } else {
            setLoadError(
              err instanceof Error
                ? err.message
                : "Chargement du module impossible.",
            );
          }
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setLoadingDetail(false);
        });
      return () => controller.abort();
    }
  }, [open, moduleId, mode, initial]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const stepIndex = useMemo(
    () => STEPS.findIndex((s) => s.id === step),
    [step],
  );

  function gotoStep(target: Step) {
    setStep(target);
  }

  function handlePickCover(file: File | null) {
    if (!file) {
      setCoverBase64(null);
      setCoverFileName(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setCoverError("Seules les images sont acceptées.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setCoverError("L'image doit faire moins de 4 Mo.");
      return;
    }
    setCoverError(null);
    setCoverFileName(file.name);
    fileToBase64(file)
      .then((base64) => {
        setCoverBase64(base64);
        setCoverPreview(`data:${file.type};base64,${base64}`);
      })
      .catch((err) => {
        setCoverError(
          err instanceof Error ? err.message : "Lecture de l'image impossible.",
        );
      });
  }

  function clearCoverChange() {
    setCoverBase64(null);
    setCoverFileName(null);
    setCoverPreview(initial?.cover_url || null);
  }

  // ── Contents handlers ──
  function addContent() {
    if (!editContents) {
      setEditContents(true);
      setContentsTouched(true);
    } else {
      setContentsTouched(true);
    }
    setContents((prev) => [
      ...prev,
      {
        title: "",
        description: "",
        type: "TEXT",
        order: prev.length,
        url: "",
        _key: generateId(),
      },
    ]);
  }

  function updateContent(key: string, patch: Partial<DraftContent>) {
    setContentsTouched(true);
    setContents((prev) =>
      prev.map((c) => (c._key === key ? { ...c, ...patch } : c)),
    );
  }

  function removeContent(key: string) {
    setContentsTouched(true);
    setContents((prev) => prev.filter((c) => c._key !== key));
  }

  function moveContent(key: string, direction: -1 | 1) {
    setContentsTouched(true);
    setContents((prev) => {
      const index = prev.findIndex((c) => c._key === key);
      if (index < 0) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((c, i) => ({ ...c, order: i }));
    });
  }

  // ── Quizzes handlers ──
  function addQuiz() {
    if (!editQuizzes) {
      setEditQuizzes(true);
      setQuizzesTouched(true);
    } else {
      setQuizzesTouched(true);
    }
    setQuizzes((prev) => [
      ...prev,
      {
        title: "",
        description: "",
        min_score_rate: 60,
        questions: [],
        _key: generateId(),
      },
    ]);
  }

  function updateQuiz(key: string, patch: Partial<DraftQuiz>) {
    setQuizzesTouched(true);
    setQuizzes((prev) =>
      prev.map(
        (q): DraftQuiz => (q._key === key ? { ...q, ...patch } : q),
      ),
    );
  }

  function removeQuiz(key: string) {
    setQuizzesTouched(true);
    setQuizzes((prev) => prev.filter((q) => q._key !== key));
  }

  function addQuestion(quizKey: string) {
    setQuizzesTouched(true);
    setQuizzes((prev) =>
      prev.map((q): DraftQuiz => {
        if (q._key !== quizKey) return q;
        const newQuestion: DraftQuestion = {
          content: "",
          type: "single",
          points: 1,
          order: q.questions.length,
          answers: [
            { content: "", is_correct: false, _key: generateId() },
            { content: "", is_correct: false, _key: generateId() },
          ],
          _key: generateId(),
        };
        return { ...q, questions: [...q.questions, newQuestion] };
      }),
    );
  }

  function updateQuestion(
    quizKey: string,
    questionKey: string,
    patch: Partial<DraftQuestion>,
  ) {
    setQuizzesTouched(true);
    setQuizzes((prev) =>
      prev.map((q): DraftQuiz =>
        q._key === quizKey
          ? {
              ...q,
              questions: q.questions.map(
                (qq): DraftQuestion =>
                  qq._key === questionKey ? { ...qq, ...patch } : qq,
              ),
            }
          : q,
      ),
    );
  }

  function removeQuestion(quizKey: string, questionKey: string) {
    setQuizzesTouched(true);
    setQuizzes((prev) =>
      prev.map((q): DraftQuiz =>
        q._key === quizKey
          ? {
              ...q,
              questions: q.questions.filter((qq) => qq._key !== questionKey),
            }
          : q,
      ),
    );
  }

  function addAnswer(quizKey: string, questionKey: string) {
    setQuizzesTouched(true);
    setQuizzes((prev) =>
      prev.map((q): DraftQuiz =>
        q._key === quizKey
          ? {
              ...q,
              questions: q.questions.map((qq): DraftQuestion =>
                qq._key === questionKey
                  ? {
                      ...qq,
                      answers: [
                        ...qq.answers,
                        {
                          content: "",
                          is_correct: false,
                          _key: generateId(),
                        },
                      ],
                    }
                  : qq,
              ),
            }
          : q,
      ),
    );
  }

  function updateAnswer(
    quizKey: string,
    questionKey: string,
    answerKey: string,
    patch: Partial<DraftAnswer>,
  ) {
    setQuizzesTouched(true);
    setQuizzes((prev) =>
      prev.map((q): DraftQuiz =>
        q._key === quizKey
          ? {
              ...q,
              questions: q.questions.map((qq): DraftQuestion =>
                qq._key === questionKey
                  ? {
                      ...qq,
                      answers: qq.answers.map(
                        (a): DraftAnswer =>
                          a._key === answerKey ? { ...a, ...patch } : a,
                      ),
                    }
                  : qq,
              ),
            }
          : q,
      ),
    );
  }

  function setSingleCorrect(
    quizKey: string,
    questionKey: string,
    answerKey: string,
  ) {
    setQuizzesTouched(true);
    setQuizzes((prev) =>
      prev.map((q): DraftQuiz =>
        q._key === quizKey
          ? {
              ...q,
              questions: q.questions.map((qq): DraftQuestion =>
                qq._key === questionKey
                  ? {
                      ...qq,
                      answers: qq.answers.map(
                        (a): DraftAnswer => ({
                          ...a,
                          is_correct: a._key === answerKey,
                        }),
                      ),
                    }
                  : qq,
              ),
            }
          : q,
      ),
    );
  }

  function removeAnswer(
    quizKey: string,
    questionKey: string,
    answerKey: string,
  ) {
    setQuizzesTouched(true);
    setQuizzes((prev) =>
      prev.map((q): DraftQuiz =>
        q._key === quizKey
          ? {
              ...q,
              questions: q.questions.map((qq): DraftQuestion =>
                qq._key === questionKey
                  ? {
                      ...qq,
                      answers: qq.answers.filter((a) => a._key !== answerKey),
                    }
                  : qq,
              ),
            }
          : q,
      ),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setErrorMessage(null);

    if (!title.trim() || !description.trim() || !objectives.trim()) {
      setErrorMessage(
        "Titre, description et objectifs sont obligatoires (étape Informations).",
      );
      setStep("info");
      return;
    }

    const payload: ModulePayload = {
      title: title.trim(),
      description: description.trim(),
      objectives: objectives.trim(),
    };

    if (coverBase64) {
      payload.cover_image_base64 = coverBase64;
    }

    if (mode === "create" || (editContents && contentsTouched)) {
      payload.contents = contents.map((c, index) => fromDraftContent(c, index));
    }

    if (mode === "create" || (editQuizzes && quizzesTouched)) {
      payload.quizzes = quizzes.map(fromDraftQuiz);
    }

    setPending(true);
    try {
      let saved: ModuleDetail;
      if (mode === "edit" && moduleId) {
        saved = await updateModule(moduleId, payload);
      } else {
        saved = await createModule(payload);
      }
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError) {
        const parsed = extractFieldErrors(err.payload);
        setErrors(parsed.fields);
        setErrorMessage(parsed.message || err.message);
        if (
          parsed.fields.title ||
          parsed.fields.description ||
          parsed.fields.objectives
        ) {
          setStep("info");
        } else if (
          parsed.fields.cover_image_base64 ||
          parsed.fields.cover_url
        ) {
          setStep("cover");
        } else if (parsed.fields.contents) {
          setStep("contents");
        } else if (parsed.fields.quizzes) {
          setStep("quizzes");
        }
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : "Sauvegarde impossible.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  const replaceWarning =
    mode === "edit" &&
    ((editContents && contentsTouched) || (editQuizzes && quizzesTouched));

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-neutral-4 bg-neutral-1 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-neutral-4 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-neutral-6 uppercase">
                {mode === "edit" ? `Module #${moduleId}` : "Nouveau module"}
              </p>
              <h2 className="text-h6 font-semibold text-neutral-8">
                {mode === "edit" ? "Modifier le module" : "Créer un module"}
              </h2>
              <p className="mt-1 text-xs text-neutral-6">
                Catalogue indépendant — réutilisable par plusieurs programmes.
              </p>
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
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => gotoStep(s.id)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 font-semibold transition ${
                  s.id === step
                    ? "bg-primary-1 text-white shadow-sm"
                    : "text-neutral-7 hover:bg-neutral-3"
                }`}
              >
                <Icon icon={s.icon} width={12} />
                <span className="hidden sm:inline">{i + 1}. </span>
                {s.label}
              </button>
            ))}
          </nav>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loadingDetail ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2"
                  />
                ))}
              </div>
            ) : loadError ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-small text-red-600 dark:text-red-300">
                {loadError}
              </div>
            ) : (
              <>
                {step === "info" ? (
                  <InfoStep
                    title={title}
                    description={description}
                    objectives={objectives}
                    onTitle={setTitle}
                    onDescription={setDescription}
                    onObjectives={setObjectives}
                    errors={errors}
                  />
                ) : null}

                {step === "cover" ? (
                  <CoverStep
                    preview={coverPreview}
                    fileName={coverFileName}
                    onPick={handlePickCover}
                    onClear={clearCoverChange}
                    error={coverError || errors.cover_image_base64?.[0]}
                    hasOriginal={Boolean(initial?.cover_url)}
                  />
                ) : null}

                {step === "contents" ? (
                  <ContentsStep
                    contents={contents}
                    addContent={addContent}
                    updateContent={updateContent}
                    removeContent={removeContent}
                    moveContent={moveContent}
                    editEnabled={mode === "create" || editContents}
                    onEnableEdit={() => {
                      setEditContents(true);
                      setContentsTouched(true);
                    }}
                    mode={mode}
                    error={errors.contents?.[0]}
                  />
                ) : null}

                {step === "quizzes" ? (
                  <QuizzesStep
                    quizzes={quizzes}
                    addQuiz={addQuiz}
                    updateQuiz={updateQuiz}
                    removeQuiz={removeQuiz}
                    addQuestion={addQuestion}
                    updateQuestion={updateQuestion}
                    removeQuestion={removeQuestion}
                    addAnswer={addAnswer}
                    updateAnswer={updateAnswer}
                    removeAnswer={removeAnswer}
                    setSingleCorrect={setSingleCorrect}
                    editEnabled={mode === "create" || editQuizzes}
                    onEnableEdit={() => {
                      setEditQuizzes(true);
                      setQuizzesTouched(true);
                    }}
                    mode={mode}
                    error={errors.quizzes?.[0]}
                  />
                ) : null}
              </>
            )}
          </div>

          <footer className="border-t border-neutral-4 bg-neutral-1 px-6 py-3">
            {replaceWarning ? (
              <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-800 dark:text-amber-200">
                <Icon
                  icon="solar:danger-triangle-bold"
                  width={14}
                  className="mr-1 inline align-text-bottom"
                />
                Attention : envoyer les contenus ou quiz remplace{" "}
                <strong>intégralement</strong> ceux du serveur (suppression puis
                recréation côté backend).
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-300">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-neutral-5">
                Étape {stepIndex + 1} / {STEPS.length}
              </div>
              <div className="flex items-center gap-2">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={() => gotoStep(STEPS[stepIndex - 1].id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-4 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
                  >
                    <Icon icon="solar:arrow-left-bold" width={12} />
                    Précédent
                  </button>
                ) : null}
                {stepIndex < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => gotoStep(STEPS[stepIndex + 1].id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-4 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
                  >
                    Suivant
                    <Icon icon="solar:arrow-right-bold" width={12} />
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={pending || loadingDetail}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                  {mode === "edit" ? "Enregistrer" : "Créer le module"}
                </button>
              </div>
            </div>
          </footer>
        </form>
      </aside>
    </div>
  );
}

// ────────────────────────────── Steps ──────────────────────────────

function InfoStep({
  title,
  description,
  objectives,
  onTitle,
  onDescription,
  onObjectives,
  errors,
}: {
  title: string;
  description: string;
  objectives: string;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  onObjectives: (value: string) => void;
  errors: FieldErrors;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="module-title"
          className="mb-1 block text-xs font-semibold text-neutral-7"
        >
          Titre <span className="text-red-500">*</span>
        </label>
        <input
          id="module-title"
          type="text"
          maxLength={255}
          required
          value={title}
          onChange={(event) => onTitle(event.target.value)}
          placeholder="Ex. Fondamentaux Python pour la donnée"
          className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
        />
        {errors.title?.[0] ? (
          <p className="mt-1 text-xs text-red-500">{errors.title[0]}</p>
        ) : null}
      </div>
      <div>
        <label
          htmlFor="module-description"
          className="mb-1 block text-xs font-semibold text-neutral-7"
        >
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="module-description"
          required
          rows={4}
          value={description}
          onChange={(event) => onDescription(event.target.value)}
          placeholder="Présentation du module, prérequis, audience…"
          className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
        />
        {errors.description?.[0] ? (
          <p className="mt-1 text-xs text-red-500">{errors.description[0]}</p>
        ) : null}
      </div>
      <div>
        <label
          htmlFor="module-objectives"
          className="mb-1 block text-xs font-semibold text-neutral-7"
        >
          Objectifs pédagogiques <span className="text-red-500">*</span>
        </label>
        <textarea
          id="module-objectives"
          required
          rows={4}
          value={objectives}
          onChange={(event) => onObjectives(event.target.value)}
          placeholder="Ce que l'apprenant saura faire à la fin du module."
          className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
        />
        {errors.objectives?.[0] ? (
          <p className="mt-1 text-xs text-red-500">{errors.objectives[0]}</p>
        ) : null}
      </div>
    </div>
  );
}

function CoverStep({
  preview,
  fileName,
  onPick,
  onClear,
  error,
  hasOriginal,
}: {
  preview: string | null;
  fileName: string | null;
  onPick: (file: File | null) => void;
  onClear: () => void;
  error?: string;
  hasOriginal: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-6">
        L&apos;image est encodée en base64 puis envoyée via le champ{" "}
        <code>cover_image_base64</code>. Le serveur renverra ensuite l&apos;URL
        absolue dans <code>cover_url</code>.
      </p>

      <div className="overflow-hidden rounded-2xl border border-neutral-4">
        {preview ? (
          /* eslint-disable-next-line @next/next/no-img-element -- aperçu local non maîtrisé, pas de next/image */
          <img
            src={preview}
            alt="Aperçu de la couverture"
            className="aspect-video w-full bg-neutral-2 object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-neutral-2 text-neutral-5">
            <Icon icon="solar:gallery-bold" width={32} />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-2 p-3">
        <label
          htmlFor="module-cover"
          className="block text-xs font-semibold text-neutral-7"
        >
          Choisir une image (PNG, JPEG, WebP — max 4 Mo)
        </label>
        <input
          id="module-cover"
          type="file"
          accept="image/*"
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
          className="mt-2 block w-full text-xs text-neutral-7 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-1 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-primary-2"
        />
        {fileName ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-neutral-7">
            <Icon icon="solar:file-bold" width={12} />
            <span className="truncate">{fileName}</span>
            <button
              type="button"
              onClick={onClear}
              className="ml-auto inline-flex items-center gap-1 text-xs text-neutral-6 hover:text-red-500"
            >
              <Icon icon="solar:close-circle-linear" width={12} />
              Annuler le changement
            </button>
          </div>
        ) : hasOriginal ? (
          <p className="mt-2 text-xs text-neutral-5">
            Une couverture est déjà définie. Choisir une nouvelle image la
            remplacera.
          </p>
        ) : null}
        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      </div>
    </div>
  );
}

function ContentsStep({
  contents,
  addContent,
  updateContent,
  removeContent,
  moveContent,
  editEnabled,
  onEnableEdit,
  mode,
  error,
}: {
  contents: DraftContent[];
  addContent: () => void;
  updateContent: (key: string, patch: Partial<DraftContent>) => void;
  removeContent: (key: string) => void;
  moveContent: (key: string, direction: -1 | 1) => void;
  editEnabled: boolean;
  onEnableEdit: () => void;
  mode: Mode;
  error?: string;
}) {
  return (
    <div className="space-y-3">
      {mode === "edit" && !editEnabled ? (
        <div className="flex items-start gap-2 rounded-2xl border border-neutral-4 bg-neutral-2 p-3 text-xs text-neutral-7">
          <Icon
            icon="solar:info-circle-bold"
            width={14}
            className="mt-0.5 shrink-0 text-primary-1"
          />
          <div className="min-w-0">
            <p>
              Les contenus actuels sont affichés en lecture seule. Activez la
              modification pour les remplacer (l&apos;API supprime puis
              recrée tous les contenus du module).
            </p>
            <button
              type="button"
              onClick={onEnableEdit}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-primary-3 bg-primary-5 px-2.5 py-1 text-[11px] font-semibold text-primary-1 hover:bg-primary-4"
            >
              <Icon icon="solar:pen-bold" width={12} />
              Activer l&apos;édition des contenus
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h3 className="text-small font-semibold text-neutral-8">
          Contenus ({contents.length})
        </h3>
        {editEnabled ? (
          <button
            type="button"
            onClick={addContent}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-4 px-3 py-1.5 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
          >
            <Icon icon="solar:add-circle-bold" width={12} />
            Ajouter un contenu
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500">
          {error}
        </p>
      ) : null}

      {contents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-2 p-6 text-center text-small text-neutral-6">
          Aucun contenu. Cliquez sur « Ajouter un contenu » pour démarrer.
        </div>
      ) : (
        <ul className="space-y-2">
          {contents.map((content, index) => (
            <li
              key={content._key}
              className="rounded-2xl border border-neutral-4 bg-neutral-2 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="rounded-full border border-neutral-4 bg-neutral-1 px-2 py-0.5 text-[11px] font-semibold text-neutral-7">
                  #{index + 1}
                </span>
                {editEnabled ? (
                  <div className="flex items-center gap-1">
                    <IconBtn
                      icon="solar:arrow-up-bold"
                      label="Monter"
                      onClick={() => moveContent(content._key, -1)}
                      disabled={index === 0}
                    />
                    <IconBtn
                      icon="solar:arrow-down-bold"
                      label="Descendre"
                      onClick={() => moveContent(content._key, 1)}
                      disabled={index === contents.length - 1}
                    />
                    <IconBtn
                      icon="solar:trash-bin-trash-bold"
                      label="Retirer"
                      tone="danger"
                      onClick={() => removeContent(content._key)}
                    />
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                <div>
                  <label className="sr-only" htmlFor={`c-title-${content._key}`}>
                    Titre du contenu
                  </label>
                  <input
                    id={`c-title-${content._key}`}
                    type="text"
                    value={content.title}
                    placeholder="Titre du contenu"
                    disabled={!editEnabled}
                    onChange={(event) =>
                      updateContent(content._key, { title: event.target.value })
                    }
                    className="w-full rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:outline-none disabled:opacity-70"
                  />
                </div>
                <div>
                  <label className="sr-only" htmlFor={`c-type-${content._key}`}>
                    Type
                  </label>
                  <select
                    id={`c-type-${content._key}`}
                    value={content.type}
                    disabled={!editEnabled}
                    onChange={(event) =>
                      updateContent(content._key, {
                        type: event.target.value as ModuleContentType,
                      })
                    }
                    className="w-full rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-small text-neutral-8 focus:border-primary-3 focus:outline-none disabled:opacity-70"
                  >
                    {CONTENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-2">
                <label className="sr-only" htmlFor={`c-desc-${content._key}`}>
                  Description
                </label>
                <textarea
                  id={`c-desc-${content._key}`}
                  rows={2}
                  value={content.description}
                  placeholder="Résumé / consigne…"
                  disabled={!editEnabled}
                  onChange={(event) =>
                    updateContent(content._key, {
                      description: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:outline-none disabled:opacity-70"
                />
              </div>

              <div className="mt-2">
                <label className="sr-only" htmlFor={`c-url-${content._key}`}>
                  URL
                </label>
                <input
                  id={`c-url-${content._key}`}
                  type="url"
                  value={content.url || ""}
                  placeholder="Lien vers la ressource (optionnel)"
                  disabled={!editEnabled}
                  onChange={(event) =>
                    updateContent(content._key, { url: event.target.value })
                  }
                  className="w-full rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:outline-none disabled:opacity-70"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuizzesStep({
  quizzes,
  addQuiz,
  updateQuiz,
  removeQuiz,
  addQuestion,
  updateQuestion,
  removeQuestion,
  addAnswer,
  updateAnswer,
  removeAnswer,
  setSingleCorrect,
  editEnabled,
  onEnableEdit,
  mode,
  error,
}: {
  quizzes: DraftQuiz[];
  addQuiz: () => void;
  updateQuiz: (key: string, patch: Partial<DraftQuiz>) => void;
  removeQuiz: (key: string) => void;
  addQuestion: (quizKey: string) => void;
  updateQuestion: (
    quizKey: string,
    questionKey: string,
    patch: Partial<DraftQuestion>,
  ) => void;
  removeQuestion: (quizKey: string, questionKey: string) => void;
  addAnswer: (quizKey: string, questionKey: string) => void;
  updateAnswer: (
    quizKey: string,
    questionKey: string,
    answerKey: string,
    patch: Partial<DraftAnswer>,
  ) => void;
  removeAnswer: (
    quizKey: string,
    questionKey: string,
    answerKey: string,
  ) => void;
  setSingleCorrect: (
    quizKey: string,
    questionKey: string,
    answerKey: string,
  ) => void;
  editEnabled: boolean;
  onEnableEdit: () => void;
  mode: Mode;
  error?: string;
}) {
  return (
    <div className="space-y-3">
      {mode === "edit" && !editEnabled ? (
        <div className="flex items-start gap-2 rounded-2xl border border-neutral-4 bg-neutral-2 p-3 text-xs text-neutral-7">
          <Icon
            icon="solar:info-circle-bold"
            width={14}
            className="mt-0.5 shrink-0 text-primary-1"
          />
          <div>
            <p>
              Les quiz sont affichés en lecture seule. Activer la modification
              entraînera la suppression et la recréation de tous les quiz du
              module à l&apos;envoi.
            </p>
            <button
              type="button"
              onClick={onEnableEdit}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-primary-3 bg-primary-5 px-2.5 py-1 text-[11px] font-semibold text-primary-1 hover:bg-primary-4"
            >
              <Icon icon="solar:pen-bold" width={12} />
              Activer l&apos;édition des quiz
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h3 className="text-small font-semibold text-neutral-8">
          Quiz ({quizzes.length})
        </h3>
        {editEnabled ? (
          <button
            type="button"
            onClick={addQuiz}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-4 px-3 py-1.5 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
          >
            <Icon icon="solar:add-circle-bold" width={12} />
            Ajouter un quiz
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500">
          {error}
        </p>
      ) : null}

      {quizzes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-2 p-6 text-center text-small text-neutral-6">
          Aucun quiz. Vous pouvez en ajouter pour évaluer les apprenants.
        </div>
      ) : (
        <ul className="space-y-3">
          {quizzes.map((quiz, qIndex) => (
            <li
              key={quiz._key}
              className="rounded-2xl border border-neutral-4 bg-neutral-2 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="rounded-full border border-neutral-4 bg-neutral-1 px-2 py-0.5 text-[11px] font-semibold text-neutral-7">
                  Quiz #{qIndex + 1}
                </span>
                {editEnabled ? (
                  <IconBtn
                    icon="solar:trash-bin-trash-bold"
                    label="Retirer le quiz"
                    tone="danger"
                    onClick={() => removeQuiz(quiz._key)}
                  />
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                <input
                  type="text"
                  value={quiz.title}
                  placeholder="Titre du quiz"
                  disabled={!editEnabled}
                  onChange={(event) =>
                    updateQuiz(quiz._key, { title: event.target.value })
                  }
                  aria-label="Titre du quiz"
                  className="w-full rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:outline-none disabled:opacity-70"
                />
                <div>
                  <label
                    htmlFor={`quiz-min-${quiz._key}`}
                    className="sr-only"
                  >
                    Score minimum (%)
                  </label>
                  <input
                    id={`quiz-min-${quiz._key}`}
                    type="number"
                    min={0}
                    max={100}
                    value={
                      typeof quiz.min_score_rate === "number"
                        ? quiz.min_score_rate
                        : 0
                    }
                    placeholder="Score min %"
                    disabled={!editEnabled}
                    onChange={(event) =>
                      updateQuiz(quiz._key, {
                        min_score_rate: Number(event.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-small text-neutral-8 focus:border-primary-3 focus:outline-none disabled:opacity-70"
                  />
                </div>
              </div>

              <textarea
                rows={2}
                value={quiz.description || ""}
                placeholder="Description / consigne du quiz (optionnel)"
                disabled={!editEnabled}
                onChange={(event) =>
                  updateQuiz(quiz._key, { description: event.target.value })
                }
                aria-label="Description du quiz"
                className="mt-2 w-full rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:outline-none disabled:opacity-70"
              />

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-neutral-7">
                    Questions ({quiz.questions.length})
                  </p>
                  {editEnabled ? (
                    <button
                      type="button"
                      onClick={() => addQuestion(quiz._key)}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-4 bg-neutral-1 px-2 py-1 text-[11px] font-semibold text-neutral-7 hover:bg-neutral-3"
                    >
                      <Icon icon="solar:add-circle-bold" width={10} />
                      Ajouter une question
                    </button>
                  ) : null}
                </div>

                {quiz.questions.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-neutral-4 bg-neutral-1 p-3 text-center text-xs text-neutral-6">
                    Aucune question.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {quiz.questions.map((question, qqIndex) => {
                      const isMultiple = question.type === "multiple";
                      return (
                        <li
                          key={question._key}
                          className="rounded-xl border border-neutral-4 bg-neutral-1 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-neutral-7">
                              Q{qqIndex + 1}
                            </span>
                            {editEnabled ? (
                              <IconBtn
                                icon="solar:trash-bin-trash-bold"
                                label="Retirer la question"
                                tone="danger"
                                onClick={() =>
                                  removeQuestion(quiz._key, question._key)
                                }
                              />
                            ) : null}
                          </div>

                          <div className="grid gap-2 sm:grid-cols-[1fr_120px_90px]">
                            <input
                              type="text"
                              value={question.content}
                              placeholder="Énoncé de la question"
                              disabled={!editEnabled}
                              onChange={(event) =>
                                updateQuestion(quiz._key, question._key, {
                                  content: event.target.value,
                                })
                              }
                              aria-label="Énoncé de la question"
                              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:outline-none disabled:opacity-70"
                            />
                            <select
                              value={question.type ?? "single"}
                              disabled={!editEnabled}
                              onChange={(event) =>
                                updateQuestion(quiz._key, question._key, {
                                  type: event.target.value as QuestionType,
                                })
                              }
                              aria-label="Type de question"
                              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 focus:border-primary-3 focus:outline-none disabled:opacity-70"
                            >
                              {QUESTION_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={0}
                              value={question.points ?? 1}
                              disabled={!editEnabled}
                              onChange={(event) =>
                                updateQuestion(quiz._key, question._key, {
                                  points: Number(event.target.value),
                                })
                              }
                              aria-label="Points"
                              placeholder="Pts"
                              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 focus:border-primary-3 focus:outline-none disabled:opacity-70"
                            />
                          </div>

                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] text-neutral-6">
                                Réponses ({question.answers.length})
                              </p>
                              {editEnabled ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    addAnswer(quiz._key, question._key)
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-1 hover:underline"
                                >
                                  <Icon
                                    icon="solar:add-circle-linear"
                                    width={10}
                                  />
                                  Ajouter une réponse
                                </button>
                              ) : null}
                            </div>
                            <ul className="space-y-1.5">
                              {question.answers.map((answer) => (
                                <li
                                  key={answer._key}
                                  className="flex items-center gap-2"
                                >
                                  {editEnabled ? (
                                    isMultiple ? (
                                      <input
                                        type="checkbox"
                                        checked={Boolean(answer.is_correct)}
                                        onChange={(event) =>
                                          updateAnswer(
                                            quiz._key,
                                            question._key,
                                            answer._key,
                                            { is_correct: event.target.checked },
                                          )
                                        }
                                        aria-label="Réponse correcte"
                                        className="h-4 w-4 accent-primary-1"
                                      />
                                    ) : (
                                      <input
                                        type="radio"
                                        name={`q-${question._key}`}
                                        checked={Boolean(answer.is_correct)}
                                        onChange={() =>
                                          setSingleCorrect(
                                            quiz._key,
                                            question._key,
                                            answer._key,
                                          )
                                        }
                                        aria-label="Réponse correcte"
                                        className="h-4 w-4 accent-primary-1"
                                      />
                                    )
                                  ) : (
                                    <Icon
                                      icon={
                                        answer.is_correct
                                          ? "solar:check-circle-bold"
                                          : "solar:close-circle-linear"
                                      }
                                      width={14}
                                      className={
                                        answer.is_correct
                                          ? "text-emerald-500"
                                          : "text-neutral-5"
                                      }
                                    />
                                  )}
                                  <input
                                    type="text"
                                    value={answer.content}
                                    placeholder="Texte de la réponse"
                                    disabled={!editEnabled}
                                    onChange={(event) =>
                                      updateAnswer(
                                        quiz._key,
                                        question._key,
                                        answer._key,
                                        { content: event.target.value },
                                      )
                                    }
                                    aria-label="Texte de la réponse"
                                    className="w-full rounded-lg border border-neutral-4 bg-neutral-2 px-2 py-1 text-xs text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:outline-none disabled:opacity-70"
                                  />
                                  {editEnabled ? (
                                    <IconBtn
                                      icon="solar:close-bold"
                                      label="Retirer"
                                      tone="danger"
                                      onClick={() =>
                                        removeAnswer(
                                          quiz._key,
                                          question._key,
                                          answer._key,
                                        )
                                      }
                                    />
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconBtn({
  icon,
  label,
  onClick,
  disabled,
  tone = "neutral",
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  const classes =
    tone === "danger"
      ? "text-red-500 hover:bg-red-500/10"
      : "text-neutral-6 hover:bg-neutral-3";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-7 w-7 items-center justify-center rounded-lg ${classes} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <Icon icon={icon} width={12} />
    </button>
  );
}
