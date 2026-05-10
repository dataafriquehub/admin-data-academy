"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import ConfirmAction from "@/components/ConfirmAction";
import { RoleGate } from "@/components/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch, unwrapArray } from "@/lib/api";
import type { User, UserRole } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

type AdminUserRow = User & {
  username?: string | null;
  first_name?: string;
  last_name?: string;
  profile_picture?: string | null;
  profile_picture_url?: string | null;
  country?: string | null;
  phone_number?: string | null;
  notify_email_modules?: boolean;
  notify_email_quiz_deadlines?: boolean;
  notify_email_live_sessions?: boolean;
  notify_push_important_updates?: boolean;
};

type SortKey = "name" | "email" | "role" | "country";
type SortDirection = "asc" | "desc";
type ToastTone = "success" | "error" | "info";

const PAGE_SIZE = 25;

const roleLabels: Record<UserRole, string> = {
  student: "Apprenant",
  mentor: "Mentor",
  program_creator: "Créateur de programme",
  admin: "Admin",
};

const roleOrder: UserRole[] = ["student", "program_creator", "mentor", "admin"];

function fullName(user: AdminUserRow): string {
  return (
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.email
  );
}

function initials(user: AdminUserRow): string {
  const source = fullName(user);
  const parts = source.split(/[.\s_-]+/).filter(Boolean);
  return (parts[0]?.[0] || "U").concat(parts[1]?.[0] || "").toUpperCase();
}

function normalize(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function roleTone(role: UserRole): "neutral" | "success" | "warning" | "danger" {
  if (role === "admin") return "danger";
  if (role === "program_creator") return "warning";
  if (role === "mentor") return "success";
  return "neutral";
}

function csvEscape(value: unknown): string {
  const raw = value == null ? "" : String(value);
  return `"${raw.replaceAll('"', '""')}"`;
}

function downloadCsv(rows: AdminUserRow[]) {
  const headers = [
    "id",
    "email",
    "username",
    "first_name",
    "last_name",
    "role",
    "country",
    "phone_number",
    "notify_email_modules",
    "notify_email_quiz_deadlines",
    "notify_email_live_sessions",
    "notify_push_important_updates",
  ];
  const lines = rows.map((row) =>
    headers
      .map((key) => csvEscape(row[key as keyof AdminUserRow]))
      .join(","),
  );
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `data-academy-utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function UserAvatar({ user, size = "md" }: { user: AdminUserRow; size?: "md" | "lg" }) {
  const classes = size === "lg" ? "h-14 w-14 text-h6" : "h-10 w-10 text-small";
  const picture = user.profile_picture_url || user.profile_picture;

  return (
    <div
      className={`${classes} shrink-0 overflow-hidden rounded-full border border-primary-3 bg-primary-5 text-primary-1 flex items-center justify-center font-semibold`}
    >
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt={fullName(user)} className="h-full w-full object-cover" />
      ) : (
        initials(user)
      )}
    </div>
  );
}

function NotificationIndicators({ user }: { user: AdminUserRow }) {
  const indicators = [
    {
      label: "Email modules",
      icon: "solar:letter-bold",
      enabled: Boolean(user.notify_email_modules),
    },
    {
      label: "Email deadlines quiz",
      icon: "solar:alarm-bold",
      enabled: Boolean(user.notify_email_quiz_deadlines),
    },
    {
      label: "Email sessions live",
      icon: "solar:videocamera-record-bold",
      enabled: Boolean(user.notify_email_live_sessions),
    },
    {
      label: "Push updates importantes",
      icon: "solar:smartphone-bold",
      enabled: Boolean(user.notify_push_important_updates),
    },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {indicators.map((item) => (
        <span
          key={item.label}
          title={`${item.label} : ${item.enabled ? "ON" : "OFF"}`}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs ${
            item.enabled
              ? "border-primary-3 bg-primary-5 text-primary-1"
              : "border-neutral-4 bg-neutral-2 text-neutral-5"
          }`}
        >
          <Icon icon={item.icon} width={15} height={15} />
        </span>
      ))}
    </div>
  );
}

