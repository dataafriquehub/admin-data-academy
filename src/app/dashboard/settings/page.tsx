"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/hooks/useTheme";
import {
  changePassword,
  fetchCurrentUser,
  updateCurrentUser,
  type CurrentUserUpdate,
} from "@/services/userProfileService";
import { uploadFile } from "@/services/uploadService";

type FieldErrors = Record<string, string[]>;

type ProfileForm = {
  first_name: string;
  last_name: string;
  country: string;
  phone_number: string;
};

type Notifications = {
  notify_email_modules: boolean;
  notify_email_quiz_deadlines: boolean;
  notify_email_live_sessions: boolean;
  notify_push_important_updates: boolean;
};

type ToastMessage = { kind: "success" | "error"; text: string };

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  program_creator: "Concepteur de programme",
  mentor: "Mentor",
  student: "Étudiant",
};

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

function describeApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      return `Erreur serveur (${err.status}). Réessayez plus tard ou contactez l'équipe technique.`;
    }
    return err.message || fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

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

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [me, setMe] = useState<User | null>(user);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // -------- Profil
  const [profile, setProfile] = useState<ProfileForm>({
    first_name: "",
    last_name: "",
    country: "",
    phone_number: "",
  });
  const [profileInitial, setProfileInitial] = useState<ProfileForm>({
    first_name: "",
    last_name: "",
    country: "",
    phone_number: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState<FieldErrors>({});

  // -------- Avatar
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarRemoving, setAvatarRemoving] = useState(false);

  // -------- Notifications
  const [notifications, setNotifications] = useState<Notifications>({
    notify_email_modules: true,
    notify_email_quiz_deadlines: true,
    notify_email_live_sessions: true,
    notify_push_important_updates: true,
  });
  const [notificationsSaving, setNotificationsSaving] =
    useState<keyof Notifications | null>(null);

  // -------- Sécurité
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});
  const [passwordMessage, setPasswordMessage] = useState<ToastMessage | null>(
    null,
  );

  function hydrateFromUser(data: User) {
    const next: ProfileForm = {
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      country: data.country || "",
      phone_number: data.phone_number || "",
    };
    setMe(data);
    setProfile(next);
    setProfileInitial(next);
    setNotifications({
      notify_email_modules: data.notify_email_modules ?? true,
      notify_email_quiz_deadlines: data.notify_email_quiz_deadlines ?? true,
      notify_email_live_sessions: data.notify_email_live_sessions ?? true,
      notify_push_important_updates:
        data.notify_push_important_updates ?? true,
    });
  }

  // Charge le profil au montage
  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- chargement initial */
    setLoading(true);
    setLoadError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetchCurrentUser()
      .then((data) => {
        if (cancelled) return;
        hydrateFromUser(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(describeApiError(err, "Profil indisponible."));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!passwordMessage) return;
    const id = setTimeout(() => setPasswordMessage(null), 4500);
    return () => clearTimeout(id);
  }, [passwordMessage]);

  const profileDirty = useMemo(() => {
    return (
      profile.first_name !== profileInitial.first_name ||
      profile.last_name !== profileInitial.last_name ||
      profile.country !== profileInitial.country ||
      profile.phone_number !== profileInitial.phone_number
    );
  }, [profile, profileInitial]);

  // -------------------------- Profil
  async function handleSaveProfile(event: React.FormEvent) {
    event.preventDefault();
    setProfileErrors({});
    if (!profileDirty) return;
    setProfileSaving(true);
    try {
      const payload: CurrentUserUpdate = {
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        country: profile.country.trim() || null,
        phone_number: profile.phone_number.trim() || null,
      };
      const updated = await updateCurrentUser(payload);
      hydrateFromUser(updated);
      await refreshUser();
      setToast({ kind: "success", text: "Profil mis à jour." });
    } catch (err) {
      if (err instanceof ApiError) {
        const { fields, message } = extractFieldErrors(err.payload);
        setProfileErrors(fields);
        setToast({
          kind: "error",
          text: message ?? describeApiError(err, "Mise à jour impossible."),
        });
      } else {
        setToast({
          kind: "error",
          text: describeApiError(err, "Mise à jour impossible."),
        });
      }
    } finally {
      setProfileSaving(false);
    }
  }

  function resetProfile() {
    setProfile(profileInitial);
    setProfileErrors({});
  }

  // -------------------------- Avatar
  function pickAvatar() {
    fileInputRef.current?.click();
  }

  async function handleAvatarSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast({ kind: "error", text: "Sélectionnez une image valide." });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setToast({ kind: "error", text: "La photo doit faire moins de 4 Mo." });
      return;
    }
    setAvatarUploading(true);
    try {
      const uploaded = await uploadFile(file, {
        folder: "profile",
        resourceType: "image",
      });
      const updated = await updateCurrentUser({
        profile_picture_url: uploaded.url,
      });
      hydrateFromUser(updated);
      await refreshUser();
      setToast({ kind: "success", text: "Photo de profil mise à jour." });
    } catch (err) {
      setToast({
        kind: "error",
        text: describeApiError(err, "Mise à jour de la photo impossible."),
      });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleAvatarRemove() {
    if (!me?.profile_picture_url && !me?.profile_picture) return;
    setAvatarRemoving(true);
    try {
      const updated = await updateCurrentUser({ profile_picture_url: null });
      hydrateFromUser(updated);
      await refreshUser();
      setToast({ kind: "success", text: "Photo de profil retirée." });
    } catch (err) {
      setToast({
        kind: "error",
        text: describeApiError(err, "Suppression de la photo impossible."),
      });
    } finally {
      setAvatarRemoving(false);
    }
  }

  // -------------------------- Notifications
  async function toggleNotification(key: keyof Notifications) {
    const previous = notifications[key];
    const optimistic = { ...notifications, [key]: !previous };
    setNotifications(optimistic);
    setNotificationsSaving(key);
    try {
      const updated = await updateCurrentUser({ [key]: !previous });
      hydrateFromUser(updated);
      await refreshUser();
    } catch (err) {
      setNotifications(notifications);
      setToast({
        kind: "error",
        text: describeApiError(err, "Préférence non enregistrée."),
      });
    } finally {
      setNotificationsSaving(null);
    }
  }

  // -------------------------- Mot de passe
  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordErrors({});
    setPasswordMessage(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordErrors({
        old_password: !oldPassword ? ["Mot de passe actuel requis."] : [],
        new_password: !newPassword ? ["Nouveau mot de passe requis."] : [],
        confirm_password: !confirmPassword ? ["Confirmation requise."] : [],
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrors({
        confirm_password: ["La confirmation ne correspond pas."],
      });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordErrors({
        new_password: ["Au moins 8 caractères recommandés."],
      });
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage({
        kind: "success",
        text: "Mot de passe mis à jour.",
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const { fields, message } = extractFieldErrors(err.payload);
        setPasswordErrors(fields);
        setPasswordMessage({
          kind: "error",
          text: message ?? describeApiError(err, "Mise à jour impossible."),
        });
      } else {
        setPasswordMessage({
          kind: "error",
          text: describeApiError(err, "Mise à jour impossible."),
        });
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  // -------------------------- Render
  if (loading) {
    return (
      <div className="space-y-4 px-4 py-6 lg:px-8">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-neutral-3" />
        <div className="h-32 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2" />
        <div className="h-44 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2" />
        <div className="h-44 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2" />
      </div>
    );
  }

  if (loadError) {
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
            {loadError}
          </p>
        </div>
      </div>
    );
  }

  const fullName =
    [me?.first_name, me?.last_name].filter(Boolean).join(" ").trim() ||
    me?.username ||
    me?.email ||
    "Utilisateur";
  const avatarUrl = me?.profile_picture_url || me?.profile_picture || null;
  const roleLabel = me?.role ? ROLE_LABELS[me.role] || me.role : "—";

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <header>
        <h1 className="text-h4 font-semibold text-neutral-8">Paramètres</h1>
        <p className="mt-1 text-small text-neutral-6">
          Profil et préférences du compte.
        </p>
      </header>

      {toast ? (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-small ${
            toast.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300"
          }`}
          role="status"
        >
          <Icon
            icon={
              toast.kind === "success"
                ? "solar:check-circle-bold"
                : "solar:danger-triangle-bold"
            }
            width={16}
            className="mt-0.5 shrink-0"
          />
          <p>{toast.text}</p>
        </div>
      ) : null}

      {/* ──────────────── Profil */}
      <SectionCard
        id="profile"
        icon="solar:user-id-bold"
        title="Profil"
        subtitle="Informations personnelles affichées dans la console et sur les pages publiques."
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="flex flex-col items-center gap-3 lg:w-44">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-primary-3 bg-primary-5 text-h4 font-semibold text-primary-1">
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
              {avatarUploading || avatarRemoving ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Icon
                    icon="svg-spinners:90-ring-with-bg"
                    width={22}
                    className="text-white"
                  />
                </div>
              ) : null}
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={pickAvatar}
                disabled={avatarUploading || avatarRemoving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon icon="solar:camera-bold" width={14} />
                Changer la photo
              </button>
              {avatarUrl ? (
                <button
                  type="button"
                  onClick={() => void handleAvatarRemove()}
                  disabled={avatarUploading || avatarRemoving}
                  className="inline-flex items-center gap-1 rounded-xl border border-neutral-4 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon icon="solar:trash-bin-trash-linear" width={12} />
                  Retirer
                </button>
              ) : null}
              <p className="text-center text-[11px] text-neutral-5">
                JPG/PNG • &lt; 4 Mo
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelected}
              aria-label="Importer une photo de profil"
            />
          </div>

          <form
            onSubmit={handleSaveProfile}
            className="flex flex-1 flex-col gap-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldLabel
                label="Prénom"
                error={profileErrors.first_name?.[0]}
              >
                <input
                  type="text"
                  value={profile.first_name}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      first_name: e.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                  autoComplete="given-name"
                  title="Prénom"
                  placeholder="Votre prénom"
                />
              </FieldLabel>
              <FieldLabel label="Nom" error={profileErrors.last_name?.[0]}>
                <input
                  type="text"
                  value={profile.last_name}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      last_name: e.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                  autoComplete="family-name"
                  title="Nom"
                  placeholder="Votre nom"
                />
              </FieldLabel>
            </div>

            <FieldLabel
              label="Adresse e-mail"
              hint="Modifiable uniquement par un administrateur via la console Utilisateurs."
            >
              <div className="flex items-center gap-2 rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-7">
                <Icon icon="solar:letter-bold" width={14} />
                <span className="truncate">{me?.email ?? "—"}</span>
              </div>
            </FieldLabel>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldLabel label="Pays" error={profileErrors.country?.[0]}>
                <input
                  type="text"
                  value={profile.country}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, country: e.target.value }))
                  }
                  className={INPUT_CLASS}
                  autoComplete="country-name"
                  placeholder="Ex. France"
                  title="Pays"
                />
              </FieldLabel>
              <FieldLabel
                label="Téléphone"
                error={profileErrors.phone_number?.[0]}
              >
                <input
                  type="tel"
                  value={profile.phone_number}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      phone_number: e.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                  autoComplete="tel"
                  placeholder="+33 6 12 34 56 78"
                  title="Téléphone"
                />
              </FieldLabel>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <RoleBadge role={me?.role} label={roleLabel} />
              <div className="flex flex-wrap items-center gap-2">
                {profileDirty ? (
                  <button
                    type="button"
                    onClick={resetProfile}
                    disabled={profileSaving}
                    className="inline-flex items-center gap-1 rounded-xl border border-neutral-4 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon icon="solar:refresh-circle-linear" width={12} />
                    Annuler
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={!profileDirty || profileSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon
                    icon={
                      profileSaving
                        ? "svg-spinners:90-ring-with-bg"
                        : "solar:diskette-bold"
                    }
                    width={14}
                  />
                  {profileSaving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </SectionCard>

      {/* ──────────────── Notifications */}
      <SectionCard
        id="notifications"
        icon="solar:bell-bold"
        title="Notifications"
        subtitle="Choisissez ce que vous souhaitez recevoir par e-mail ou en push."
      >
        <ul className="divide-y divide-neutral-4">
          <NotificationRow
            icon="solar:layers-bold"
            label="Nouveaux modules"
            description="Recevoir un e-mail quand un nouveau module est publié."
            active={notifications.notify_email_modules}
            saving={notificationsSaving === "notify_email_modules"}
            onToggle={() => void toggleNotification("notify_email_modules")}
          />
          <NotificationRow
            icon="solar:clock-circle-bold"
            label="Échéances de quiz"
            description="Rappels avant les dates limites de quiz et devoirs."
            active={notifications.notify_email_quiz_deadlines}
            saving={notificationsSaving === "notify_email_quiz_deadlines"}
            onToggle={() =>
              void toggleNotification("notify_email_quiz_deadlines")
            }
          />
          <NotificationRow
            icon="solar:videocamera-bold"
            label="Sessions live"
            description="Notifications pour les sessions de mentorat à venir."
            active={notifications.notify_email_live_sessions}
            saving={notificationsSaving === "notify_email_live_sessions"}
            onToggle={() =>
              void toggleNotification("notify_email_live_sessions")
            }
          />
          <NotificationRow
            icon="solar:bell-off-bold"
            label="Alertes importantes (push)"
            description="Maintenance, incidents, communications urgentes."
            active={notifications.notify_push_important_updates}
            saving={notificationsSaving === "notify_push_important_updates"}
            onToggle={() =>
              void toggleNotification("notify_push_important_updates")
            }
          />
        </ul>
      </SectionCard>

      {/* ──────────────── Apparence */}
      <AppearanceSection />

      {/* ──────────────── Sécurité */}
      <SectionCard
        id="security"
        icon="solar:shield-keyhole-bold"
        title="Sécurité"
        subtitle="Mettez à jour votre mot de passe régulièrement."
      >
        {passwordMessage ? (
          <div
            className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-small ${
              passwordMessage.kind === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300"
            }`}
            role="status"
          >
            <Icon
              icon={
                passwordMessage.kind === "success"
                  ? "solar:check-circle-bold"
                  : "solar:danger-triangle-bold"
              }
              width={16}
              className="mt-0.5 shrink-0"
            />
            <p>{passwordMessage.text}</p>
          </div>
        ) : null}

        <form
          onSubmit={handleChangePassword}
          className="grid gap-3 sm:grid-cols-2"
        >
          <FieldLabel
            label="Mot de passe actuel"
            error={passwordErrors.old_password?.[0]}
            className="sm:col-span-2"
          >
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className={INPUT_CLASS}
              autoComplete="current-password"
              title="Mot de passe actuel"
              placeholder="••••••••"
            />
          </FieldLabel>
          <FieldLabel
            label="Nouveau mot de passe"
            error={passwordErrors.new_password?.[0]}
          >
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={INPUT_CLASS}
              autoComplete="new-password"
              title="Nouveau mot de passe"
              placeholder="Minimum 8 caractères"
            />
          </FieldLabel>
          <FieldLabel
            label="Confirmer"
            error={passwordErrors.confirm_password?.[0]}
          >
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={INPUT_CLASS}
              autoComplete="new-password"
              title="Confirmer le nouveau mot de passe"
              placeholder="Répéter le mot de passe"
            />
          </FieldLabel>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={passwordSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon
                icon={
                  passwordSaving
                    ? "svg-spinners:90-ring-with-bg"
                    : "solar:lock-keyhole-bold"
                }
                width={14}
              />
              {passwordSaving ? "Mise à jour…" : "Mettre à jour"}
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-small text-neutral-8 placeholder:text-neutral-5 transition focus:border-primary-3 focus:bg-neutral-1 focus:outline-none";

function SectionCard({
  id,
  icon,
  title,
  subtitle,
  children,
}: {
  id?: string;
  icon: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-neutral-4 bg-neutral-1 shadow-sm"
    >
      <header className="flex items-start gap-3 border-b border-neutral-4 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-5 text-primary-1">
          <Icon icon={icon} width={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-h6 font-semibold text-neutral-8">{title}</h2>
          {subtitle ? (
            <p className="text-xs text-neutral-5">{subtitle}</p>
          ) : null}
        </div>
      </header>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function FieldLabel({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 text-small text-neutral-7 ${className}`}>
      <span className="font-medium">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-300">{error}</span>
      ) : hint ? (
        <span className="text-xs text-neutral-5">{hint}</span>
      ) : null}
    </label>
  );
}

function RoleBadge({ role, label }: { role?: string; label: string }) {
  const tone =
    role === "admin"
      ? "border-primary-3 bg-primary-5 text-primary-1"
      : role === "program_creator"
        ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
        : role === "mentor"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-neutral-4 bg-neutral-2 text-neutral-7";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      <Icon icon="solar:shield-user-bold" width={10} />
      Type de compte&nbsp;: {label}
    </span>
  );
}

function NotificationRow({
  icon,
  label,
  description,
  active,
  saving,
  onToggle,
}: {
  icon: string;
  label: string;
  description: string;
  active: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-3 text-neutral-7">
          <Icon icon={icon} width={16} />
        </span>
        <div className="min-w-0">
          <p className="text-small font-semibold text-neutral-8">{label}</p>
          <p className="text-xs text-neutral-5">{description}</p>
        </div>
      </div>
      <Toggle active={active} saving={saving} onToggle={onToggle} ariaLabel={label} />
    </li>
  );
}

function Toggle({
  active,
  saving,
  onToggle,
  ariaLabel,
}: {
  active: boolean;
  saving: boolean;
  onToggle: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active ? "true" : "false"}
      aria-label={ariaLabel}
      onClick={onToggle}
      disabled={saving}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? "bg-primary-1" : "bg-neutral-4"
      }`}
    >
      <span
        className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow transition ${
          active ? "translate-x-5" : "translate-x-0.5"
        }`}
      >
        {saving ? (
          <Icon
            icon="svg-spinners:90-ring-with-bg"
            width={10}
            className="text-neutral-6"
          />
        ) : null}
      </span>
    </button>
  );
}

function AppearanceSection() {
  const { theme, setTheme, isDark } = useTheme();
  const options: { value: typeof theme; label: string; icon: string }[] = [
    { value: "light", label: "Clair", icon: "solar:sun-bold" },
    { value: "dark", label: "Sombre", icon: "solar:moon-bold" },
    { value: "system", label: "Système", icon: "solar:monitor-bold" },
  ];

  return (
    <SectionCard
      id="appearance"
      icon="solar:palette-bold"
      title="Apparence"
      subtitle="Préférence d'interface, synchronisée avec la barre supérieure."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-neutral-5">
          Thème actif :{" "}
          <span className="font-semibold text-neutral-7">
            {isDark ? "Sombre" : "Clair"}
          </span>
        </p>
        <div className="inline-flex rounded-xl border border-neutral-4 bg-neutral-2 p-1 text-xs">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition ${
                theme === option.value
                  ? "bg-primary-1 text-white shadow-sm"
                  : "text-neutral-7 hover:bg-neutral-3"
              }`}
            >
              <Icon icon={option.icon} width={12} />
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
