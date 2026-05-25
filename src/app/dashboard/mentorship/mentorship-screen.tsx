"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError, apiFetch, unwrapArray } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import {
  deleteSession,
  downloadSessionCalendarBlob,
  getSessionEndDate,
  getSessionStartDate,
  getSessionTemporalStatus,
  listSessions,
  type Session,
  type SessionTemporalStatus,
} from "@/services/mentorshipService";
import ConfirmAction from "@/components/ConfirmAction";
import SessionFormDrawer from "@/components/mentorship/SessionFormDrawer";
import AttendeesDrawer from "@/components/mentorship/AttendeesDrawer";

type DirectoryUser = {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: string;
};

type PeriodFilter = "all" | "upcoming" | "past";

const STATUS_META: Record<
  SessionTemporalStatus,
  { label: string; icon: string; classes: string }
> = {
  upcoming: {
    label: "À venir",
    icon: "solar:calendar-add-bold",
    classes: "bg-primary-5 text-primary-1 border border-primary-3",
  },
  live: {
    label: "En cours",
    icon: "solar:videocamera-record-bold",
    classes: "bg-red-500/15 text-red-600 dark:text-red-300 border border-red-500/30",
  },
  past: {
    label: "Terminée",
    icon: "solar:check-circle-bold",
    classes: "bg-neutral-3 text-neutral-7 border border-neutral-4",
  },
  unknown: {
    label: "Sans date",
    icon: "solar:question-circle-linear",
    classes: "bg-neutral-3 text-neutral-7 border border-neutral-4",
  },
};

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "Durée non précisée";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m.toString().padStart(2, "0")}`;
}

function userLabel(u?: DirectoryUser): string {
  if (!u) return "";
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

export default function MentorshipScreen() {
  const { user, ready } = useAuth();
  const role = user?.role;
  const isAdmin = role === "admin";
  const isMentor = role === "mentor";
  const canAccess = isAdmin || isMentor;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{
    status?: number;
    message: string;
  } | null>(null);

  const [users, setUsers] = useState<DirectoryUser[]>([]);

  // UI state
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [programFilter, setProgramFilter] = useState<number | "all">("all");
  const [mentorFilter, setMentorFilter] = useState<number | "all">("all");

  // Drawers
  const [formOpen, setFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [attendeesSession, setAttendeesSession] = useState<Session | null>(null);

  // Action feedback
  const [actionMessage, setActionMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [calendarBusyId, setCalendarBusyId] = useState<number | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSessions();
      setSessions(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ status: err.status, message: err.message });
      } else {
        setError({
          message:
            err instanceof Error ? err.message : "Chargement impossible.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // initial fetch — only after auth ready and role allowed
  useEffect(() => {
    if (!ready) return;
    if (!canAccess) {
      /* eslint-disable react-hooks/set-state-in-effect -- 403 sans appel API */
      setLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    void loadSessions();
  }, [ready, canAccess, loadSessions]);

  // Load directory once for mentor names + filters (admins surtout)
  useEffect(() => {
    if (!ready || !canAccess) return;
    let cancelled = false;
    apiFetch<unknown>("/users/auth/users/")
      .then((data) => {
        if (cancelled) return;
        setUsers(unwrapArray<DirectoryUser>(data));
      })
      .catch(() => {
        /* mentor : peut ne pas avoir l'endpoint — on tombera sur fallback ID */
      });
    return () => {
      cancelled = true;
    };
  }, [ready, canAccess]);

  // Auto-dismiss action message
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!actionMessage) return;
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setActionMessage(null), 5000);
    return () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, [actionMessage]);

  const usersById = useMemo(() => {
    const map = new Map<number, DirectoryUser>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const programOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of sessions) {
      if (s.program == null) continue;
      const title = s.program_details?.title || `Programme #${s.program}`;
      if (!map.has(s.program)) map.set(s.program, title);
    }
    return Array.from(map.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [sessions]);

  const mentorOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of sessions) {
      if (s.mentor == null) continue;
      const u = usersById.get(s.mentor);
      const label = userLabel(u) || `Mentor #${s.mentor}`;
      if (!map.has(s.mentor)) map.set(s.mentor, label);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sessions, usersById]);

  const now = useMemo(() => new Date(), []);

  const kpis = useMemo(() => {
    let upcoming = 0;
    let past = 0;
    let live = 0;
    let weekCount = 0;
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    for (const s of sessions) {
      const status = getSessionTemporalStatus(s, now);
      if (status === "upcoming") upcoming += 1;
      if (status === "past") past += 1;
      if (status === "live") live += 1;
      const start = getSessionStartDate(s);
      if (start && start >= now && start <= weekFromNow) {
        weekCount += 1;
      }
    }
    return {
      total: sessions.length,
      upcoming,
      past,
      live,
      weekCount,
    };
  }, [sessions, now]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return sessions
      .filter((s) => {
        if (programFilter !== "all" && s.program !== programFilter) return false;
        if (mentorFilter !== "all" && s.mentor !== mentorFilter) return false;
        if (period !== "all") {
          const status = getSessionTemporalStatus(s, now);
          if (period === "upcoming" && status === "past") return false;
          if (period === "past" && status !== "past") return false;
        }
        if (q) {
          const haystack = [
            s.title,
            s.description,
            s.program_details?.title,
            usersById.get(s.mentor || -1)
              ? userLabel(usersById.get(s.mentor || -1))
              : undefined,
          ]
            .map(normalize)
            .join(" ");
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = getSessionStartDate(a)?.getTime() ?? 0;
        const db = getSessionStartDate(b)?.getTime() ?? 0;
        return db - da;
      });
  }, [sessions, search, programFilter, mentorFilter, period, now, usersById]);

  function handleOpenCreate() {
    setEditingSession(null);
    setFormOpen(true);
  }

  function handleOpenEdit(session: Session) {
    setEditingSession(session);
    setFormOpen(true);
  }

  function handleOpenAttendees(session: Session) {
    setAttendeesSession(session);
    setAttendeesOpen(true);
  }

  function handleSaved(saved: Session) {
    setSessions((prev) => {
      const index = prev.findIndex((s) => s.id === saved.id);
      if (index >= 0) {
        const next = prev.slice();
        next[index] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setFormOpen(false);
    setEditingSession(null);
    setActionMessage({
      kind: "success",
      text: editingSession
        ? "Session mise à jour."
        : "Session planifiée avec succès.",
    });
  }

  function handleDelete(session: Session) {
    setDeleteTarget(session);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const session = deleteTarget;
    setDeleteBusyId(session.id);
    try {
      await deleteSession(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      setActionMessage({ kind: "success", text: "Session supprimée." });
    } catch (err) {
      setActionMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Suppression impossible.",
      });
    } finally {
      setDeleteBusyId(null);
      setDeleteTarget(null);
    }
  }

  async function handleDownloadCalendar(session: Session) {
    setCalendarBusyId(session.id);
    try {
      const { blob, filename } = await downloadSessionCalendarBlob(session.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 250);
    } catch (err) {
      setActionMessage({
        kind: "error",
        text:
          err instanceof Error
            ? err.message
            : "Téléchargement du calendrier impossible.",
      });
    } finally {
      setCalendarBusyId(null);
    }
  }

  function canEdit(session: Session): boolean {
    if (isAdmin) return true;
    if (isMentor && user?.id != null && session.mentor === user.id) return true;
    return false;
  }

  // ───────────────────────── Render guards ─────────────────────────

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Icon
          icon="svg-spinners:90-ring-with-bg"
          width={28}
          className="text-neutral-5"
        />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="px-4 py-10 lg:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-neutral-4 bg-neutral-1 p-8 text-center shadow-sm">
          <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-3 text-neutral-6">
            <Icon icon="solar:lock-keyhole-bold" width={22} />
          </span>
          <h1 className="text-h5 font-semibold text-neutral-8">
            Accès réservé aux équipes mentorat
          </h1>
          <p className="mt-2 text-small text-neutral-6">
            Cette console est accessible uniquement aux administrateurs et
            mentors. Si vous êtes étudiant·e ou concepteur·rice de programme,
            consultez votre portail.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-h4 font-semibold text-neutral-8">
            Sessions de mentorat
          </h1>
          <p className="mt-1 text-small text-neutral-6">
            Planification des sessions live et suivi des participants.
          </p>
          {isMentor ? (
            <p className="mt-1 text-xs text-neutral-5">
              Vous voyez uniquement les sessions dont vous êtes l’animateur.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadSessions()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-4 bg-neutral-1 px-3 py-2 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3 disabled:opacity-50"
          >
            <Icon
              icon={
                loading
                  ? "svg-spinners:90-ring-with-bg"
                  : "solar:refresh-circle-linear"
              }
              width={14}
            />
            Rafraîchir
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2"
          >
            <Icon icon="solar:add-circle-bold" width={14} />
            Nouvelle session
          </button>
        </div>
      </header>

      {/* KPI pills */}
      <section
        aria-label="Indicateurs"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <KpiPill
          icon="solar:calendar-bold"
          label="Total"
          value={kpis.total}
          tone="neutral"
        />
        <KpiPill
          icon="solar:calendar-add-bold"
          label="À venir"
          value={kpis.upcoming}
          tone="primary"
        />
        <KpiPill
          icon="solar:videocamera-record-bold"
          label="En cours"
          value={kpis.live}
          tone="danger"
        />
        <KpiPill
          icon="solar:calendar-mark-bold"
          label="Cette semaine"
          value={kpis.weekCount}
          tone="success"
          hint={`${kpis.past} terminée${kpis.past > 1 ? "s" : ""}`}
        />
      </section>

      {/* Toolbar */}
      <section
        aria-label="Filtres"
        className="rounded-2xl border border-neutral-4 bg-neutral-1 p-3 shadow-sm"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Icon
              icon="solar:magnifer-linear"
              width={14}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-neutral-5"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher (titre, description, programme, mentor)…"
              className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-9 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PeriodToggle value={period} onChange={setPeriod} />

            <label className="sr-only" htmlFor="filter-program">
              Filtrer par programme
            </label>
            <select
              id="filter-program"
              value={programFilter === "all" ? "all" : String(programFilter)}
              onChange={(event) =>
                setProgramFilter(
                  event.target.value === "all"
                    ? "all"
                    : Number(event.target.value),
                )
              }
              className="rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs text-neutral-8 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
              title="Filtrer par programme"
            >
              <option value="all">Tous les programmes</option>
              {programOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            {isAdmin ? (
              <>
                <label className="sr-only" htmlFor="filter-mentor">
                  Filtrer par mentor
                </label>
                <select
                  id="filter-mentor"
                  value={mentorFilter === "all" ? "all" : String(mentorFilter)}
                  onChange={(event) =>
                    setMentorFilter(
                      event.target.value === "all"
                        ? "all"
                        : Number(event.target.value),
                    )
                  }
                  className="rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-xs text-neutral-8 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
                  title="Filtrer par mentor"
                >
                  <option value="all">Tous les mentors</option>
                  {mentorOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            {(search ||
              period !== "all" ||
              programFilter !== "all" ||
              mentorFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPeriod("all");
                  setProgramFilter("all");
                  setMentorFilter("all");
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-neutral-4 px-3 py-2 text-xs text-neutral-7 hover:bg-neutral-3"
              >
                <Icon icon="solar:close-circle-linear" width={12} />
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </section>

      {actionMessage ? (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
            actionMessage.kind === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300"
              : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300"
          }`}
        >
          <Icon
            icon={
              actionMessage.kind === "success"
                ? "solar:check-circle-bold"
                : "solar:danger-triangle-bold"
            }
            width={14}
            className="mt-0.5 shrink-0"
          />
          <span>{actionMessage.text}</span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="ml-auto text-neutral-5 hover:text-neutral-7"
            aria-label="Masquer"
          >
            <Icon icon="solar:close-bold" width={12} />
          </button>
        </div>
      ) : null}

      {/* Body */}
      {loading ? (
        <SkeletonList />
      ) : error ? (
        <ErrorState
          status={error.status}
          message={error.message}
          onRetry={() => loadSessions()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          hasSessions={sessions.length > 0}
          onCreate={handleOpenCreate}
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {filtered.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              now={now}
              mentorLabel={
                session.mentor != null
                  ? userLabel(usersById.get(session.mentor)) ||
                    `Mentor #${session.mentor}`
                  : "Non assigné"
              }
              canEdit={canEdit(session)}
              calendarBusy={calendarBusyId === session.id}
              deleteBusy={deleteBusyId === session.id}
              onEdit={() => handleOpenEdit(session)}
              onDelete={() => handleDelete(session)}
              onAttendees={() => handleOpenAttendees(session)}
              onCalendar={() => handleDownloadCalendar(session)}
            />
          ))}
        </ul>
      )}

      <SessionFormDrawer
        open={formOpen}
        session={editingSession}
        isAdmin={isAdmin}
        onClose={() => {
          setFormOpen(false);
          setEditingSession(null);
        }}
        onSaved={handleSaved}
      />

      <AttendeesDrawer
        open={attendeesOpen}
        session={attendeesSession}
        canManage={
          attendeesSession ? canEdit(attendeesSession) || isAdmin : false
        }
        onClose={() => {
          setAttendeesOpen(false);
          setAttendeesSession(null);
        }}
      />

      <ConfirmAction
        isOpen={Boolean(deleteTarget)}
        title="Supprimer cette session ?"
        description={
          deleteTarget
            ? `« ${deleteTarget.title} » sera supprimée. Cette action est irréversible.`
            : ""
        }
        confirmLabel={deleteBusyId ? "Suppression…" : "Supprimer"}
        cancelLabel="Annuler"
        variant="danger"
        icon="solar:trash-bin-trash-bold"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ──────────────────────────── Sub-components ────────────────────────────

function KpiPill({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: string;
  label: string;
  value: number;
  hint?: string;
  tone: "neutral" | "primary" | "success" | "danger";
}) {
  const toneClasses = {
    neutral: "bg-neutral-3 text-neutral-7",
    primary: "bg-primary-5 text-primary-1",
    success: "bg-green-500/15 text-green-600 dark:text-green-300",
    danger: "bg-red-500/15 text-red-600 dark:text-red-300",
  }[tone];

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-4 bg-neutral-1 p-3 shadow-sm">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses}`}
      >
        <Icon icon={icon} width={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-neutral-6 uppercase">
          {label}
        </p>
        <p className="text-h6 font-semibold text-neutral-8">{value}</p>
        {hint ? <p className="text-[11px] text-neutral-5">{hint}</p> : null}
      </div>
    </div>
  );
}

function PeriodToggle({
  value,
  onChange,
}: {
  value: PeriodFilter;
  onChange: (v: PeriodFilter) => void;
}) {
  const options: { id: PeriodFilter; label: string; icon: string }[] = [
    { id: "all", label: "Toutes", icon: "solar:list-bold" },
    { id: "upcoming", label: "À venir", icon: "solar:calendar-add-bold" },
    { id: "past", label: "Passées", icon: "solar:history-2-bold" },
  ];
  return (
    <div className="inline-flex rounded-xl border border-neutral-4 bg-neutral-2 p-1 text-xs">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition ${
            value === option.id
              ? "bg-primary-1 text-white shadow-sm"
              : "text-neutral-7 hover:bg-neutral-3"
          }`}
        >
          <Icon icon={option.icon} width={12} />
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SessionCard({
  session,
  now,
  mentorLabel,
  canEdit,
  calendarBusy,
  deleteBusy,
  onEdit,
  onDelete,
  onAttendees,
  onCalendar,
}: {
  session: Session;
  now: Date;
  mentorLabel: string;
  canEdit: boolean;
  calendarBusy: boolean;
  deleteBusy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAttendees: () => void;
  onCalendar: () => void;
}) {
  const start = getSessionStartDate(session);
  const end = getSessionEndDate(session);
  const status = getSessionTemporalStatus(session, now);
  const meta = STATUS_META[status];
  const programTitle =
    session.program_details?.title || `Programme #${session.program}`;

  return (
    <li className="flex h-full flex-col gap-3 rounded-2xl border border-neutral-4 bg-neutral-1 p-4 shadow-sm transition hover:border-primary-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.classes}`}
            >
              <Icon icon={meta.icon} width={10} />
              {meta.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-neutral-4 bg-neutral-2 px-2 py-0.5 text-[11px] text-neutral-7">
              <Icon icon="solar:bookmark-bold" width={10} />
              <span className="max-w-[180px] truncate">{programTitle}</span>
            </span>
          </div>
          <h3 className="text-small font-semibold wrap-break-word text-neutral-8">
            {session.title}
          </h3>
          {session.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-neutral-6">
              {session.description}
            </p>
          ) : null}
        </div>
        {session.url ? (
          <a
            href={session.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-primary-3 bg-primary-5 px-2.5 py-1 text-xs font-semibold text-primary-1 transition hover:bg-primary-4"
            title="Ouvrir le lien visio"
          >
            <Icon icon="solar:videocamera-bold" width={12} />
            Rejoindre
          </a>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-xl bg-neutral-2 px-2.5 py-2">
          <dt className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-neutral-6 uppercase">
            <Icon icon="solar:calendar-add-linear" width={12} />
            Début
          </dt>
          <dd className="mt-0.5 text-neutral-8">{formatDateTime(start)}</dd>
        </div>
        <div className="rounded-xl bg-neutral-2 px-2.5 py-2">
          <dt className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-neutral-6 uppercase">
            <Icon icon="solar:clock-circle-linear" width={12} />
            Fin
          </dt>
          <dd className="mt-0.5 text-neutral-8">
            {end ? formatTime(end) : "—"}
            <span className="ml-1 text-neutral-5">
              ({formatDuration(session.duration_minutes)})
            </span>
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-6">
        <span className="inline-flex items-center gap-1">
          <Icon icon="solar:user-bold" width={12} />
          <span className="font-medium text-neutral-7">{mentorLabel}</span>
        </span>
        {session.recording_url ? (
          <a
            href={session.recording_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-neutral-4 bg-neutral-2 px-2 py-0.5 text-[11px] text-neutral-7 transition hover:bg-neutral-3"
          >
            <Icon icon="solar:play-circle-bold" width={10} />
            Replay
          </a>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-end gap-1.5 border-t border-neutral-4 pt-3">
        <button
          type="button"
          onClick={onAttendees}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-4 px-2.5 py-1.5 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
        >
          <Icon icon="solar:users-group-rounded-bold" width={12} />
          Participants
        </button>
        <button
          type="button"
          onClick={onCalendar}
          disabled={calendarBusy}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-4 px-2.5 py-1.5 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3 disabled:opacity-50"
          title="Télécharger le fichier ICS"
        >
          <Icon
            icon={
              calendarBusy
                ? "svg-spinners:90-ring-with-bg"
                : "solar:calendar-add-bold"
            }
            width={12}
          />
          ICS
        </button>
        {canEdit ? (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-4 px-2.5 py-1.5 text-xs font-semibold text-neutral-7 transition hover:bg-neutral-3"
            >
              <Icon icon="solar:pen-bold" width={12} />
              Modifier
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleteBusy}
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
            >
              <Icon
                icon={
                  deleteBusy
                    ? "svg-spinners:90-ring-with-bg"
                    : "solar:trash-bin-trash-bold"
                }
                width={12}
              />
              Supprimer
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}

function SkeletonList() {
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <li
          key={index}
          className="h-44 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2"
        />
      ))}
    </ul>
  );
}

function EmptyState({
  hasSessions,
  onCreate,
}: {
  hasSessions: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-1 px-4 py-12 text-center">
      <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-3 text-neutral-6">
        <Icon icon="solar:calendar-search-bold" width={22} />
      </span>
      <h2 className="text-h6 font-semibold text-neutral-8">
        {hasSessions
          ? "Aucune session ne correspond aux filtres."
          : "Aucune session planifiée."}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-small text-neutral-6">
        {hasSessions
          ? "Ajustez votre recherche ou réinitialisez les filtres pour voir plus de résultats."
          : "Planifiez votre première session live pour les apprenants — vous pourrez y inviter des participants ensuite."}
      </p>
      {!hasSessions ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2"
        >
          <Icon icon="solar:add-circle-bold" width={14} />
          Nouvelle session
        </button>
      ) : null}
    </div>
  );
}

function ErrorState({
  status,
  message,
  onRetry,
}: {
  status?: number;
  message: string;
  onRetry: () => void;
}) {
  if (status === 403) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-8 text-center">
        <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
          <Icon icon="solar:lock-keyhole-bold" width={22} />
        </span>
        <h2 className="text-h6 font-semibold text-red-600 dark:text-red-300">
          Accès refusé (403)
        </h2>
        <p className="mt-1 text-small text-red-600/80 dark:text-red-200">
          Cette ressource est réservée aux administrateurs et mentors.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-8 text-center">
      <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
        <Icon icon="solar:danger-triangle-bold" width={22} />
      </span>
      <h2 className="text-h6 font-semibold text-red-600 dark:text-red-300">
        Chargement impossible
      </h2>
      <p className="mt-1 text-small text-red-600/80 dark:text-red-200">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/25 dark:text-red-300"
      >
        <Icon icon="solar:refresh-circle-linear" width={14} />
        Réessayer
      </button>
    </div>
  );
}
