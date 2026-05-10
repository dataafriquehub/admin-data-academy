"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import {
  updateProgram,
  type Program,
  type ValidationStatus,
} from "@/services/programService";

type Props = {
  program: Program;
  onSaved: (next: Program) => void;
};

const STATUS_OPTIONS: {
  value: ValidationStatus;
  label: string;
  description: string;
  icon: string;
  classes: string;
}[] = [
  {
    value: "approved",
    label: "Approuver",
    description: "Le programme apparaît dans le catalogue public.",
    icon: "solar:check-circle-bold",
    classes:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    value: "pending",
    label: "Remettre en attente",
    description: "Repasse en revue interne.",
    icon: "solar:clock-circle-bold",
    classes:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300",
  },
  {
    value: "rejected",
    label: "Rejeter",
    description: "Refusé. Pensez à ajouter un commentaire.",
    icon: "solar:close-circle-bold",
    classes:
      "border-red-500/40 bg-red-500/10 text-red-600 hover:bg-red-500/15 dark:text-red-300",
  },
];

export default function ProgramValidationPanel({ program, onSaved }: Props) {
  const [status, setStatus] = useState<ValidationStatus>(
    program.validation_status ?? "pending",
  );
  const [comment, setComment] = useState(program.validation_comment ?? "");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- synchroniser quand le programme change */
    setStatus(program.validation_status ?? "pending");
    setComment(program.validation_comment ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [program.validation_status, program.validation_comment]);

  async function submit(targetStatus: ValidationStatus) {
    setPending(true);
    setErrorMessage(null);
    setSuccess(null);
    try {
      const trimmed = comment.trim();
      const payload: {
        validation_status: ValidationStatus;
        validation_comment?: string;
      } = { validation_status: targetStatus };
      if (trimmed) payload.validation_comment = trimmed;
      const saved = await updateProgram(program.id, payload);
      onSaved(saved);
      setStatus(saved.validation_status ?? targetStatus);
      setSuccess(
        targetStatus === "approved"
          ? "Programme approuvé."
          : targetStatus === "rejected"
            ? "Programme rejeté."
            : "Programme remis en attente.",
      );
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status >= 500) {
          setErrorMessage(
            `Erreur serveur (${err.status}). Réessayez plus tard ou contactez l'équipe technique.`,
          );
        } else {
          setErrorMessage(err.message || "Action impossible.");
        }
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : "Action impossible.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-4 bg-neutral-1 shadow-sm">
      <header className="flex items-center justify-between border-b border-neutral-4 px-4 py-3">
        <div>
          <h2 className="text-h6 font-semibold text-neutral-8">
            Validation admin
          </h2>
          <p className="text-xs text-neutral-5">
            Statut courant&nbsp;:{" "}
            <span className="font-semibold text-neutral-7">{status}</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary-3 bg-primary-5 px-2 py-0.5 text-[11px] font-semibold text-primary-1">
          <Icon icon="solar:shield-keyhole-bold" width={10} />
          Admin
        </span>
      </header>

      <div className="space-y-3 px-4 py-4">
        {success ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-small text-emerald-700 dark:text-emerald-300">
            {success}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-small text-red-600 dark:text-red-300">
            {errorMessage}
          </div>
        ) : null}

        <label className="flex flex-col gap-1 text-small text-neutral-7">
          <span>Commentaire (motif de rejet, demandes…)</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={4}
            className="w-full resize-y rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
            placeholder="Ajoutez un commentaire visible côté concepteur…"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-3">
          {STATUS_OPTIONS.map((option) => {
            const isCurrent = status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => void submit(option.value)}
                disabled={pending || isCurrent}
                className={`flex h-full flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left text-small transition disabled:cursor-not-allowed disabled:opacity-60 ${option.classes}`}
              >
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Icon icon={option.icon} width={14} />
                  {option.label}
                </span>
                <span className="text-xs opacity-80">
                  {isCurrent ? "Statut courant" : option.description}
                </span>
              </button>
            );
          })}
        </div>

        {program.validated_by_user || program.validated_at ? (
          <p className="text-[11px] text-neutral-5">
            Dernière validation
            {program.validated_by_user
              ? ` par ${
                  [
                    program.validated_by_user.first_name,
                    program.validated_by_user.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ")
                    .trim() ||
                  program.validated_by_user.email ||
                  `Utilisateur #${program.validated_by_user.id}`
                }`
              : ""}
            {program.validated_at
              ? ` • ${new Date(program.validated_at).toLocaleString("fr-FR")}`
              : ""}
            .
          </p>
        ) : null}
      </div>
    </section>
  );
}
