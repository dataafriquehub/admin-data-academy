"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { ApiError } from "@/lib/api";
import {
  listMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type Notification,
  type NotificationType,
} from "@/services/notificationService";
import {
  NOTIFICATION_TYPES,
  formatAbsoluteDate,
  formatRelativeTime,
  notificationLink,
  notificationPriorityLabel,
  notificationTypeIcon,
  notificationTypeLabel,
  priorityToneClasses,
  typeToneClasses,
} from "./notification-utils";

type ReadFilter = "all" | "unread" | "read";

type Props = {
  onUnreadChange?: (count: number) => void;
};

function getNotificationBody(notif: Notification): string {
  return (
    notif.message ||
    notif.body ||
    notif.content ||
    ""
  ).toString();
}

function getNotificationTitle(notif: Notification): string {
  return notif.title || notif.subject || "Notification";
}

export default function InboxSection({ onUnreadChange }: Props) {
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [typeFilter, setTypeFilter] = useState<NotificationType | "">("");
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(
    null,
  );
  const [markingAll, setMarkingAll] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [busyOne, setBusyOne] = useState<number | null>(null);

  const loadInbox = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const list = await listMyNotifications(
          {
            isRead:
              readFilter === "unread"
                ? false
                : readFilter === "read"
                  ? true
                  : undefined,
            type: typeFilter || undefined,
          },
          { signal },
        );
        const sorted = [...list].sort((a, b) => {
          const ta = new Date(a.created_at || 0).getTime();
          const tb = new Date(b.created_at || 0).getTime();
          return tb - ta;
        });
        setItems(sorted);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError({
          status: err instanceof ApiError ? err.status : undefined,
          message:
            err instanceof Error ? err.message : "Chargement impossible.",
        });
      } finally {
        setLoading(false);
      }
    },
    [readFilter, typeFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    /* eslint-disable react-hooks/set-state-in-effect -- chargement initial / refetch sur changement filtres */
    loadInbox(controller.signal);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => controller.abort();
  }, [loadInbox]);

  const unreadCount = useMemo(
    () => items.filter((n) => !n.is_read).length,
    [items],
  );

  useEffect(() => {
    onUnreadChange?.(unreadCount);
  }, [unreadCount, onUnreadChange]);

  async function handleMarkOneRead(notif: Notification) {
    if (!notif?.id || notif.is_read) return;
    setBusyOne(notif.id);
    const previous = items;
    setItems((prev) =>
      prev.map((item) =>
        item.id === notif.id ? { ...item, is_read: true } : item,
      ),
    );
    try {
      await markNotificationAsRead(notif.id);
    } catch {
      setItems(previous);
    } finally {
      setBusyOne(null);
    }
  }

  async function handleMarkAllRead() {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    const previous = items;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsAsRead();
    } catch {
      setItems(previous);
    } finally {
      setMarkingAll(false);
    }
  }

  function toggleExpanded(id: number) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-4 bg-neutral-1 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: "all", label: "Tous", count: items.length },
              { key: "unread", label: "Non lues", count: unreadCount },
              {
                key: "read",
                label: "Lues",
                count: items.length - unreadCount,
              },
            ] as { key: ReadFilter; label: string; count: number }[]
          ).map((seg) => {
            const active = readFilter === seg.key;
            return (
              <button
                key={seg.key}
                type="button"
                onClick={() => setReadFilter(seg.key)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-primary-1 text-white"
                    : "bg-neutral-2 text-neutral-7 hover:bg-neutral-3"
                }`}
              >
                {seg.label}
                <span
                  className={`rounded-full px-1.5 text-[11px] ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-neutral-1 text-neutral-6"
                  }`}
                >
                  {seg.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="notif-type-filter"
            className="text-xs font-medium text-neutral-6"
          >
            Type
          </label>
          <select
            id="notif-type-filter"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as NotificationType | "")
            }
            className="rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-1.5 text-xs text-neutral-8 focus:border-primary-3 focus:outline-none"
          >
            <option value="">Tous</option>
            {NOTIFICATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {notificationTypeLabel(type)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-1 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {markingAll ? (
              <Icon icon="svg-spinners:90-ring-with-bg" width={12} />
            ) : (
              <Icon icon="solar:check-read-bold" width={14} />
            )}
            Tout marquer lu
          </button>
        </div>
      </div>

      {loading ? (
        <InboxSkeleton />
      ) : error ? (
        <div className="rounded-2xl border border-neutral-4 bg-neutral-1 p-6 text-center">
          <Icon
            icon="solar:danger-circle-linear"
            width={28}
            className="mx-auto text-secondary-1"
          />
          <p className="mt-2 text-small font-semibold text-neutral-8">
            {error.status === 401
              ? "Session expirée"
              : "Boîte de réception indisponible"}
          </p>
          <p className="mt-1 text-xs text-neutral-6">{error.message}</p>
          <button
            type="button"
            onClick={() => loadInbox()}
            className="mt-3 rounded-full border border-neutral-4 px-3 py-1 text-xs font-semibold hover:bg-neutral-3"
          >
            Réessayer
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-4 bg-neutral-1 p-10 text-center">
          <Icon
            icon="solar:bell-off-linear"
            width={32}
            className="mx-auto text-neutral-4"
          />
          <p className="mt-2 text-small font-semibold text-neutral-8">
            Aucune notification
          </p>
          <p className="mt-1 text-xs text-neutral-6">
            {readFilter !== "all" || typeFilter
              ? "Essayez d’élargir les filtres."
              : "Tout est calme pour le moment."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((notif) => {
            const meta =
              (notif.metadata as Record<string, unknown> | null) ||
              (notif.data as Record<string, unknown> | null) ||
              null;
            const link = notificationLink(meta);
            const title = getNotificationTitle(notif);
            const body = getNotificationBody(notif);
            const isUnread = !notif.is_read;
            const isExpanded = expanded[notif.id];
            const hasMeta =
              meta && typeof meta === "object" && Object.keys(meta).length > 0;

            return (
              <li
                key={notif.id}
                className={`group flex gap-3 rounded-2xl border p-4 transition ${
                  isUnread
                    ? "border-primary-3 bg-primary-5/40"
                    : "border-neutral-4 bg-neutral-1"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${typeToneClasses(notif.type)}`}
                >
                  <Icon icon={notificationTypeIcon(notif.type)} width={18} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={`text-small ${
                          isUnread
                            ? "font-bold text-neutral-8"
                            : "font-semibold text-neutral-7"
                        }`}
                      >
                        {title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded-full border border-neutral-4 bg-neutral-2 px-2 py-0.5 font-medium text-neutral-6">
                          {notificationTypeLabel(notif.type)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 font-semibold ${priorityToneClasses(notif.priority)}`}
                        >
                          {notificationPriorityLabel(notif.priority)}
                        </span>
                        <span
                          className="text-neutral-5"
                          title={formatAbsoluteDate(notif.created_at)}
                        >
                          {formatRelativeTime(notif.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {link ? (
                        <Link
                          href={link}
                          onClick={() => handleMarkOneRead(notif)}
                          className="inline-flex items-center gap-1 rounded-full border border-neutral-4 px-2.5 py-1 text-[11px] font-semibold text-primary-1 hover:bg-primary-5"
                          title="Ouvrir"
                        >
                          <Icon icon="solar:arrow-right-up-bold" width={12} />
                          Ouvrir
                        </Link>
                      ) : null}
                      {isUnread ? (
                        <button
                          type="button"
                          onClick={() => handleMarkOneRead(notif)}
                          disabled={busyOne === notif.id}
                          className="inline-flex items-center gap-1 rounded-full bg-primary-1 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-primary-2 disabled:opacity-50"
                        >
                          {busyOne === notif.id ? (
                            <Icon
                              icon="svg-spinners:90-ring-with-bg"
                              width={10}
                            />
                          ) : (
                            <Icon icon="solar:check-read-bold" width={10} />
                          )}
                          Marquer lu
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-2 px-2.5 py-1 text-[11px] text-neutral-5">
                          <Icon icon="solar:check-circle-bold" width={10} />
                          Lue
                        </span>
                      )}
                    </div>
                  </div>

                  {body ? (
                    <p
                      className={`mt-2 line-clamp-2 text-xs leading-snug ${
                        isUnread ? "text-neutral-7" : "text-neutral-6"
                      }`}
                    >
                      {body}
                    </p>
                  ) : null}

                  {hasMeta ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(notif.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-6 hover:text-primary-1"
                      >
                        <Icon
                          icon={
                            isExpanded
                              ? "solar:alt-arrow-up-linear"
                              : "solar:alt-arrow-down-linear"
                          }
                          width={12}
                        />
                        Détails techniques
                      </button>
                      {isExpanded ? (
                        <pre className="mt-2 max-h-48 overflow-auto rounded-xl border border-neutral-4 bg-neutral-2 p-3 text-[11px] leading-snug text-neutral-7">
                          {JSON.stringify(meta, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function InboxSkeleton() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <li
          key={i}
          className="flex gap-3 rounded-2xl border border-neutral-4 bg-neutral-1 p-4"
        >
          <div className="h-10 w-10 animate-pulse rounded-xl bg-neutral-4/30" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-4/30" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-4/20" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-4/20" />
          </div>
        </li>
      ))}
    </ul>
  );
}