function ContactCell({ user }: { user: AdminUserRow }) {
  const phone = user.phone_number?.trim() || null;
  const country = user.country?.trim() || null;

  if (!phone && !country) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-neutral-4 bg-neutral-2 px-2.5 py-1 text-xs italic text-neutral-5">
        <Icon icon="solar:info-circle-linear" width={12} />
        Non renseignées
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-small text-neutral-7">
        <Icon
          icon="solar:phone-linear"
          width={13}
          className="text-neutral-5"
        />
        {phone ? (
          <span>{phone}</span>
        ) : (
          <span className="italic text-neutral-5">Téléphone non renseigné</span>
        )}
      </p>
      <p className="flex items-center gap-1.5 text-xs text-neutral-5">
        <Icon icon="solar:map-point-linear" width={12} />
        {country ? (
          <span>{country}</span>
        ) : (
          <span className="italic">Pays non renseigné</span>
        )}
      </p>
    </div>
  );
}

function UsersSkeleton() {
  return (
    <div className="space-y-6 px-4 py-8 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-4/40" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-neutral-4/30" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-xl bg-neutral-4/30" />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-20 animate-pulse rounded-2xl bg-neutral-4/20" />
        ))}
      </div>
      <Card className="p-0">
        <div className="space-y-3 p-5">
          {[0, 1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="h-14 animate-pulse rounded-xl bg-neutral-4/20" />
          ))}
        </div>
      </Card>
    </div>
  );
}

function UserDrawer({
  user,
  canChangeRole,
  onClose,
  onChangeRole,
}: {
  user: AdminUserRow | null;
  canChangeRole: boolean;
  onClose: () => void;
  onChangeRole: (user: AdminUserRow) => void;
}) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-neutral-4 bg-neutral-1 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar user={user} size="lg" />
            <div className="min-w-0">
              <h2 className="truncate text-h6 font-semibold text-neutral-8">
                {fullName(user)}
              </h2>
              <p className="truncate text-small text-neutral-6">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={roleTone(user.role)}>{roleLabels[user.role]}</Badge>
                <button
                  type="button"
                  onClick={() => onChangeRole(user)}
                  disabled={!canChangeRole}
                  title={
                    canChangeRole
                      ? "Modifier le rôle"
                      : "Vous ne pouvez pas modifier votre propre rôle"
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-4 bg-neutral-2 px-2.5 py-1 text-xs text-neutral-7 transition hover:bg-neutral-3 disabled:opacity-50"
                >
                  <Icon icon="solar:pen-bold" width={12} />
                  Modifier
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-6 hover:bg-neutral-3 hover:text-neutral-8"
            aria-label="Fermer le détail utilisateur"
          >
            <Icon icon="solar:close-bold" width={18} />
          </button>
        </div>

        <div className="mt-8 space-y-6">
          <section>
            <h3 className="mb-3 text-small font-semibold text-neutral-8">Coordonnées</h3>
            <dl className="grid gap-3 text-small">
              <div className="rounded-xl bg-neutral-2 p-3">
                <dt className="text-xs text-neutral-5">Téléphone</dt>
                <dd
                  className={`mt-1 ${user.phone_number ? "text-neutral-8" : "italic text-neutral-5"}`}
                >
                  {user.phone_number || "Non renseigné"}
                </dd>
              </div>
              <div className="rounded-xl bg-neutral-2 p-3">
                <dt className="text-xs text-neutral-5">Pays</dt>
                <dd
                  className={`mt-1 ${user.country ? "text-neutral-8" : "italic text-neutral-5"}`}
                >
                  {user.country || "Non renseigné"}
                </dd>
              </div>
              <div className="rounded-xl bg-neutral-2 p-3">
                <dt className="text-xs text-neutral-5">Username</dt>
                <dd
                  className={`mt-1 ${user.username ? "text-neutral-8" : "italic text-neutral-5"}`}
                >
                  {user.username || "Non renseigné"}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="mb-3 text-small font-semibold text-neutral-8">
              Préférences notifications
            </h3>
            <div className="grid gap-2 text-small text-neutral-7">
              <p>Email modules : {user.notify_email_modules ? "ON" : "OFF"}</p>
              <p>
                Email deadlines quiz :{" "}
                {user.notify_email_quiz_deadlines ? "ON" : "OFF"}
              </p>
              <p>
                Email sessions live :{" "}
                {user.notify_email_live_sessions ? "ON" : "OFF"}
              </p>
              <p>
                Push updates importantes :{" "}
                {user.notify_push_important_updates ? "ON" : "OFF"}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-4 bg-neutral-2 p-4">
            <h3 className="text-small font-semibold text-neutral-8">
              Données non exposées par l’API
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-neutral-6">
              Statut actif, date d’inscription et dernière connexion : —. Ces
              champs ne sont pas présents dans `UserSerializer`, donc aucun faux
              appel détail n’est effectué.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}

