"use client";

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import {
  sendNotification,
  type NotificationPriority,
  type NotificationRoleTarget,
  type NotificationType,
  type SendNotificationResponse,
} from "@/services/notificationService";
import {
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_ROLES,
  NOTIFICATION_TYPES,
  ROLE_LABELS,
  notificationPriorityLabel,
  notificationTypeLabel,
} from "./notification-utils";
import UserPicker from "./UserPicker";

type FieldErrors = Record<string, string[]>;

function extractFieldErrors(payload: unknown): {
  fields: FieldErrors;
  message: string | null;
} {
  if (!payload || typeof payload !== "object") {
    return { fields: {}, message: null };
  }
  const obj = payload as Record<string, unknown>;
  const fields: FieldErrors = {};
  let nonField: string | null = null;
  for (const [key, value] of Object.entries(obj)) {
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

export default function BroadcastComposer() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NotificationType>("general");
  const [priority, setPriority] = useState<NotificationPriority>("medium");
  const [metadataText, setMetadataText] = useState("");
  const [roles, setRoles] = useState<NotificationRoleTarget[]>([]);
  const [userIds, setUserIds] = useState<number[]>([]);

  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SendNotificationResponse | null>(null);

  const metadataError = useMemo(() => {
    if (!metadataText.trim()) return null;
    try {
      const parsed = JSON.parse(metadataText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return null;
      return "Le metadata doit être un objet JSON.";
    } catch {
      return "JSON invalide.";
    }
  }, [metadataText]);

  function toggleRole(role: NotificationRoleTarget) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  function reset() {
    setTitle("");
    setMessage("");
    setType("general");
    setPriority("medium");
    setMetadataText("");
    setRoles([]);
    setUserIds([]);
    setErrors({});
    setErrorMessage(null);
    setResult(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setErrorMessage(null);
    setResult(null);

    if (roles.length === 0 && userIds.length === 0) {
      setErrorMessage(
        "Sélectionnez au moins un rôle ou un utilisateur cible.",
      );
      return;
    }
    if (metadataError) {
      setErrors((prev) => ({ ...prev, metadata: [metadataError] }));
      return;
    }

    let metadata: Record<string, unknown> | undefined;
    if (metadataText.trim()) {
      try {
        metadata = JSON.parse(metadataText) as Record<string, unknown>;
      } catch {
        setErrors((prev) => ({ ...prev, metadata: ["JSON invalide."] }));
        return;
      }
    }

    setPending(true);
    try {
      const res = await sendNotification({
        title,
        message,
        type,
        priority,
        ...(metadata ? { metadata } : {}),
        ...(roles.length ? { roles } : {}),
        ...(userIds.length ? { user_ids: userIds } : {}),
      });
      setResult(res);
    } catch (err) {
      if (err instanceof ApiError) {
        const parsed = extractFieldErrors(err.payload);
        setErrors(parsed.fields);
        setErrorMessage(parsed.message || err.message);
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : "Envoi impossible.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  const targetCountNominal = roles.length * 0 + userIds.length;

  return (
    <section className="rounded-2xl border border-neutral-4 bg-neutral-1 p-5">
      <header className="flex items-start gap-3 border-b border-neutral-4 pb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-5 text-primary-1">
          <Icon icon="solar:bell-bing-bold" width={18} />
        </span>
        <div>
          <h3 className="text-h6 font-semibold text-neutral-8">
            Diffusion ciblée
          </h3>
          <p className="mt-1 text-xs text-neutral-6">
            Envoyez une notification in-app (et un email selon les préférences
            utilisateur). Certains comptes peuvent être exclus selon leurs
            réglages — le compteur réel est dans la réponse serveur.
          </p>
        </div>
      </header>

      <form className="mt-5 grid gap-5 lg:grid-cols-2" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="broadcast-title"
              className="mb-1 block text-xs font-semibold text-neutral-7"
            >
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              id="broadcast-title"
              required
              maxLength={255}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex. Nouvelle session de mentorat"
              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
            />
            {errors.title?.[0] ? (
              <p className="mt-1 text-xs text-red-500">{errors.title[0]}</p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="broadcast-message"
              className="mb-1 block text-xs font-semibold text-neutral-7"
            >
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="broadcast-message"
              required
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Rédigez le contenu envoyé aux destinataires (in-app + email)…"
              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
            />
            {errors.message?.[0] ? (
              <p className="mt-1 text-xs text-red-500">{errors.message[0]}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="broadcast-type"
                className="mb-1 block text-xs font-semibold text-neutral-7"
              >
                Type
              </label>
              <select
                id="broadcast-type"
                value={type}
                onChange={(event) => setType(event.target.value as NotificationType)}
                className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 focus:border-primary-3 focus:outline-none"
              >
                {NOTIFICATION_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {notificationTypeLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="broadcast-priority"
                className="mb-1 block text-xs font-semibold text-neutral-7"
              >
                Priorité
              </label>
              <select
                id="broadcast-priority"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as NotificationPriority)
                }
                className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 focus:border-primary-3 focus:outline-none"
              >
                {NOTIFICATION_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {notificationPriorityLabel(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="broadcast-metadata"
              className="mb-1 block text-xs font-semibold text-neutral-7"
            >
              Metadata (JSON, optionnel)
            </label>
            <textarea
              id="broadcast-metadata"
              rows={3}
              value={metadataText}
              onChange={(event) => setMetadataText(event.target.value)}
              placeholder='{"campaign":"spring_2026","cta_url":"/dashboard/programs"}'
              className={`w-full rounded-xl border bg-neutral-2 px-3 py-2 font-mono text-xs text-neutral-8 placeholder:text-neutral-5 focus:bg-neutral-1 focus:outline-none ${
                metadataError
                  ? "border-red-500/40 focus:border-red-500"
                  : "border-neutral-4 focus:border-primary-3"
              }`}
            />
            {(metadataError || errors.metadata?.[0]) ? (
              <p className="mt-1 text-xs text-red-500">
                {errors.metadata?.[0] || metadataError}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-neutral-5">
                Utilisé pour les deep links (ex. <code>conversation_id</code>,{" "}
                <code>program_id</code>).
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-4 bg-neutral-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-6">
              Cibler par rôles
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {NOTIFICATION_ROLES.map((role) => {
                const active = roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-primary-3 bg-primary-1 text-white"
                        : "border-neutral-4 bg-neutral-1 text-neutral-7 hover:bg-neutral-3"
                    }`}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                );
              })}
            </div>
            {errors.roles?.[0] ? (
              <p className="mt-2 text-xs text-red-500">{errors.roles[0]}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-neutral-4 bg-neutral-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-6">
              Utilisateurs précis
            </p>
            <p className="mt-1 mb-3 text-[11px] text-neutral-5">
              Recherche par nom, email ou rôle (chargé depuis{" "}
              <code>/users/auth/users/</code>).
            </p>
            <UserPicker
              value={userIds}
              onChange={setUserIds}
              disabled={pending}
            />
            {errors.user_ids?.[0] ? (
              <p className="mt-2 text-xs text-red-500">{errors.user_ids[0]}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-2 p-3 text-xs text-neutral-6">
            <p>
              <Icon
                icon="solar:info-circle-linear"
                width={14}
                className="mr-1 inline align-text-bottom"
              />
              {roles.length === 0 && userIds.length === 0 ? (
                "Sélectionnez au moins un rôle ou un utilisateur."
              ) : (
                <>
                  <strong>{userIds.length}</strong> utilisateur
                  {userIds.length > 1 ? "s" : ""} explicite
                  {userIds.length > 1 ? "s" : ""} +{" "}
                  <strong>{roles.length}</strong> rôle
                  {roles.length > 1 ? "s" : ""} ciblé
                  {roles.length > 1 ? "s" : ""}. Le serveur applique ensuite les
                  préférences utilisateurs avant création.
                </>
              )}
            </p>
          </div>
        </div>

        {errorMessage ? (
          <div className="lg:col-span-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
            {errorMessage}
          </div>
        ) : null}

        {result ? (
          <div className="lg:col-span-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-small text-emerald-700 dark:text-emerald-300">
            <p className="flex items-center gap-2 font-semibold">
              <Icon icon="solar:check-circle-bold" width={16} />
              Diffusion envoyée.
            </p>
            <p className="mt-1 text-xs">
              <strong>{result.created ?? 0}</strong> notifications créées
              {typeof result.email_sent === "number" ? (
                <>
                  {" "}
                  · <strong>{result.email_sent}</strong> e-mails partis
                </>
              ) : null}
              .
            </p>
            {(result.target_roles?.length || result.target_user_ids?.length) ? (
              <p className="mt-1 text-[11px] opacity-80">
                Cibles serveur :
                {result.target_roles?.length
                  ? ` rôles ${result.target_roles.join(", ")}`
                  : ""}
                {result.target_user_ids?.length
                  ? ` · ${result.target_user_ids.length} ID(s)`
                  : ""}
                .
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="lg:col-span-2 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-4 px-4 py-2 text-small font-semibold text-neutral-7 hover:bg-neutral-3 disabled:opacity-50"
          >
            Réinitialiser
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-1 px-4 py-2 text-small font-semibold text-white shadow-sm transition hover:bg-primary-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Icon icon="svg-spinners:90-ring-with-bg" width={14} />
            ) : (
              <Icon icon="solar:plain-bold" width={14} />
            )}
            Envoyer la diffusion
            {targetCountNominal > 0 && roles.length === 0 ? (
              <span className="rounded-full bg-white/20 px-1.5 text-xs">
                {targetCountNominal}
              </span>
            ) : null}
          </button>
        </div>
      </form>
    </section>
  );
}
