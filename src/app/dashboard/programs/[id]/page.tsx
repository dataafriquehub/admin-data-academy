"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import ConfirmAction from "@/components/ConfirmAction";
import ProgramFormDrawer from "@/components/programs/ProgramFormDrawer";
import ProgramModulesEditor from "@/components/programs/ProgramModulesEditor";
import ProgramValidationPanel from "@/components/programs/ProgramValidationPanel";
import {
  deleteProgram,
  getProgram,
  programIsEditableBy,
  updateProgram,
  type Program,
  type ValidationStatus,
} from "@/services/programService";

const STATUS_META: Record<
  ValidationStatus,
  { label: string; icon: string; classes: string }
> = {
  pending: {
    label: "En attente",
    icon: "solar:clock-circle-bold",
    classes:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  approved: {
    label: "En ligne",
    icon: "solar:check-circle-bold",
    classes:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejeté",
    icon: "solar:close-circle-bold",
    classes: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300",
  },
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(price: string, currency?: string | null): string {
  if (!price) return "—";
  const num = Number(price);
  if (Number.isNaN(num)) return `${price} ${currency || ""}`.trim();
  if (num <= 0) return "Gratuit";
  return `${num.toLocaleString("fr-FR")} ${currency || ""}`.trim();
}

function userLabel(user?: Program["creator"]): string {
  if (!user) return "Auteur non renseigné";
  return (
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.email ||
    `Utilisateur #${user.id}`
  );
}

export default function ProgramDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const router = useRouter();
  const { user, ready } = useAuth();
  const role = user?.role;
  const isAdmin = role === "admin";

  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(
    null,
  );

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [unapproving, setUnapproving] = useState(false);
  const [validationAction, setValidationAction] = useState<
    "approve" | "unapprove" | null
  >(null);
  const [actionMessage, setActionMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const loadProgram = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setError({ message: "Identifiant de programme invalide." });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getProgram(id);
      setProgram(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ status: err.status, message: err.message });
      } else {
        setError({
          message:
            err instanceof Error ? err.message : "Programme introuvable.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!ready) return;
    /* eslint-disable react-hooks/set-state-in-effect -- chargement initial du détail */
    void loadProgram();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [ready, loadProgram]);

  useEffect(() => {
    if (!actionMessage) return;
    const timeout = setTimeout(() => setActionMessage(null), 5000);
    return () => clearTimeout(timeout);
  }, [actionMessage]);

  function handleSaved(next: Program) {
    setProgram((prev) => ({ ...(prev ?? next), ...next }));
  }

  function describeApiError(err: unknown, fallback: string): string {
    if (err instanceof ApiError) {
      if (err.status >= 500)
        return `Erreur serveur (${err.status}). Réessayez plus tard ou contactez l'équipe technique.`;
      return err.message || fallback;
    }
    return err instanceof Error ? err.message : fallback;
  }

  async function confirmDelete() {
    if (!program) return;
    setDeleting(true);
    try {
      await deleteProgram(program.id);
      router.replace("/dashboard/programs");
    } catch (err) {
      setActionMessage({
        kind: "error",
        text: describeApiError(err, "Suppression impossible."),
      });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function quickApprove() {
    if (!program || !isAdmin) return;
    setApproving(true);
    setActionMessage(null);
    try {
      const saved = await updateProgram(program.id, {
        validation_status: "approved",
      });
      handleSaved(saved);
      setActionMessage({ kind: "success", text: "Programme approuvé." });
    } catch (err) {
      setActionMessage({
        kind: "error",
        text: describeApiError(err, "Approbation impossible."),
      });
    } finally {
      setApproving(false);
    }
  }

  async function quickUnapprove() {
    if (!program || !isAdmin) return;
    setUnapproving(true);
    setActionMessage(null);
    try {
      const saved = await updateProgram(program.id, {
        validation_status: "pending",
      });
      handleSaved(saved);
      setActionMessage({
        kind: "success",
        text: "Programme repassé en attente.",
      });
    } catch (err) {
      setActionMessage({
        kind: "error",
        text: describeApiError(err, "Désapprobation impossible."),
      });
    } finally {
      setUnapproving(false);
    }
  }

  if (loading || !ready) {
    return (
      <div className="space-y-4 px-4 py-6 lg:px-8">
        <div className="h-6 w-40 animate-pulse rounded-lg bg-neutral-3" />
        <div className="h-44 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2" />
        <div className="h-32 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2" />
        <div className="h-44 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2" />
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="px-4 py-10 lg:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <Icon
            icon={
              error?.status === 403
                ? "solar:lock-keyhole-bold"
                : "solar:danger-triangle-bold"
            }
            width={28}
            className="mx-auto text-red-600 dark:text-red-300"
          />
          <h1 className="mt-3 text-h5 font-semibold text-red-600 dark:text-red-300">
            {error?.status === 403
              ? "Accès refusé"
              : error?.status === 404
                ? "Programme introuvable"
                : "Chargement impossible"}
          </h1>
          <p className="mt-1 text-small text-red-600/80 dark:text-red-200">
            {error?.message ?? "Une erreur est survenue."}
          </p>
          <Link
            href="/dashboard/programs"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/25 dark:text-red-300"
          >
            <Icon icon="solar:alt-arrow-left-linear" width={14} />
            Retour à la liste
          </Link>
        </div>
      </div>
    );
  }

  const meta = program.validation_status
    ? STATUS_META[program.validation_status]
    : null;
  const canEdit = programIsEditableBy(program, user);

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <nav>
        <Link
          href="/dashboard/programs"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-1 hover:underline"
        >
          <Icon icon="solar:alt-arrow-left-linear" width={12} />
          Programmes
        </Link>
      </nav>

      {actionMessage ? (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-small ${
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
            width={16}
            className="mt-0.5 shrink-0"
          />
          <p>{actionMessage.text}</p>
        </div>
      ) : null}

      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-neutral-4 bg-neutral-1 shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
          <div className="aspect-video w-full bg-neutral-2 lg:aspect-auto lg:h-full">
            {program.cover_url ? (
              /* eslint-disable-next-line @next/next/no-img-element -- couverture distante non maîtrisée */
              <img
                src={program.cover_url}
                alt={program.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-neutral-5">
                <Icon icon="solar:gallery-bold" width={36} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {program.category?.label || program.tag ? (
                  <p className="text-[11px] font-semibold tracking-wide text-neutral-6 uppercase">
                    {program.category?.label ?? program.tag}
                  </p>
                ) : null}
                <h1 className="mt-1 text-h4 font-semibold wrap-break-word text-neutral-8">
                  {program.title}
                </h1>
              </div>
              {meta ? (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.classes}`}
                >
                  <Icon icon={meta.icon} width={12} />
                  {meta.label}
                </span>
              ) : null}
            </div>

            <p className="line-clamp-4 text-small text-neutral-7">
              {program.description}
            </p>

            <div className="grid gap-2 text-xs sm:grid-cols-3">
              <InfoChip
                icon="solar:calendar-bold"
                label="Période"
                value={`${formatDate(program.start_date)} → ${formatDate(program.end_date)}`}
              />
              <InfoChip
                icon="solar:clock-circle-bold"
                label="Durée"
                value={`${program.length_in_weeks} sem.`}
              />
              <InfoChip
                icon="solar:wallet-money-bold"
                label="Prix"
                value={formatPrice(program.price, program.currency)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {isAdmin && program.validation_status !== "approved" ? (
                <button
                  type="button"
                  onClick={() => setValidationAction("approve")}
                  disabled={approving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon
                    icon={
                      approving
                        ? "svg-spinners:90-ring-with-bg"
                        : "solar:check-circle-bold"
                    }
                    width={14}
                  />
                  {approving ? "Approbation…" : "Approuver le programme"}
                </button>
              ) : null}
              {isAdmin && program.validation_status === "approved" ? (
                <button
                  type="button"
                  onClick={() => setValidationAction("unapprove")}
                  disabled={unapproving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-300"
                >
                  <Icon
                    icon={
                      unapproving
                        ? "svg-spinners:90-ring-with-bg"
                        : "solar:clock-circle-bold"
                    }
                    width={14}
                  />
                  {unapproving ? "Changement…" : "Désapprouver"}
                </button>
              ) : null}
              {canEdit ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
                  >
                    <Icon icon="solar:pen-2-linear" width={14} />
                    Modifier les infos
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/10 dark:text-red-300"
                  >
                    <Icon icon="solar:trash-bin-trash-linear" width={14} />
                    Supprimer
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => loadProgram()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-4 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
              >
                <Icon icon="solar:refresh-circle-linear" width={14} />
                Rafraîchir
              </button>
            </div>

            {program.validation_comment ? (
              <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                <p className="font-semibold">Commentaire de validation</p>
                <p className="mt-1 whitespace-pre-line">
                  {program.validation_comment}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Méta admin */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetaCard
          icon="solar:user-bold"
          label="Créé par"
          value={
            program.creator
              ? userLabel(program.creator)
              : program.created_by
                ? `Utilisateur #${program.created_by}`
                : "—"
          }
        />
        <MetaCard
          icon="solar:shield-keyhole-bold"
          label="Validé par"
          value={
            program.validated_by_user
              ? userLabel(program.validated_by_user)
              : program.validated_by
                ? `Utilisateur #${program.validated_by}`
                : "—"
          }
        />
        <MetaCard
          icon="solar:calendar-bold"
          label="Validation"
          value={formatDateTime(program.validated_at)}
        />
        <MetaCard
          icon="solar:plus-circle-bold"
          label="Créé le"
          value={formatDateTime(program.created_at)}
        />
        <MetaCard
          icon="solar:refresh-circle-bold"
          label="Mis à jour"
          value={formatDateTime(program.updated_at)}
        />
        {program.cover_url ? (
          <MetaCard
            icon="solar:gallery-bold"
            label="Couverture"
            value={program.cover_url}
            link={program.cover_url}
          />
        ) : null}
      </section>

      {/* Validation admin */}
      {isAdmin ? (
        <ProgramValidationPanel program={program} onSaved={handleSaved} />
      ) : null}

      {/* Modules */}
      <ProgramModulesEditor
        program={program}
        canEdit={canEdit}
        onSaved={handleSaved}
      />

      <ProgramFormDrawer
        open={editOpen}
        programId={program.id}
        initial={program}
        onClose={() => setEditOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmAction
        isOpen={deleteOpen}
        title="Supprimer ce programme ?"
        description={`« ${program.title} » sera retiré du catalogue. Cette action est irréversible.`}
        confirmLabel={deleting ? "Suppression…" : "Supprimer"}
        cancelLabel="Annuler"
        variant="danger"
        icon="solar:trash-bin-trash-bold"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmAction
        isOpen={Boolean(validationAction)}
        title={
          validationAction === "approve"
            ? "Approuver ce programme ?"
            : "Désapprouver ce programme ?"
        }
        description={
          validationAction === "approve"
            ? `« ${program.title} » sera visible dans le catalogue public.`
            : `« ${program.title} » repassera en attente et ne sera plus considéré comme publié.`
        }
        confirmLabel={
          validationAction === "approve"
            ? approving
              ? "Approbation…"
              : "Approuver"
            : unapproving
              ? "Changement…"
              : "Désapprouver"
        }
        cancelLabel="Annuler"
        variant={validationAction === "approve" ? "primary" : "warning"}
        icon={
          validationAction === "approve"
            ? "solar:check-circle-bold"
            : "solar:clock-circle-bold"
        }
        onConfirm={() => {
          const action = validationAction;
          setValidationAction(null);
          if (action === "approve") {
            void quickApprove();
          } else if (action === "unapprove") {
            void quickUnapprove();
          }
        }}
        onCancel={() => setValidationAction(null)}
      />
    </div>
  );
}

function InfoChip({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-neutral-4 bg-neutral-2 px-2.5 py-1.5">
      <Icon icon={icon} width={14} className="text-neutral-6" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-wide text-neutral-5 uppercase">
          {label}
        </p>
        <p className="truncate text-xs font-semibold text-neutral-8">{value}</p>
      </div>
    </div>
  );
}

function MetaCard({
  icon,
  label,
  value,
  link,
}: {
  icon: string;
  label: string;
  value: string;
  link?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-neutral-4 bg-neutral-1 p-3 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-3 text-neutral-7">
        <Icon icon={icon} width={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-neutral-6 uppercase">
          {label}
        </p>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-small font-semibold text-primary-1 hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="truncate text-small font-semibold text-neutral-8">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
