"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import useTheme from "@/hooks/useTheme";
import ConfirmAction from "@/components/ConfirmAction";
import {
  getUnreadNotificationsCount,
  listMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type Notification,
} from "@/services/notificationService";
import {
  getConversationsUnreadCount,
  listConversations,
  type Conversation,
  type MessagingUser,
} from "@/services/messagingService";

const NOTIFICATIONS_POLL_MS = 60_000;
const MESSAGES_POLL_MS = 30_000;
const MAX_TOPBAR_CONVERSATIONS = 5;

type Props = {
  showSearch?: boolean;
  searchPlaceholder?: string;
  onSearch?: (v: string) => void;
  left?: React.ReactNode;
  onMenuClick?: () => void;
  onNavigate?: (key: "settings" | "profile") => void;
  onMessagesClick?: () => void;
  onNotificationsClick?: () => void;
};

function formatRelativeTime(iso?: string): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "à l’instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `il y a ${diffD} j`;
}

function buildNotificationLink(notif: Notification): string | null {
  const meta =
    (notif?.metadata as Record<string, unknown> | null) ||
    (notif?.data as Record<string, unknown> | null) ||
    {};
  const conversationId = meta?.conversation_id;
  if (notif?.type === "message" || conversationId) {
    if (conversationId) {
      return `/dashboard/messaging?c=${encodeURIComponent(String(conversationId))}`;
    }
    return "/dashboard/messaging";
  }
  if (meta?.application_id) {
    return `/dashboard/admissions/${encodeURIComponent(String(meta.application_id))}`;
  }
  if (notif?.type === "application" && meta?.program_id) {
    return `/dashboard/programs/${encodeURIComponent(String(meta.program_id))}`;
  }
  return null;
}

function conversationTitle(
  conv: Conversation,
  currentUserId: number | null,
): string {
  if (conv?.title) return conv.title;
  const kind =
    conv?.type || conv?.kind || (conv?.program ? "program_group" : "direct");
  if (kind === "program_group" || kind === "program" || kind === "group") {
    return "Groupe programme";
  }
  const others = (conv?.participants || [])
    .map((p) => (p?.user || (p as unknown as MessagingUser)) ?? null)
    .filter((u): u is MessagingUser => {
      if (!u) return false;
      const uid = u.id ?? u.pk;
      return uid != null && String(uid) !== String(currentUserId);
    });
  if (others.length > 0) {
    const first = others[0];
    return (
      [first?.first_name, first?.last_name].filter(Boolean).join(" ").trim() ||
      first?.username ||
      first?.email ||
      "Conversation"
    );
  }
  return "Conversation";
}

function lastMessageContent(conv: Conversation): string {
  const last = conv?.last_message;
  if (!last) return "";
  if (typeof last === "string") return last;
  return last.content || last.text || "";
}

function lastMessageDate(conv: Conversation): string | undefined {
  const last = conv?.last_message;
  if (last && typeof last === "object") {
    return last.sent_at || last.created_at || conv?.updated_at;
  }
  return conv?.updated_at || conv?.created_at;
}

