"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { useAuth } from "@/providers/auth-provider";
import {
  getConversationsUnreadCount,
  listConversationMessages,
  listConversations,
  markConversationRead,
  sendConversationMessage,
  type Conversation,
  type Message,
  type MessageAttachment,
  type MessagingUser,
} from "@/services/messagingService";
import MessageAttachmentCard from "@/components/messaging/MessageAttachmentCard";
import NewConversationModal from "@/components/messaging/NewConversationModal";

const CONVERSATIONS_POLL_MS = 30_000;
const MESSAGES_POLL_MS = 15_000;
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_MAX_COUNT = 5;
const RETENTION_DAYS = 7;

type FilterKey = "all" | "direct" | "program";

function fullName(user: MessagingUser | null | undefined): string {
  if (!user) return "";
  return (
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.email ||
    ""
  );
}

function initialsFor(text: string): string {
  const parts = text
    .split(/[.\s_-]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (parts[0]?.[0] || "?")
    .concat(parts[1]?.[0] || "")
    .toUpperCase();
}

function isProgramConversation(conv: Conversation): boolean {
  const k = conv.type || conv.kind;
  if (k === "program_group" || k === "program" || k === "group") return true;
  return Boolean(conv.program);
}

function getConversationTitle(
  conv: Conversation,
  currentUserId: number | null,
): string {
  if (conv.title) return conv.title;
  if (isProgramConversation(conv)) return "Groupe programme";
  const others = (conv.participants || [])
    .map((p) => p?.user || null)
    .filter((u): u is MessagingUser => {
      if (!u) return false;
      const id = u.id ?? u.pk;
      return id != null && String(id) !== String(currentUserId);
    });
  if (others.length > 0) {
    return fullName(others[0]) || "Conversation";
  }
  return "Conversation";
}

function getConversationSubtitle(conv: Conversation): string {
  return isProgramConversation(conv)
    ? "Groupe programme"
    : "Conversation directe";
}

function getLastMessagePreview(conv: Conversation): string {
  const last = conv.last_message;
  if (!last) return "Aucun message pour l'instant.";
  if (typeof last === "string") return last;
  const text = last.content || last.text || "";
  if (text) return text;
  if (last.attachments && last.attachments.length > 0) {
    const count = last.attachments.length;
    return count === 1
      ? "📎 1 pièce jointe"
      : `📎 ${count} pièces jointes`;
  }
  return "Nouveau message";
}

function getLastMessageDate(conv: Conversation): string | undefined {
  const last = conv.last_message;
  if (last && typeof last === "object") {
    return last.sent_at || last.created_at || conv.updated_at;
  }
  return conv.updated_at || conv.created_at;
}

function formatShortTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 3_600_000));
  if (diffDays < 7) {
    return d.toLocaleDateString("fr-FR", { weekday: "short" });
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function formatBubbleTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Aujourd’hui";
  if (sameDay(d, yesterday)) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year:
      d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getMessageDate(msg: Message): string | undefined {
  return msg.created_at || msg.sent_at;
}

export default function MessagingScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryConvId = searchParams.get("c");
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id ?? null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState<string | null>(null);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showThreadOnMobile, setShowThreadOnMobile] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ────────────────────────────────────────────────────────
  // Load conversations + unread map
  // ────────────────────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    try {
      const [list, unread] = await Promise.all([
        listConversations(),
        getConversationsUnreadCount().catch(() => ({
          total: 0,
          perConversation: {} as Record<string, number>,
        })),
      ]);
      const sorted = [...list].sort((a, b) => {
        const ta = new Date(getLastMessageDate(a) || 0).getTime();
        const tb = new Date(getLastMessageDate(b) || 0).getTime();
        return tb - ta;
      });
      setConversations(sorted);
      setUnreadMap(unread.perConversation || {});
      setConvError(null);
    } catch (err) {
      setConvError(
        err instanceof Error ? err.message : "Impossible de charger.",
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setConvLoading(true);
      await refreshConversations();
      if (!cancelled) setConvLoading(false);
    })();
    const interval = setInterval(refreshConversations, CONVERSATIONS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshConversations]);

  // Sync URL ?c=<id>
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync state with URL */
    if (queryConvId) {
      const parsed = Number(queryConvId);
      if (!Number.isNaN(parsed)) {
        setActiveId(parsed);
        setShowThreadOnMobile(true);
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [queryConvId]);

  // Auto-select first conversation if none in URL once loaded (desktop only)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- pick first conversation */
    if (!convLoading && activeId == null && conversations.length > 0) {
      const first = conversations[0];
      if (first?.id != null) {
        setActiveId(first.id);
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [convLoading, conversations, activeId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  );

  // ────────────────────────────────────────────────────────
  // Load messages for active conversation
  // ────────────────────────────────────────────────────────
  const loadMessages = useCallback(
    async (id: number) => {
      try {
        const res = await listConversationMessages(id, {
          page: 1,
          pageSize: 30,
        });
        const ordered = [...res.items].sort((a, b) => {
          const ta = new Date(getMessageDate(a) || 0).getTime();
          const tb = new Date(getMessageDate(b) || 0).getTime();
          return ta - tb;
        });
        setMessages(ordered);
        setMessagesError(null);
      } catch (err) {
        setMessagesError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les messages.",
        );
      }
    },
    [],
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- réinitialisation du fil + démarrage du polling sur sélection */
    if (activeId == null) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setMessagesLoading(true);
      await loadMessages(activeId);
      if (!cancelled) setMessagesLoading(false);
    })();
    markConversationRead(activeId).catch(() => {});
    setUnreadMap((prev) => {
      if (!prev[String(activeId)]) return prev;
      const next = { ...prev };
      delete next[String(activeId)];
      return next;
    });
    const interval = setInterval(() => {
      loadMessages(activeId);
    }, MESSAGES_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeId, loadMessages]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, activeId]);

  // ────────────────────────────────────────────────────────
  // Filtering
  // ────────────────────────────────────────────────────────
  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "direct" && isProgramConversation(c)) return false;
      if (filter === "program" && !isProgramConversation(c)) return false;
      if (!q) return true;
      const haystack = [
        getConversationTitle(c, currentUserId),
        getLastMessagePreview(c),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [conversations, currentUserId, filter, search]);

  // ────────────────────────────────────────────────────────
  // URL helpers
  // ────────────────────────────────────────────────────────
  function selectConversation(id: number, opts?: { onMobile?: boolean }) {
    setActiveId(id);
    setShowThreadOnMobile(opts?.onMobile ?? true);
    router.replace(`/dashboard/messaging?c=${encodeURIComponent(id)}`);
  }

  function backToList() {
    setShowThreadOnMobile(false);
  }

  // ────────────────────────────────────────────────────────
  // Composer
  // ────────────────────────────────────────────────────────
  function handleFilesPicked(files: FileList | null) {
    if (!files) return;
    setSendError(null);
    const next: File[] = [...pendingFiles];
    for (const file of Array.from(files)) {
      if (next.length >= ATTACHMENT_MAX_COUNT) {
        setSendError(`Maximum ${ATTACHMENT_MAX_COUNT} fichiers par message.`);
        break;
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        setSendError(
          `« ${file.name} » dépasse la limite de ${formatBytes(ATTACHMENT_MAX_BYTES)}.`,
        );
        continue;
      }
      next.push(file);
    }
    setPendingFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePendingFile(idx: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSend() {
    if (activeId == null) return;
    const trimmed = draft.trim();
    if (!trimmed && pendingFiles.length === 0) return;
    if (sending) return;
    setSending(true);
    setSendError(null);
    try {
      await sendConversationMessage(activeId, {
        content: trimmed || undefined,
        files: pendingFiles.length > 0 ? pendingFiles : undefined,
      });
      setDraft("");
      setPendingFiles([]);
      await loadMessages(activeId);
      refreshConversations();
    } catch (err) {
      setSendError(
        err instanceof Error
          ? err.message
          : "Envoi impossible — réessayez plus tard.",
      );
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeydown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleConversationCreated(conv: Conversation) {
    setNewConvOpen(false);
    setConversations((prev) => {
      if (prev.some((c) => c.id === conv.id)) return prev;
      return [conv, ...prev];
    });
    selectConversation(conv.id);
  }

  // ────────────────────────────────────────────────────────
  // Rendering
  // ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 px-4 py-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-h4 font-semibold text-neutral-8">Communauté</h1>
        <p className="text-small text-neutral-6">
          Échangez avec apprenants, mentors et concepteurs — conversations
          directes et groupes programmes.
        </p>
        <p className="text-xs text-neutral-5">
          Pièces jointes : jusqu’à {ATTACHMENT_MAX_COUNT} fichiers par message,
          {" "}
          {formatBytes(ATTACHMENT_MAX_BYTES)} maximum, conservés{" "}
          {RETENTION_DAYS} jours.
        </p>
      </header>

      <div className="grid h-[calc(100vh-220px)] min-h-[500px] gap-4 lg:grid-cols-[340px_1fr]">
        {/* ── Liste conversations ── */}
        <aside
          className={`flex min-h-0 flex-col rounded-2xl border border-neutral-4 bg-neutral-1 ${
            showThreadOnMobile ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="flex items-center gap-2 border-b border-neutral-4 px-4 py-3">
            <div className="relative flex-1">
              <Icon
                icon="solar:magnifer-linear"
                width={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-5"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher…"
                className="w-full rounded-full border border-neutral-4 bg-neutral-2 px-9 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setNewConvOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-1 text-white shadow-sm transition hover:bg-primary-2"
              title="Nouvelle conversation"
              aria-label="Nouvelle conversation"
            >
              <Icon icon="solar:pen-new-square-bold" width={16} />
            </button>
          </div>

          <div className="flex gap-1.5 border-b border-neutral-4 px-3 py-2">
            {(
              [
                { key: "all", label: "Tout" },
                { key: "direct", label: "Direct" },
                { key: "program", label: "Groupes" },
              ] as { key: FilterKey; label: string }[]
            ).map((p) => {
              const active = filter === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setFilter(p.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? "bg-primary-1 text-white"
                      : "bg-neutral-2 text-neutral-7 hover:bg-neutral-3"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {convLoading && conversations.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-small text-neutral-6">
                <Icon icon="svg-spinners:90-ring-with-bg" width={16} />
                Chargement…
              </div>
            ) : convError ? (
              <div className="flex flex-col items-center gap-2 py-8 px-6 text-center text-small text-neutral-6">
                <Icon
                  icon="solar:danger-circle-linear"
                  width={24}
                  className="text-secondary-1"
                />
                <p>{convError}</p>
                <button
                  type="button"
                  onClick={refreshConversations}
                  className="mt-1 rounded-full border border-neutral-4 px-3 py-1 text-xs hover:bg-neutral-3"
                >
                  Réessayer
                </button>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 px-6 text-center text-small text-neutral-6">
                <Icon
                  icon="solar:chat-round-line-linear"
                  width={28}
                  className="text-neutral-4"
                />
                <p>Aucune conversation pour ces filtres.</p>
                <button
                  type="button"
                  onClick={() => setNewConvOpen(true)}
                  className="mt-1 rounded-full bg-primary-5 px-3 py-1 text-xs font-semibold text-primary-1 hover:bg-primary-4/40"
                >
                  Démarrer une conversation
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-4">
                {filteredConversations.map((conv) => {
                  const title = getConversationTitle(conv, currentUserId);
                  const preview = getLastMessagePreview(conv);
                  const time = formatShortTime(getLastMessageDate(conv));
                  const unread =
                    Number(unreadMap[String(conv.id)]) ||
                    Number(conv.unread_count) ||
                    0;
                  const active = conv.id === activeId;
                  const isProgram = isProgramConversation(conv);
                  return (
                    <li key={conv.id}>
                      <button
                        type="button"
                        onClick={() =>
                          selectConversation(conv.id, { onMobile: true })
                        }
                        className={`flex w-full gap-3 px-4 py-3 text-left transition ${
                          active ? "bg-primary-5" : "hover:bg-neutral-3"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-small font-semibold ${
                            isProgram
                              ? "bg-secondary-5 text-secondary-1"
                              : "bg-primary-5 text-primary-1"
                          }`}
                        >
                          {isProgram ? (
                            <Icon icon="solar:users-group-rounded-bold" width={18} />
                          ) : (
                            initialsFor(title)
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span
                              className={`truncate text-small ${
                                unread > 0
                                  ? "font-bold text-neutral-8"
                                  : "font-semibold text-neutral-7"
                              }`}
                            >
                              {title}
                            </span>
                            {time ? (
                              <span className="shrink-0 text-[11px] text-neutral-5">
                                {time}
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={`mt-0.5 line-clamp-1 text-xs ${
                              unread > 0 ? "font-medium text-neutral-7" : "text-neutral-6"
                            }`}
                          >
                            {preview}
                          </span>
                        </span>
                        {unread > 0 ? (
                          <span className="ml-1 inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary-1 px-1.5 text-[11px] font-bold text-white">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ── Fil discussion ── */}
        <section
          className={`flex min-h-0 flex-col rounded-2xl border border-neutral-4 bg-neutral-1 ${
            showThreadOnMobile ? "flex" : "hidden lg:flex"
          }`}
        >
          {!activeConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-neutral-6">
              <Icon
                icon="solar:chat-round-dots-linear"
                width={40}
                className="text-neutral-4"
              />
              <p className="text-small">
                Sélectionnez une conversation pour afficher le fil.
              </p>
              <button
                type="button"
                onClick={() => setNewConvOpen(true)}
                className="rounded-full bg-primary-1 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-2"
              >
                Nouvelle conversation
              </button>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-neutral-4 px-4 py-3">
                <button
                  type="button"
                  onClick={backToList}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-6 hover:bg-neutral-3 lg:hidden"
                  aria-label="Retour"
                >
                  <Icon icon="solar:arrow-left-linear" width={18} />
                </button>
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-small font-semibold ${
                    isProgramConversation(activeConversation)
                      ? "bg-secondary-5 text-secondary-1"
                      : "bg-primary-5 text-primary-1"
                  }`}
                >
                  {isProgramConversation(activeConversation) ? (
                    <Icon icon="solar:users-group-rounded-bold" width={18} />
                  ) : (
                    initialsFor(getConversationTitle(activeConversation, currentUserId))
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold text-neutral-8">
                    {getConversationTitle(activeConversation, currentUserId)}
                  </p>
                  <p className="truncate text-xs text-neutral-5">
                    {getConversationSubtitle(activeConversation)}
                  </p>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {messagesLoading && messages.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-small text-neutral-6">
                    <Icon icon="svg-spinners:90-ring-with-bg" width={18} />
                    Chargement des messages…
                  </div>
                ) : messagesError ? (
                  <div className="flex flex-col items-center gap-2 py-12 px-6 text-center text-small text-neutral-6">
                    <Icon
                      icon="solar:danger-circle-linear"
                      width={24}
                      className="text-secondary-1"
                    />
                    <p>{messagesError}</p>
                    <button
                      type="button"
                      onClick={() => activeId != null && loadMessages(activeId)}
                      className="rounded-full border border-neutral-4 px-3 py-1 text-xs hover:bg-neutral-3"
                    >
                      Réessayer
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <p className="py-12 text-center text-small text-neutral-6">
                    Pas encore de message — soyez le premier à écrire.
                  </p>
                ) : (
                  <MessagesList
                    messages={messages}
                    currentUserId={currentUserId}
                  />
                )}
                <div ref={messagesEndRef} />
              </div>

              <Composer
                draft={draft}
                onDraftChange={setDraft}
                onKeyDown={handleComposerKeydown}
                pendingFiles={pendingFiles}
                onPickFiles={() => fileInputRef.current?.click()}
                onRemoveFile={removePendingFile}
                fileInputRef={fileInputRef}
                onFilesChange={handleFilesPicked}
                sending={sending}
                sendError={sendError}
                onSend={handleSend}
              />
            </>
          )}
        </section>
      </div>

      <NewConversationModal
        open={newConvOpen}
        onClose={() => setNewConvOpen(false)}
        onCreated={handleConversationCreated}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MessagesList — bulles + séparateurs jour
// ────────────────────────────────────────────────────────────────────────────
function MessagesList({
  messages,
  currentUserId,
}: {
  messages: Message[];
  currentUserId: number | null;
}) {
  type Item =
    | { type: "day"; key: string; label: string }
    | {
        type: "msg";
        key: string;
        msg: Message;
        isMine: boolean;
        showAuthor: boolean;
      };
  const list: Item[] = [];
  let lastDay: string | null = null;
  let prevSenderId: number | null | undefined = undefined;
  for (const msg of messages) {
    const date = getMessageDate(msg);
    const dayKey = date ? new Date(date).toDateString() : "no-date";
    if (dayKey !== lastDay) {
      list.push({
        type: "day",
        key: `day-${dayKey}-${msg.id}`,
        label: formatDayLabel(date),
      });
      lastDay = dayKey;
      prevSenderId = undefined;
    }
    const senderId = msg.sender?.id ?? msg.sender?.pk ?? msg.sender_id ?? null;
    const isMine = senderId != null && String(senderId) === String(currentUserId);
    const showAuthor = !isMine && senderId !== prevSenderId;
    prevSenderId = senderId;
    list.push({
      type: "msg",
      key: `m-${msg.id}`,
      msg,
      isMine,
      showAuthor,
    });
  }
  return (
    <div className="flex flex-col gap-2">
      {list.map((item) => {
        if (item.type === "day") {
          return (
            <div
              key={item.key}
              className="my-2 flex items-center justify-center"
            >
              <span className="rounded-full bg-neutral-2 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-neutral-6">
                {item.label}
              </span>
            </div>
          );
        }
        const { msg, isMine, showAuthor } = item;
        return (
          <MessageBubble
            key={item.key}
            msg={msg}
            isMine={isMine}
            showAuthor={showAuthor}
          />
        );
      })}
    </div>
  );
}

function MessageBubble({
  msg,
  isMine,
  showAuthor,
}: {
  msg: Message;
  isMine: boolean;
  showAuthor: boolean;
}) {
  const content = msg.content || msg.text || "";
  const attachments: MessageAttachment[] = msg.attachments || [];
  const time = formatBubbleTime(getMessageDate(msg));
  const author = !isMine ? fullName(msg.sender) : "";

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[80%] flex-col ${isMine ? "items-end" : "items-start"}`}>
        {showAuthor && author ? (
          <span className="mb-0.5 px-2 text-[11px] text-neutral-5">{author}</span>
        ) : null}
        <div
          className={`flex flex-col gap-2 rounded-2xl px-3.5 py-2 ${
            isMine
              ? "bg-primary-1 text-white rounded-br-md"
              : "bg-neutral-2 text-neutral-8 rounded-bl-md"
          }`}
        >
          {content ? (
            <p className="whitespace-pre-wrap wrap-break-word text-small leading-snug">
              {content}
            </p>
          ) : null}
          {attachments.length > 0 ? (
            <div className="flex flex-col gap-2">
              {attachments.map((att) => (
                <MessageAttachmentCard
                  key={att.id}
                  attachment={att}
                  isMine={isMine}
                />
              ))}
            </div>
          ) : null}
        </div>
        {time ? (
          <span
            className={`mt-1 px-2 text-[10px] ${
              isMine ? "text-neutral-5" : "text-neutral-5"
            }`}
          >
            {time}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Composer
// ────────────────────────────────────────────────────────────────────────────
function Composer({
  draft,
  onDraftChange,
  onKeyDown,
  pendingFiles,
  onPickFiles,
  onRemoveFile,
  fileInputRef,
  onFilesChange,
  sending,
  sendError,
  onSend,
}: {
  draft: string;
  onDraftChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  pendingFiles: File[];
  onPickFiles: () => void;
  onRemoveFile: (idx: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesChange: (files: FileList | null) => void;
  sending: boolean;
  sendError: string | null;
  onSend: () => void;
}) {
  const canSend = (draft.trim().length > 0 || pendingFiles.length > 0) && !sending;
  return (
    <div className="border-t border-neutral-4 bg-neutral-1 px-3 py-3">
      {sendError ? (
        <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
          {sendError}
        </div>
      ) : null}

      {pendingFiles.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingFiles.map((file, idx) => (
            <span
              key={`${file.name}-${idx}`}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-4 bg-neutral-2 px-3 py-1 text-xs text-neutral-7"
            >
              <Icon
                icon="solar:paperclip-bold"
                width={12}
                className="text-primary-1"
              />
              <span className="max-w-[160px] truncate">{file.name}</span>
              <span className="text-neutral-5">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => onRemoveFile(idx)}
                className="ml-1 flex h-4 w-4 items-center justify-center rounded-full hover:bg-neutral-3"
                aria-label={`Retirer ${file.name}`}
              >
                <Icon icon="solar:close-bold" width={10} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={onPickFiles}
          disabled={pendingFiles.length >= ATTACHMENT_MAX_COUNT}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-4 text-neutral-6 transition hover:bg-neutral-3 disabled:opacity-40"
          aria-label="Ajouter une pièce jointe"
          title={
            pendingFiles.length >= ATTACHMENT_MAX_COUNT
              ? `Maximum ${ATTACHMENT_MAX_COUNT} fichiers`
              : "Ajouter une pièce jointe"
          }
        >
          <Icon icon="solar:paperclip-linear" width={18} />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          aria-label="Sélectionner des fichiers à joindre"
          title="Sélectionner des fichiers à joindre"
          onChange={(event) => onFilesChange(event.target.files)}
          className="hidden"
        />
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Écrire un message…  (Entrée envoie, Shift+Entrée nouvelle ligne)"
          rows={1}
          className="min-h-10 max-h-40 flex-1 resize-none rounded-2xl border border-neutral-4 bg-neutral-2 px-4 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-1 text-white shadow-sm transition hover:bg-primary-2 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Envoyer"
          title="Envoyer"
        >
          {sending ? (
            <Icon icon="svg-spinners:90-ring-with-bg" width={16} />
          ) : (
            <Icon icon="solar:plain-bold" width={18} />
          )}
        </button>
      </div>
    </div>
  );
}