function extractFieldError(payload: unknown, field: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[field];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
    return value[0] as string;
  }
  return null;
}

function readableApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const fromRole = extractFieldError(err.payload, "role");
    if (fromRole) return fromRole;
    const fromDetail = extractFieldError(err.payload, "detail");
    if (fromDetail) return fromDetail;
    const fromNonField = extractFieldError(err.payload, "non_field_errors");
    if (fromNonField) return fromNonField;
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function ChangeRoleDialog({
  user,
  pending,
  error,
  isSelf,
  onClose,
  onSubmit,
}: {
  user: AdminUserRow | null;
  pending: boolean;
  error: string | null;
  isSelf: boolean;
  onClose: () => void;
  onSubmit: (role: UserRole) => void;
}) {
  const [role, setRole] = useState<UserRole>(user?.role ?? "student");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- synchroniser le select avec la prop user */
    if (user) setRole(user.role);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, user]);

  if (!user) return null;

  const unchanged = role === user.role;
  const downgradingAdmin = user.role === "admin" && role !== "admin";
  const upgradingToAdmin = user.role !== "admin" && role === "admin";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-4 bg-neutral-1 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-h6 font-semibold text-neutral-8">
              Modifier le rôle
            </h2>
            <p className="mt-1 truncate text-small text-neutral-6">
              {fullName(user)} — {user.email}
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
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (unchanged || isSelf) return;
            onSubmit(role);
          }}
        >
          <div>
            <p className="mb-1 text-small text-neutral-7">Rôle actuel</p>
            <div>
              <Badge tone={roleTone(user.role)}>{roleLabels[user.role]}</Badge>
            </div>
          </div>

          <div>
            <label
              htmlFor="user-role-select"
              className="mb-1 block text-small text-neutral-7"
            >
              Nouveau rôle
            </label>
            <select
              id="user-role-select"
              title="Choisir un rôle"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              disabled={isSelf}
              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-body text-neutral-8 focus:border-primary-1 focus:outline-none disabled:opacity-60"
            >
              {roleOrder.map((value) => (
                <option key={value} value={value}>
                  {roleLabels[value]}
                </option>
              ))}
            </select>
          </div>

          {isSelf ? (
            <div className="rounded-xl border border-secondary-4 bg-secondary-5 p-3 text-xs text-neutral-7">
              Vous ne pouvez pas modifier votre propre rôle depuis cette
              interface.
            </div>
          ) : null}

          {!isSelf && downgradingAdmin ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
              Attention : vous retirez le rôle <strong>Admin</strong>. Le serveur
              refusera l’opération si c’est le dernier compte admin actif ou si
              ce compte est super-utilisateur Django.
            </div>
          ) : null}

          {!isSelf && upgradingToAdmin ? (
            <div className="rounded-xl border border-primary-3 bg-primary-5 p-3 text-xs text-primary-1">
              Cet utilisateur deviendra <strong>Admin</strong> et aura accès au
              backoffice complet.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || unchanged || isSelf}>
              {pending ? "Mise à jour…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NotifyDialog({
  user,
  pending,
  onClose,
  onSend,
}: {
  user: AdminUserRow | null;
  pending: boolean;
  onClose: () => void;
  onSend: (payload: { title: string; message: string; priority: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("medium");
  useEffect(() => {
    if (!user) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, user]);

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-4 bg-neutral-1 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-h6 font-semibold text-neutral-8">
              Notifier cet utilisateur
            </h2>
            <p className="mt-1 text-small text-neutral-6">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-6 hover:bg-neutral-3"
            aria-label="Fermer"
          >
            <Icon icon="solar:close-bold" width={18} />
          </button>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSend({ title, message, priority });
          }}
        >
          <div>
            <label className="mb-1 block text-small text-neutral-7">Titre</label>
            <Input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex. Information importante"
            />
          </div>
          <div>
            <label className="mb-1 block text-small text-neutral-7">Message</label>
            <textarea
              required
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-32 w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-body text-neutral-8 placeholder:text-neutral-5 focus:border-primary-1 focus:outline-none"
              placeholder="Rédiger le message envoyé à l’utilisateur…"
            />
          </div>
          <div>
            <label
              htmlFor="notify-priority"
              className="mb-1 block text-small text-neutral-7"
            >
              Priorité
            </label>
            <select
              id="notify-priority"
              title="Priorité de la notification"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-body text-neutral-8 focus:border-primary-1 focus:outline-none"
            >
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
            </select>
          </div>
          <div className="rounded-xl bg-neutral-2 p-3 text-xs text-neutral-6">
            Payload : <span className="font-semibold">user_ids: [{user.id}]</span>,
            type: general, priorité éditable.
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Toast({
  message,
  tone,
}: {
  message: string;
  tone: ToastTone;
}) {
  const classes =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "error"
        ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
        : "border-primary-3 bg-primary-5 text-primary-1";

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border px-4 py-3 text-small shadow-lg ${classes}`}
      role="status"
    >
      {message}
    </div>
  );
}

function UsersScreen() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Set<UserRole>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [notifyUser, setNotifyUser] = useState<AdminUserRow | null>(null);
  const [notifyPending, setNotifyPending] = useState(false);
  const [resetUser, setResetUser] = useState<AdminUserRow | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const [roleEditUser, setRoleEditUser] = useState<AdminUserRow | null>(null);
  const [rolePending, setRolePending] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [actionOpenFor, setActionOpenFor] = useState<number | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    tone: ToastTone;
  } | null>(null);

  const isStrictAdmin = currentUser?.role === "admin";

  function showToast(message: string, tone: ToastTone = "info") {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<unknown>("/users/auth/users/");
      setRows(unwrapArray<AdminUserRow>(data));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError({
        status: err instanceof ApiError ? err.status : undefined,
        message:
          err instanceof ApiError && err.status === 403
            ? "Accès réservé aux administrateurs."
            : err instanceof Error
              ? err.message
              : "Impossible de charger les utilisateurs.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadUsers();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset pagination après changement de filtres client */
    setPage(1);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [query, selectedRoles, sortKey, sortDirection]);

  const roleCounts = useMemo(() => {
    return rows.reduce<Record<UserRole, number>>(
      (acc, row) => {
        acc[row.role] += 1;
        return acc;
      },
      { student: 0, mentor: 0, program_creator: 0, admin: 0 },
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = normalize(query);
    const result = rows.filter((row) => {
      const matchesRole =
        selectedRoles.size === 0 || selectedRoles.has(row.role);
      const haystack = [
        fullName(row),
        row.email,
        row.username,
        row.country,
        row.phone_number,
      ]
        .map(normalize)
        .join(" ");
      return matchesRole && (!q || haystack.includes(q));
    });

    return result.sort((a, b) => {
      const valueFor = (row: AdminUserRow) => {
        if (sortKey === "email") return row.email;
        if (sortKey === "role") return row.role;
        if (sortKey === "country") return row.country || "";
        return fullName(row);
      };
      const compare = valueFor(a).localeCompare(valueFor(b), "fr", {
        sensitivity: "base",
      });
      return sortDirection === "asc" ? compare : -compare;
    });
  }, [query, rows, selectedRoles, sortDirection, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = filteredRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  function toggleRole(role: UserRole) {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  function changeSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

  async function copyEmail(email: string) {
    await navigator.clipboard.writeText(email);
    showToast("Email copié.", "success");
  }

  async function openConversation(row: AdminUserRow) {
    setActionOpenFor(null);
    try {
      const conversation = await apiFetch<{ id?: number }>(
        "/messaging/conversations/direct/",
        {
          method: "POST",
          body: JSON.stringify({ recipient_id: row.id }),
        },
      );
      if (conversation.id != null) {
        router.push(`/dashboard/messaging?c=${encodeURIComponent(conversation.id)}`);
      } else {
        router.push("/dashboard/messaging");
      }
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 403
          ? "Conversation refusée par la politique messaging pour ce couple de rôles."
          : err instanceof Error
            ? err.message
            : "Impossible d’ouvrir la conversation.";
      showToast(message, "error");
    }
  }

  async function sendNotification(payload: {
    title: string;
    message: string;
    priority: string;
  }) {
    if (!notifyUser) return;
    setNotifyPending(true);
    try {
      await apiFetch("/notifications/send/", {
        method: "POST",
        body: JSON.stringify({
          title: payload.title,
          message: payload.message,
          type: "general",
          priority: payload.priority,
          user_ids: [notifyUser.id],
          metadata: { source: "backoffice_users" },
        }),
      });
      setNotifyUser(null);
      showToast("Notification envoyée.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Envoi de notification impossible.",
        "error",
      );
    } finally {
      setNotifyPending(false);
    }
  }

  async function submitRoleChange(nextRole: UserRole) {
    if (!roleEditUser) return;
    setRolePending(true);
    setRoleError(null);
    try {
      const updated = await apiFetch<AdminUserRow>(
        `/users/auth/users/${encodeURIComponent(roleEditUser.id)}/`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: nextRole }),
        },
      );
      setRows((current) =>
        current.map((row) =>
          row.id === roleEditUser.id ? { ...row, ...updated } : row,
        ),
      );
      setSelectedUser((current) =>
        current && current.id === roleEditUser.id
          ? { ...current, ...updated }
          : current,
      );
      showToast(
        `Rôle mis à jour : ${roleLabels[updated.role] ?? updated.role}.`,
        "success",
      );
      setRoleEditUser(null);
    } catch (err) {
      setRoleError(
        readableApiError(err, "Modification du rôle impossible."),
      );
    } finally {
      setRolePending(false);
    }
  }

  async function confirmPasswordReset() {
    if (!resetUser) return;
    setResetPending(true);
    try {
      await apiFetch("/users/auth/password/reset/", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email: resetUser.email }),
      });
      showToast(`Email de réinitialisation envoyé à ${resetUser.email}.`, "success");
      setResetUser(null);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Impossible d’envoyer l’email de réinitialisation.",
        "error",
      );
    } finally {
      setResetPending(false);
    }
  }

  if (loading) return <UsersSkeleton />;

  if (error) {
    return (
      <div className="px-4 py-8 lg:px-8">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-h6 font-semibold text-neutral-8">
                {error.status === 403
                  ? "Accès réservé aux administrateurs"
                  : "Utilisateurs indisponibles"}
              </h1>
              <p className="mt-1 text-small text-neutral-6">{error.message}</p>
            </div>
            {error.status !== 403 ? (
              <Button type="button" onClick={loadUsers}>
                Réessayer
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-8 lg:px-8">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-h4 font-semibold text-neutral-8">Utilisateurs</h1>
            <Badge tone="neutral">{filteredRows.length} affichés / {rows.length}</Badge>
          </div>
          <p className="mt-1 text-small text-neutral-6">
            Gestion des comptes et préférences — accès réservé admin.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[560px]">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Icon
                icon="solar:magnifer-bold"
                width={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-5"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher nom, email, pays…"
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => downloadCsv(filteredRows)}
              className="border border-neutral-4 bg-neutral-1"
            >
              <Icon icon="solar:download-bold" width={16} />
              Exporter CSV
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {roleOrder.map((role) => {
              const active = selectedRoles.has(role);
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-primary-3 bg-primary-5 text-primary-1"
                      : "border-neutral-4 bg-neutral-1 text-neutral-7 hover:bg-neutral-3"
                  }`}
                >
                  {roleLabels[role]} · {roleCounts[role]}
                </button>
              );
            })}
            {selectedRoles.size > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedRoles(new Set())}
                className="rounded-full border border-neutral-4 px-3 py-1.5 text-xs text-neutral-6 hover:bg-neutral-3"
              >
                Réinitialiser
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4 xl:col-span-1">
          <p className="text-xs text-neutral-5">Total utilisateurs</p>
          <p className="mt-1 text-h5 font-semibold text-neutral-8">{rows.length}</p>
        </Card>
        {roleOrder.map((role) => (
          <Card key={role} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-neutral-5">{roleLabels[role]}</p>
                <p className="mt-1 text-h6 font-semibold text-neutral-8">
                  {roleCounts[role]}
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-5 text-primary-1">
                <Icon
                  icon={
                    role === "admin"
                      ? "solar:shield-user-bold"
                      : role === "mentor"
                        ? "solar:user-speak-bold"
                        : role === "program_creator"
                          ? "solar:pen-new-square-bold"
                          : "solar:user-bold"
                  }
                  width={18}
                />
              </span>
            </div>
          </Card>
        ))}
      </section>

      <Card className="hidden overflow-visible p-0 md:block">
        <div className="overflow-visible">
          <table className="w-full text-left text-small">
            <thead className="border-b border-neutral-4 bg-neutral-2 text-xs uppercase tracking-wide text-neutral-6">
              <tr>
                <th className="px-5 py-3">
                  <button type="button" onClick={() => changeSort("name")}>
                    Utilisateur {sortKey === "name" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-5 py-3">
                  <button type="button" onClick={() => changeSort("role")}>
                    Rôle {sortKey === "role" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-5 py-3">Coordonnées</th>
                <th className="px-5 py-3">Notifications</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-4">
              {paginatedRows.map((row) => (
                <tr
                  key={row.id}
                  className="group hover:bg-neutral-3/70"
                  onDoubleClick={() => setSelectedUser(row)}
                >
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setSelectedUser(row)}
                      className="flex min-w-0 items-center gap-3 text-left"
                    >
                      <UserAvatar user={row} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-neutral-8">
                          {fullName(row)}
                        </span>
                        <span className="block truncate text-xs text-neutral-6">
                          {row.email}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={roleTone(row.role)}>{roleLabels[row.role]}</Badge>
                  </td>
                  <td className="px-5 py-4 text-neutral-7">
                    <ContactCell user={row} />
                  </td>
                  <td className="px-5 py-4">
                    <NotificationIndicators user={row} />
                  </td>
                  <td className="relative px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setActionOpenFor((current) =>
                          current === row.id ? null : row.id,
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-neutral-2"
                      aria-label={`Actions pour ${row.email}`}
                    >
                      <Icon icon="solar:menu-dots-bold" width={20} />
                    </button>
                    {actionOpenFor === row.id ? (
                      <div className="absolute right-5 top-12 z-30 w-64 rounded-xl border border-neutral-4 bg-neutral-1 py-1 text-left shadow-lg">
                        <ActionItems
                          user={row}
                          canNotify={isStrictAdmin}
                          isSelf={currentUser?.id === row.id}
                          onClose={() => setActionOpenFor(null)}
                          onConversation={() => openConversation(row)}
                          onNotify={() => {
                            setActionOpenFor(null);
                            setNotifyUser(row);
                          }}
                          onCopy={() => copyEmail(row.email)}
                          onReset={() => {
                            setActionOpenFor(null);
                            setResetUser(row);
                          }}
                          onChangeRole={() => {
                            setActionOpenFor(null);
                            setRoleError(null);
                            setRoleEditUser(row);
                          }}
                        />
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginatedRows.length === 0 ? (
            <p className="p-8 text-center text-small text-neutral-6">
              Aucun utilisateur ne correspond aux filtres.
            </p>
          ) : null}
        </div>
      </Card>

      <div className="space-y-3 md:hidden">
        {paginatedRows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex items-start gap-3">
              <UserAvatar user={row} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-neutral-8">{fullName(row)}</p>
                <p className="truncate text-small text-neutral-6">{row.email}</p>
                <div className="mt-2">
                  <Badge tone={roleTone(row.role)}>{roleLabels[row.role]}</Badge>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(row)}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-neutral-3"
                aria-label="Détail utilisateur"
              >
                <Icon icon="solar:eye-bold" width={18} />
              </button>
            </div>
            <div className="mt-4">
              <ContactCell user={row} />
            </div>
            <div className="mt-4">
              <NotificationIndicators user={row} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant="ghost" onClick={() => openConversation(row)}>
                Messages
              </Button>
              <Link
                href={`/dashboard/admissions?student=${encodeURIComponent(row.id)}`}
                className="inline-flex items-center justify-center rounded-xl border border-neutral-4 px-4 py-2 text-small font-medium text-neutral-8 hover:bg-neutral-3"
              >
                Candidatures
              </Link>
              <Button
                type="button"
                variant="ghost"
                disabled={currentUser?.id === row.id}
                title={
                  currentUser?.id === row.id
                    ? "Vous ne pouvez pas modifier votre propre rôle"
                    : undefined
                }
                onClick={() => {
                  setRoleError(null);
                  setRoleEditUser(row);
                }}
                className="col-span-2 border border-neutral-4 bg-neutral-1"
              >
                <Icon icon="solar:pen-bold" width={16} />
                Modifier rôle ({roleLabels[row.role]})
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-neutral-6">
          Page {page} / {pageCount} · {filteredRows.length} résultat
          {filteredRows.length > 1 ? "s" : ""}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="border border-neutral-4 bg-neutral-1"
          >
            Précédent
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            className="border border-neutral-4 bg-neutral-1"
          >
            Suivant
          </Button>
        </div>
      </div>

      <UserDrawer
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onChangeRole={(row) => {
          setRoleError(null);
          setRoleEditUser(row);
        }}
        canChangeRole={Boolean(selectedUser && currentUser?.id !== selectedUser.id)}
      />
      <NotifyDialog
        user={notifyUser}
        pending={notifyPending}
        onClose={() => setNotifyUser(null)}
        onSend={sendNotification}
      />
      <ChangeRoleDialog
        user={roleEditUser}
        pending={rolePending}
        error={roleError}
        isSelf={Boolean(roleEditUser && currentUser?.id === roleEditUser.id)}
        onClose={() => {
          setRoleEditUser(null);
          setRoleError(null);
        }}
        onSubmit={submitRoleChange}
      />
      <ConfirmAction
        isOpen={Boolean(resetUser)}
        onCancel={() => setResetUser(null)}
        onConfirm={confirmPasswordReset}
        title="Envoyer un email de réinitialisation ?"
        description={
          resetUser
            ? `Un email de réinitialisation de mot de passe sera envoyé à ${resetUser.email}.`
            : ""
        }
        confirmLabel={resetPending ? "Envoi…" : "Envoyer l’email"}
        cancelLabel="Annuler"
        variant="warning"
        icon="solar:lock-password-bold"
      />
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </div>
  );
}

function ActionItems({
  user,
  canNotify,
  isSelf,
  onClose,
  onConversation,
  onNotify,
  onCopy,
  onReset,
  onChangeRole,
}: {
  user: AdminUserRow;
  canNotify: boolean;
  isSelf: boolean;
  onClose: () => void;
  onConversation: () => void;
  onNotify: () => void;
  onCopy: () => void;
  onReset: () => void;
  onChangeRole: () => void;
}) {
  const itemClass =
    "flex w-full items-center gap-3 px-4 py-2.5 text-small text-neutral-8 hover:bg-neutral-3";

  return (
    <>
      <button type="button" onClick={onConversation} className={itemClass}>
        <Icon icon="solar:chat-round-dots-bold" width={16} />
        Converser
      </button>
      <Link
        href={`/dashboard/admissions?student=${encodeURIComponent(user.id)}`}
        onClick={onClose}
        className={itemClass}
      >
        <Icon icon="solar:document-text-bold" width={16} />
        Candidatures
      </Link>
      <button
        type="button"
        onClick={canNotify ? onNotify : undefined}
        disabled={!canNotify}
        title={!canNotify ? "Réservé super admin" : undefined}
        className={`${itemClass} disabled:text-neutral-5 disabled:hover:bg-transparent`}
      >
        <Icon icon="solar:bell-bold" width={16} />
        Notifier cet utilisateur
      </button>
      <button
        type="button"
        onClick={() => {
          onClose();
          onCopy();
        }}
        className={itemClass}
      >
        <Icon icon="solar:copy-bold" width={16} />
        Copier l’email
      </button>
      <button type="button" onClick={onReset} className={itemClass}>
        <Icon icon="solar:lock-password-bold" width={16} />
        Reset mot de passe
      </button>
      <div className="my-1 h-px bg-neutral-4" />
      <button
        type="button"
        onClick={onChangeRole}
        disabled={isSelf}
        title={
          isSelf
            ? "Vous ne pouvez pas modifier votre propre rôle"
            : `Rôle actuel : ${roleLabels[user.role]}`
        }
        className={`${itemClass} disabled:text-neutral-5 disabled:hover:bg-transparent`}
      >
        <Icon icon="solar:pen-bold" width={16} />
        Modifier rôle ({roleLabels[user.role]})
      </button>
    </>
  );
}

export default function UsersPage() {
  return (
    <RoleGate roles={["admin"]}>
      <UsersScreen />
    </RoleGate>
  );
}
