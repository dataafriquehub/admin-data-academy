"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import type { User, UserRole } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { fetchCurrentUser } from "@/services/userProfileService";

const ROLE_META: Record<
  UserRole,
  { label: string; classes: string; icon: string }
> = {
  admin: {
    label: "Administrateur",
    classes: "border-primary-3 bg-primary-5 text-primary-1",
    icon: "solar:shield-user-bold",
  },
  program_creator: {
    label: "Concepteur de programme",
    classes:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    icon: "solar:pen-new-square-bold",
  },
  mentor: {
    label: "Mentor",
    classes:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: "solar:users-group-rounded-bold",
  },
  student: {
    label: "Étudiant",
    classes: "border-neutral-4 bg-neutral-2 text-neutral-7",
    icon: "solar:square-academic-cap-bold",
  },
};

const NOTIFICATION_LABELS: {
  key: keyof Pick<
    User,
    | "notify_email_modules"
    | "notify_email_quiz_deadlines"
    | "notify_email_live_sessions"
    | "notify_push_important_updates"
  >;
  label: string;
  icon: string;
}[] = [
  {
    key: "notify_email_modules",
    label: "Nouveaux modules",
    icon: "solar:layers-bold",
  },
  {
    key: "notify_email_quiz_deadlines",
    label: "Échéances de quiz",
    icon: "solar:clock-circle-bold",
  },
  {
    key: "notify_email_live_sessions",
    label: "Sessions live",
    icon: "solar:videocamera-bold",
  },
  {
    key: "notify_push_important_updates",
    label: "Alertes importantes",
    icon: "solar:bell-bold",
  },
];

function userInitials(user: User | null): string {
  if (!user) return "?";
  const first = (user.first_name || "").trim();
  const last = (user.last_name || "").trim();
  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
  }
  if (user.username) return user.username.charAt(0).toUpperCase();
  if (user.email) return user.email.charAt(0).toUpperCase();
  return "?";
}

