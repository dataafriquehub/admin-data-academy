"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError, apiFetch, unwrapArray } from "@/lib/api";
import {
  addAttendee,
  listAttendees,
  removeAttendee,
  updateAttendee,
  type Session,
  type SessionAttendee,
} from "@/services/mentorshipService";

type DirectoryUser = {
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
  canManage: boolean;
  onClose: () => void;
};

function fullName(u: DirectoryUser): string {
  return (
    [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
    u.username ||
    u.email ||
    `Utilisateur #${u.id}`
  );
}

function normalize(value: string | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export default function AttendeesDrawer({
  open,
  session,
  canManage,
  onClose,
}: Props) {
  const [attendees, setAttendees] = useState<SessionAttendee[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  // Load attendees + users when opening
  useEffect(() => {
    if (!open || !session) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- chargement initial à l'ouverture du drawer */
    setLoading(true);
    setError(null);
    setActionError(null);
    setSearch("");
    setPickerOpen(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    listAttendees()
      .then((data) => {
        if (cancelled) return;
        setAttendees(data.filter((a) => a.session === session.id));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setError(
            "Vous n'avez pas accès aux participants — réservé aux équipes mentorat.",
          );
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger les participants.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    if (canManage) {
      setUsersLoading(true);
      apiFetch<unknown>("/users/auth/users/")
        .then((data) => {
          if (cancelled) return;
          setUsers(unwrapArray<DirectoryUser>(data));
        })
        .catch(() => {
          /* on tolère un échec du répertoire — l'admin pourra réessayer */
        })
        .finally(() => {
          if (!cancelled) setUsersLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [open, session, canManage]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const usersById = useMemo(() => {
    const map = new Map<number, DirectoryUser>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const attendeeIds = useMemo(
    () => new Set(attendees.map((a) => a.user)),
    [attendees],
  );

  const candidates = useMemo(() => {
    const q = normalize(search);
    return users
      .filter((u) => !attendeeIds.has(u.id))
      .filter((u) => {
        if (!q) return true;
        const haystack = [fullName(u), u.email, u.username, u.role]
          .map(normalize)
          .join(" ");
        return haystack.includes(q);
      })
      .slice(0, 10);
  }, [users, attendeeIds, search]);

  if (!open || !session) return null;

  async function handleAdd(userId: number) {
    if (!session) return;
    setActionError(null);
    setAdding(true);
    try {
      const created = await addAttendee({
        session: session.id,
        user: userId,
      });
      setAttendees((prev) => [...prev, created]);
      setSearch("");
      setPickerOpen(false);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail =
          (typeof err.payload === "object" &&
            err.payload &&
            "detail" in err.payload &&
            typeof (err.payload as { detail?: unknown }).detail === "string" &&
            (err.payload as { detail: string }).detail) ||
          err.message;
        setActionError(detail || "Ajout impossible.");
      } else {
        setActionError(
          err instanceof Error ? err.message : "Ajout impossible.",
        );
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(attendeeId: number) {
    setActionError(null);
    setPendingId(attendeeId);
    try {
      await removeAttendee(attendeeId);
      setAttendees((prev) => prev.filter((a) => a.id !== attendeeId));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Suppression impossible.",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function handleToggleAttended(attendee: SessionAttendee) {
    setActionError(null);
    setPendingId(attendee.id);
    try {
      const updated = await updateAttendee(attendee.id, {
        attended: !attendee.attended,
      });
      setAttendees((prev) =>
        prev.map((a) => (a.id === attendee.id ? updated : a)),
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Mise à jour impossible.",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-neutral-4 bg-neutral-1 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-4 px-6 py-4">
          <div>
            <h2 className="text-h6 font-semibold text-neutral-8">
              Participants
            </h2>
            <p className="mt-1 text-xs text-neutral-6">
              {session.title}
            </p>
            <p className="mt-1 text-[11px] text-neutral-5">
              Filtré côté client (l’API ne supporte pas{" "}
              <code>?session=</code> pour le moment).
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

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {/* Add form (admin/mentor only) */}
          {canManage ? (
            <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-2 p-3">
              <p className="mb-2 text-xs font-semibold text-neutral-7">
                Ajouter un participant
              </p>
              <div className="relative">
                <Icon
                  icon="solar:magnifer-linear"
                  width={14}
                  className="absolute top-1/2 left-3 -translate-y-1/2 text-neutral-5"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onFocus={() => setPickerOpen(true)}
                  onBlur={() =>
                    window.setTimeout(() => setPickerOpen(false), 150)
                  }
                  placeholder={
                    usersLoading
                      ? "Chargement…"
                      : "Rechercher (nom, email, rôle)…"
                  }
                  disabled={usersLoading || adding}
                  className="w-full rounded-xl border border-neutral-4 bg-neutral-1 px-9 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:outline-none disabled:opacity-60"
                />
              </div>
              {pickerOpen && !usersLoading && candidates.length > 0 ? (
                <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-neutral-4 bg-neutral-1 shadow-sm">
                  {candidates.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleAdd(u.id)}
                        disabled={adding}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-neutral-3 disabled:opacity-60"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-5 text-primary-1">
                          <Icon icon="solar:user-bold" width={12} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-small font-semibold text-neutral-8">
                            {fullName(u)}
                          </span>
                          <span className="block truncate text-xs text-neutral-6">
                            {u.email}
                          </span>
                        </span>
                        {u.role ? (
                          <span className="rounded-full bg-neutral-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-6">
                            {u.role}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {pickerOpen &&
              !usersLoading &&
              search.trim() &&
              candidates.length === 0 ? (
                <p className="mt-2 text-xs text-neutral-5">
                  Aucun utilisateur ne correspond, ou déjà inscrit.
                </p>
              ) : null}
            </div>
          ) : null}

          {actionError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
              {actionError}
            </div>
          ) : null}

          {/* Attendees list */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-neutral-7 uppercase tracking-wide">
                Inscrits ({attendees.length})
              </p>
              {loading ? (
                <Icon
                  icon="svg-spinners:90-ring-with-bg"
                  width={14}
                  className="text-neutral-5"
                />
              ) : null}
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
                {error}
              </div>
            ) : null}

            {!error && !loading && attendees.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-2 px-4 py-6 text-center">
                <Icon
                  icon="solar:users-group-rounded-bold"
                  width={28}
                  className="mx-auto text-neutral-5"
                />
                <p className="mt-2 text-small text-neutral-7">
                  Aucun participant inscrit pour le moment.
                </p>
              </div>
            ) : null}

            {attendees.length > 0 ? (
              <ul className="space-y-2">
                {attendees.map((a) => {
                  const user = usersById.get(a.user);
                  const label = user
                    ? fullName(user)
                    : `Utilisateur #${a.user}`;
                  const email = user?.email;
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 rounded-2xl border border-neutral-4 bg-neutral-2 px-3 py-2.5"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-5 text-primary-1">
                        <Icon icon="solar:user-bold" width={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-small font-semibold text-neutral-8">
                          {label}
                        </p>
                        {email ? (
                          <p className="truncate text-xs text-neutral-6">
                            {email}
                          </p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-6">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                              a.attended
                                ? "bg-green-500/15 text-green-600 dark:text-green-300"
                                : "bg-neutral-3 text-neutral-7"
                            }`}
                          >
                            <Icon
                              icon={
                                a.attended
                                  ? "solar:check-circle-bold"
                                  : "solar:clock-circle-linear"
                              }
                              width={10}
                            />
                            {a.attended ? "Présent" : "Inscrit"}
                          </span>
                          {a.joined_at ? (
                            <span>
                              Inscrit le{" "}
                              {new Date(a.joined_at).toLocaleDateString(
                                "fr-FR",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {canManage ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleAttended(a)}
                            disabled={pendingId === a.id}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-6 hover:bg-neutral-3 disabled:opacity-50"
                            title={
                              a.attended
                                ? "Marquer comme absent"
                                : "Marquer comme présent"
                            }
                            aria-label={
                              a.attended
                                ? "Marquer comme absent"
                                : "Marquer comme présent"
                            }
                          >
                            <Icon
                              icon={
                                a.attended
                                  ? "solar:user-cross-bold"
                                  : "solar:user-check-bold"
                              }
                              width={14}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(a.id)}
                            disabled={pendingId === a.id}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                            title="Retirer"
                            aria-label="Retirer le participant"
                          >
                            {pendingId === a.id ? (
                              <Icon
                                icon="svg-spinners:90-ring-with-bg"
                                width={14}
                              />
                            ) : (
                              <Icon icon="solar:trash-bin-trash-bold" width={14} />
                            )}
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