const TopBar = ({
  showSearch = false,
  searchPlaceholder = "Rechercher…",
  onSearch,
  left,
  onMenuClick,
  onNavigate,
  onMessagesClick,
  onNotificationsClick,
}: Props) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const fullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.username ||
    user?.email ||
    "Utilisateur";
  const currentUserId = user?.id ?? null;

  const [menuOpen, setMenuOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const menuRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  // ── Notifications ────────────────────────────────────
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  const refreshNotifications = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        listMyNotifications(),
        getUnreadNotificationsCount(),
      ]);
      const sorted = [...list].sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      });
      setNotifications(sorted);
      setUnreadCount(typeof count === "number" ? count : 0);
      setNotifError("");
    } catch (err) {
      setNotifError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les notifications.",
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setNotifLoading(true);
      await refreshNotifications();
      if (!cancelled) setNotifLoading(false);
    })();
    const interval = setInterval(refreshNotifications, NOTIFICATIONS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshNotifications]);

  const handleMarkOneRead = async (notif: Notification) => {
    if (!notif?.id || notif.is_read) return;
    const previous = notifications;
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notif.id ? { ...item, is_read: true } : item,
      ),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationAsRead(notif.id);
    } catch {
      setNotifications(previous);
      setUnreadCount((c) => c + 1);
    }
  };

  const handleMarkAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsAsRead();
    } catch {
      setNotifications(previous);
      await refreshNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    await handleMarkOneRead(notif);
    const link = buildNotificationLink(notif);
    if (link) {
      setNotificationsOpen(false);
      router.push(link);
    }
  };

  // ── Conversations ────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");

  const refreshConversations = useCallback(async () => {
    try {
      const [list, unread] = await Promise.all([
        listConversations(),
        getConversationsUnreadCount().catch(() => ({
          total: 0,
          perConversation: {},
        })),
      ]);
      const sorted = [...list].sort((a, b) => {
        const ta = new Date(lastMessageDate(a) || 0).getTime();
        const tb = new Date(lastMessageDate(b) || 0).getTime();
        return tb - ta;
      });
      setConversations(sorted);
      setMessagesUnread(Number(unread.total) || 0);
      setMessagesError("");
    } catch (err) {
      setMessagesError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les conversations.",
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMessagesLoading(true);
      await refreshConversations();
      if (!cancelled) setMessagesLoading(false);
    })();
    const interval = setInterval(refreshConversations, MESSAGES_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshConversations]);

  const recentConversations = useMemo(
    () => conversations.slice(0, MAX_TOPBAR_CONVERSATIONS),
    [conversations],
  );

  const handleOpenConversation = (convId: number | null) => {
    setMessagesOpen(false);
    if (convId != null) {
      router.push(
        `/dashboard/messaging?c=${encodeURIComponent(String(convId))}`,
      );
    } else {
      router.push("/dashboard/messaging");
    }
  };

  // Click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
      if (messagesRef.current && !messagesRef.current.contains(target)) {
        setMessagesOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    if (onSearch) onSearch(e.target.value);
  };

  const confirmLogout = async () => {
    setShowConfirm(false);
    await logout();
    router.replace("/login");
  };

  const handleMessagesToggle = () => {
    if (onMessagesClick) onMessagesClick();
    setMessagesOpen((prev) => {
      const next = !prev;
      if (next) refreshConversations();
      return next;
    });
    setNotificationsOpen(false);
    setMenuOpen(false);
  };

  const handleNotificationsToggle = () => {
    if (onNotificationsClick) onNotificationsClick();
    setNotificationsOpen((prev) => {
      const next = !prev;
      if (next) refreshNotifications();
      return next;
    });
    setMessagesOpen(false);
    setMenuOpen(false);
  };

  return (
    <header className="flex items-center justify-between gap-3 px-4 lg:px-8 py-3 bg-neutral-1 border-b border-neutral-4">
      {/* ── Gauche : hamburger + slot gauche ── */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onMenuClick}
          type="button"
          className="lg:hidden flex flex-col items-center justify-center gap-2 w-10 h-10 rounded-xl bg-neutral-2 hover:bg-primary-5 border border-neutral-4 hover:border-primary-3 transition-all duration-200 shrink-0 group"
          aria-label="Ouvrir le menu"
        >
          <span className="block w-5 h-0.5 bg-neutral-7 group-hover:bg-primary-1 rounded-full transition-colors duration-200" />
          <span className="block w-3.5 h-0.5 bg-neutral-7 group-hover:bg-primary-1 rounded-full transition-colors duration-200" />
          <span className="block w-5 h-0.5 bg-neutral-7 group-hover:bg-primary-1 rounded-full transition-colors duration-200" />
        </button>

        {left ? <div className="min-w-0">{left}</div> : null}
      </div>

      {/* ── Centre : recherche ── */}
      {showSearch && (
        <div className="flex-1 max-w-sm mx-4 hidden sm:block">
          <div className="relative">
            <Icon
              icon="solar:magnifer-bold"
              width={16}
              height={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-5 pointer-events-none"
            />
            <input
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 text-small bg-neutral-2 border border-neutral-4 rounded-full outline-none text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 transition-all duration-200"
            />
          </div>
        </div>
      )}

      {!showSearch && !left && <div className="flex-1" />}

      {/* ── Droite ── */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Messages */}
        <div className="relative" ref={messagesRef}>
          <button
            onClick={handleMessagesToggle}
            type="button"
            className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-neutral-3 transition-colors"
            aria-label="Messages"
            title="Messages"
          >
            <Icon
              icon="solar:chat-round-dots-bold"
              width={20}
              height={20}
              className="text-neutral-8"
            />
            {messagesUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-1 text-white text-[10px] font-bold flex items-center justify-center">
                {messagesUnread > 99 ? "99+" : messagesUnread}
              </span>
            )}
          </button>

          {messagesOpen && (
            <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-1rem)] bg-neutral-1 border border-neutral-4 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-4">
                <div className="flex items-center gap-2">
                  <p className="text-small font-semibold text-neutral-8">
                    Messages
                  </p>
                  {messagesUnread > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-1/10 text-primary-1">
                      {messagesUnread} non lu{messagesUnread > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenConversation(null)}
                  className="text-xs font-semibold text-primary-1 hover:underline"
                >
                  Tout voir
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {messagesLoading && conversations.length === 0 ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-neutral-6">
                    <Icon icon="svg-spinners:90-ring-with-bg" width={16} />
                    <span className="text-small">Chargement…</span>
                  </div>
                ) : messagesError && conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2 text-neutral-6 px-4">
                    <Icon
                      icon="solar:danger-circle-linear"
                      width={24}
                      className="text-secondary-1"
                    />
                    <p className="text-xs text-center">{messagesError}</p>
                  </div>
                ) : recentConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-neutral-6 px-4">
                    <Icon
                      icon="solar:chat-round-line-linear"
                      width={28}
                      className="text-neutral-4"
                    />
                    <p className="text-small">Aucune conversation.</p>
                  </div>
                ) : (
                  recentConversations.map((conv) => {
                    const title = conversationTitle(conv, currentUserId);
                    const lastText = lastMessageContent(conv);
                    const lastIso = lastMessageDate(conv);
                    const unread = Number(conv?.unread_count) || 0;
                    const isUnread = unread > 0;
                    return (
                      <button
                        key={conv?.id}
                        type="button"
                        onClick={() => handleOpenConversation(conv?.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-neutral-3 transition-colors flex gap-3 border-b border-neutral-4 last:border-b-0 ${
                          isUnread ? "bg-primary-5/40" : ""
                        }`}
                      >
                        <span
                          className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                            isUnread ? "bg-primary-1" : "bg-transparent"
                          }`}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={`text-small leading-snug truncate ${
                                isUnread
                                  ? "font-bold text-neutral-8"
                                  : "font-semibold text-neutral-7"
                              }`}
                            >
                              {title}
                            </p>
                            {lastIso && (
                              <span className="text-[10px] text-neutral-5 shrink-0">
                                {formatRelativeTime(lastIso)}
                              </span>
                            )}
                          </div>
                          {lastText && (
                            <p className="text-xs text-neutral-6 mt-0.5 leading-snug line-clamp-2">
                              {lastText}
                            </p>
                          )}
                        </div>
                        {isUnread && (
                          <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary-1 text-white text-[10px] font-bold shrink-0">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={handleNotificationsToggle}
            type="button"
            className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-neutral-3 transition-colors"
            aria-label="Notifications"
            title="Notifications"
          >
            <Icon
              icon="solar:bell-bold"
              width={20}
              height={20}
              className="text-neutral-8"
            />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-1rem)] bg-neutral-1 border border-neutral-4 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-4">
                <div className="flex items-center gap-2">
                  <p className="text-small font-semibold text-neutral-8">
                    Notifications
                  </p>
                  {unreadCount > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                      {unreadCount} non lu{unreadCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll || unreadCount === 0}
                  className="text-xs font-semibold text-primary-1 hover:underline disabled:text-neutral-5 disabled:no-underline"
                >
                  Tout marquer lu
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notifLoading && notifications.length === 0 ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-neutral-6">
                    <Icon icon="svg-spinners:90-ring-with-bg" width={16} />
                    <span className="text-small">Chargement…</span>
                  </div>
                ) : notifError && notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2 text-neutral-6 px-4">
                    <Icon
                      icon="solar:danger-circle-linear"
                      width={24}
                      className="text-secondary-1"
                    />
                    <p className="text-xs text-center">{notifError}</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-neutral-6">
                    <Icon
                      icon="solar:bell-off-linear"
                      width={28}
                      className="text-neutral-4"
                    />
                    <p className="text-small">Aucune notification.</p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const title = notif.title || notif.subject || "";
                    const body =
                      notif.message || notif.body || notif.content || "";
                    const isUnread = !notif.is_read;
                    return (
                      <button
                        key={notif.id}
                        type="button"
                        onClick={() => handleNotificationClick(notif)}
                        className={`w-full text-left px-4 py-3 hover:bg-neutral-3 transition-colors flex gap-3 border-b border-neutral-4 last:border-b-0 ${
                          isUnread ? "bg-primary-5/40" : ""
                        }`}
                      >
                        <span
                          className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                            isUnread ? "bg-primary-1" : "bg-transparent"
                          }`}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          {title && (
                            <p
                              className={`text-small leading-snug ${
                                isUnread
                                  ? "font-bold text-neutral-8"
                                  : "font-medium text-neutral-7"
                              }`}
                            >
                              {title}
                            </p>
                          )}
                          {body && (
                            <p className="text-xs text-neutral-6 mt-0.5 leading-snug line-clamp-3">
                              {body}
                            </p>
                          )}
                          <p className="text-xs text-neutral-5 mt-1">
                            {formatRelativeTime(notif.created_at)}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Toggle Dark / Light */}
        <button
          onClick={toggleTheme}
          type="button"
          className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-neutral-3 transition-colors"
          aria-label={isDark ? "Mode clair" : "Mode sombre"}
          title={isDark ? "Mode clair" : "Mode sombre"}
        >
          <Icon
            icon={isDark ? "solar:sun-bold" : "solar:moon-bold"}
            width={20}
            height={20}
            className={isDark ? "text-secondary-1" : "text-neutral-8"}
          />
        </button>

        {/* Séparateur */}
        <div className="w-px h-6 bg-neutral-4 mx-1" />

        {/* Avatar + menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => {
              setMenuOpen((v) => !v);
              setMessagesOpen(false);
              setNotificationsOpen(false);
            }}
            type="button"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-neutral-3 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-5 border border-primary-3 overflow-hidden flex items-center justify-center shrink-0">
              {user?.profile_picture_url || user?.profile_picture ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.profile_picture_url || user.profile_picture || ""}
                  alt={fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Icon
                  icon="solar:user-bold"
                  width={18}
                  height={18}
                  className="text-primary-1"
                />
              )}
            </div>

            <span className="hidden sm:block text-small font-medium text-neutral-8 max-w-28 truncate">
              {fullName}
            </span>

            <Icon
              icon="solar:alt-arrow-down-bold"
              width={14}
              height={14}
              className={`text-neutral-6 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-neutral-1 border border-neutral-4 rounded-xl shadow-lg py-1 z-50">
              <div className="px-4 py-3 border-b border-neutral-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-5 border border-primary-3 flex items-center justify-center shrink-0">
                  {user?.profile_picture_url || user?.profile_picture ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={user.profile_picture_url || user.profile_picture || ""}
                      alt={fullName}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <Icon
                      icon="solar:user-bold"
                      width={18}
                      height={18}
                      className="text-primary-1"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-small font-semibold text-neutral-8 truncate">
                    {fullName}
                  </p>
                  <p className="text-xs text-neutral-5 truncate">
                    {user?.email || ""}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (onNavigate) onNavigate("profile");
                  else router.push("/dashboard/profile");
                }}
                type="button"
                className="flex items-center gap-3 w-full px-4 py-2.5 text-small text-neutral-8 hover:bg-neutral-3 transition-colors rounded-2xl"
              >
                <Icon
                  icon="solar:user-bold"
                  width={16}
                  height={16}
                  className="text-neutral-6"
                />
                Profil
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (onNavigate) onNavigate("settings");
                  else router.push("/dashboard/settings");
                }}
                type="button"
                className="flex items-center gap-3 w-full px-4 py-2.5 text-small text-neutral-8 hover:bg-neutral-3 transition-colors rounded-2xl"
              >
                <Icon
                  icon="solar:settings-bold"
                  width={16}
                  height={16}
                  className="text-neutral-6"
                />
                Paramètres
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/dashboard/privacy-policy");
                }}
                type="button"
                className="flex items-center gap-3 w-full px-4 py-2.5 text-small text-neutral-8 hover:bg-neutral-3 transition-colors rounded-2xl"
              >
                <Icon
                  icon="solar:shield-keyhole-bold"
                  width={16}
                  height={16}
                  className="text-neutral-6 shrink-0"
                />
                <span className="truncate flex-1 text-left">
                  Politique &amp; confidentialité
                </span>
              </button>

              <div className="h-px bg-neutral-4 my-1" />

              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShowConfirm(true);
                }}
                type="button"
                className="flex items-center gap-3 w-full px-4 py-2.5 text-small text-red-500 hover:bg-red-50 transition-colors rounded-2xl"
              >
                <Icon
                  icon="solar:logout-2-bold"
                  width={16}
                  height={16}
                  className="text-red-500"
                />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmAction
        isOpen={showConfirm}
        onConfirm={confirmLogout}
        onCancel={() => setShowConfirm(false)}
        title="Se déconnecter"
        description="Êtes-vous sûr de vouloir vous déconnecter ?"
        confirmLabel="Se déconnecter"
        cancelLabel="Annuler"
        variant="danger"
        icon="solar:logout-2-bold"
      />
    </header>
  );
};

export default TopBar;