function fullNameOf(user: User | null): string {
  if (!user) return "Utilisateur";
  return (
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.email ||
    "Utilisateur"
  );
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [me, setMe] = useState<User | null>(user);
  const [loading, setLoading] = useState(!user);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- chargement initial */
    setError(null);
    if (!user) setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetchCurrentUser()
      .then((data) => {
        if (cancelled) return;
        setMe(data);
        // garde le AuthProvider à jour pour TopBar / Sidebar
        void refreshUser().catch(() => {});
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status >= 500) {
          setError(
            `Erreur serveur (${err.status}). Réessayez plus tard ou contactez l'équipe technique.`,
          );
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Profil indisponible.");
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // refreshUser est stable, on évite le re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeNotifications = useMemo(() => {
    if (!me) return 0;
    return NOTIFICATION_LABELS.reduce(
      (count, item) => count + (me[item.key] ? 1 : 0),
      0,
    );
  }, [me]);

  if (loading && !me) {
    return (
      <div className="space-y-4 px-4 py-6 lg:px-8">
        <div className="h-6 w-40 animate-pulse rounded-lg bg-neutral-3" />
        <div className="h-44 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-32 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2" />
          <div className="h-32 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2" />
        </div>
      </div>
    );
  }

  if (error && !me) {
    return (
      <div className="px-4 py-10 lg:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <Icon
            icon="solar:danger-triangle-bold"
            width={28}
            className="mx-auto text-red-600 dark:text-red-300"
          />
          <h1 className="mt-3 text-h5 font-semibold text-red-600 dark:text-red-300">
            Profil indisponible
          </h1>
          <p className="mt-1 text-small text-red-600/80 dark:text-red-200">
            {error}
          </p>
        </div>
      </div>
    );
  }

  const fullName = fullNameOf(me);
  const avatarUrl = me?.profile_picture_url || me?.profile_picture || null;
  const role = me?.role;
  const roleMeta = role ? ROLE_META[role] : null;

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <header>
        <h1 className="text-h4 font-semibold text-neutral-8">Profil</h1>
        <p className="mt-1 text-small text-neutral-6">
          Aperçu de votre identité et préférences. Modifiez les informations
          détaillées dans <span className="font-semibold">Paramètres</span>.
        </p>
      </header>

      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-neutral-4 bg-neutral-1 shadow-sm">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary-3 bg-primary-5 text-h4 font-semibold text-primary-1">
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- avatar distant non maîtrisé */
              <img
                src={avatarUrl}
                alt={fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{userInitials(me)}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-h5 font-semibold wrap-break-word text-neutral-8">
                {fullName}
              </h2>
              {roleMeta ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${roleMeta.classes}`}
                >
                  <Icon icon={roleMeta.icon} width={10} />
                  {roleMeta.label}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-small text-neutral-6 truncate">
              {me?.email || "—"}
            </p>
            {me?.username ? (
              <p className="text-xs text-neutral-5">
                Identifiant : @{me.username}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            <Link
              href="/dashboard/settings#profile"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2"
            >
              <Icon icon="solar:pen-2-linear" width={14} />
              Modifier mes informations
            </Link>
            <Link
              href="/dashboard/settings#security"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-4 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
            >
              <Icon icon="solar:lock-keyhole-linear" width={14} />
              Mot de passe et sécurité
            </Link>
          </div>
        </div>
      </section>

      {/* Détails + résumé notifs */}
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-neutral-4 bg-neutral-1 p-4 shadow-sm lg:col-span-2">
          <header className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-3 text-neutral-7">
              <Icon icon="solar:info-circle-bold" width={16} />
            </span>
            <h3 className="text-h6 font-semibold text-neutral-8">
              Informations
            </h3>
          </header>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoLine
              icon="solar:letter-bold"
              label="E-mail"
              value={me?.email || "—"}
              hint={
                me?.email
                  ? "Modifiable uniquement par un administrateur."
                  : undefined
              }
            />
            <InfoLine
              icon="solar:flag-bold"
              label="Pays"
              value={me?.country || "Non renseigné"}
              missing={!me?.country}
            />
            <InfoLine
              icon="solar:phone-bold"
              label="Téléphone"
              value={me?.phone_number || "Non renseigné"}
              missing={!me?.phone_number}
            />
            <InfoLine
              icon="solar:user-id-bold"
              label="Identifiant"
              value={me?.username ? `@${me.username}` : "Non renseigné"}
              missing={!me?.username}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-4 bg-neutral-1 p-4 shadow-sm">
          <header className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-5 text-primary-1">
              <Icon icon="solar:bell-bold" width={16} />
            </span>
            <h3 className="text-h6 font-semibold text-neutral-8">
              Notifications
            </h3>
          </header>
          <p className="text-xs text-neutral-5">
            <span className="font-semibold text-neutral-7">
              {activeNotifications}
            </span>{" "}
            préférence{activeNotifications > 1 ? "s" : ""} active
            {activeNotifications > 1 ? "s" : ""} sur{" "}
            {NOTIFICATION_LABELS.length}.
          </p>
          <ul className="mt-3 space-y-1.5">
            {NOTIFICATION_LABELS.map((item) => {
              const active = Boolean(me?.[item.key]);
              return (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="inline-flex items-center gap-1.5 text-neutral-7">
                    <Icon
                      icon={item.icon}
                      width={12}
                      className="text-neutral-6"
                    />
                    {item.label}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-semibold ${
                      active
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-neutral-4 bg-neutral-2 text-neutral-6"
                    }`}
                  >
                    <Icon
                      icon={
                        active
                          ? "solar:check-circle-bold"
                          : "solar:close-circle-bold"
                      }
                      width={10}
                    />
                    {active ? "Activée" : "Désactivée"}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link
            href="/dashboard/settings#notifications"
            className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-neutral-4 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
          >
            <Icon icon="solar:settings-bold" width={12} />
            Gérer les notifications
          </Link>
        </div>
      </section>

      {/* Liens rapides */}
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-neutral-5 uppercase">
          Accès rapide
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickLink
            href="/dashboard/settings#profile"
            icon="solar:user-id-bold"
            title="Profil"
            description="Avatar, prénom, nom, coordonnées."
          />
          <QuickLink
            href="/dashboard/settings#security"
            icon="solar:shield-keyhole-bold"
            title="Sécurité"
            description="Changer mon mot de passe."
          />
          <QuickLink
            href="/dashboard/settings#appearance"
            icon="solar:palette-bold"
            title="Apparence"
            description="Thème clair / sombre / système."
          />
        </div>
      </section>
    </div>
  );
}

function InfoLine({
  icon,
  label,
  value,
  hint,
  missing,
}: {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  missing?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-4 bg-neutral-2 p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-1 text-neutral-7">
        <Icon icon={icon} width={14} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-wide text-neutral-5 uppercase">
          {label}
        </p>
        <p
          className={`truncate text-small font-semibold ${
            missing ? "text-neutral-5 italic" : "text-neutral-8"
          }`}
        >
          {value}
        </p>
        {hint ? <p className="text-[11px] text-neutral-5">{hint}</p> : null}
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-2xl border border-neutral-4 bg-neutral-1 p-3 shadow-sm transition hover:border-primary-3 hover:bg-neutral-2"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-5 text-primary-1">
        <Icon icon={icon} width={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-small font-semibold text-neutral-8">{title}</p>
        <p className="text-xs text-neutral-5">{description}</p>
      </div>
      <Icon
        icon="solar:alt-arrow-right-linear"
        width={14}
        className="mt-1 text-neutral-5"
      />
    </Link>
  );
}
