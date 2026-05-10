import { apiFetch, getStoredAccessToken, unwrapArray } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/config";
import { parseContentDispositionFilename } from "@/utils/parseContentDisposition";

export type MessagingUser = {
  id?: number;
  pk?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: string;
};

export type ConversationParticipant = {
  user?: MessagingUser;
  is_admin?: boolean;
};

export type ConversationKind = "direct" | "program_group" | string;

export type Conversation = {
  id: number;
  title?: string;
  type?: ConversationKind;
  kind?: ConversationKind;
  program?: number | null;
  participants?: ConversationParticipant[];
  last_message?:
    | string
    | {
        id?: number;
        content?: string;
        text?: string;
        sent_at?: string;
        created_at?: string;
        attachments?: MessageAttachment[];
        sender?: MessagingUser | null;
      };
  unread_count?: number;
  updated_at?: string;
  created_at?: string;
};

export type MessageAttachment = {
  id: number;
  filename?: string;
  name?: string;
  content_type?: string;
  mime_type?: string;
  size?: number;
  byte_size?: number;
  url?: string;
  download_url?: string;
};

export type Message = {
  id: number;
  conversation?: number;
  conversation_id?: number;
  content?: string | null;
  text?: string | null;
  sender?: MessagingUser | null;
  sender_id?: number;
  created_at?: string;
  sent_at?: string;
  attachments?: MessageAttachment[];
  metadata?: Record<string, unknown> | null;
};

export type PaginatedMessages = {
  items: Message[];
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
  has_previous: boolean;
};

export type UnreadByConversation = {
  conversation_id: number;
  unread_count: number;
};

export type UnreadCountResponse = {
  total: number;
  perConversation: Record<string, number>;
};

export type MessagingContact = {
  id: number;
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
};

export type SendMessagePayload = {
  content?: string;
  files?: File[];
  metadata?: Record<string, unknown>;
};

// ────────────────────────────────────────────────────────────────────────────
// Conversations
// ────────────────────────────────────────────────────────────────────────────

export async function listConversations(
  init?: { signal?: AbortSignal },
): Promise<Conversation[]> {
  const data = await apiFetch<unknown>("/messaging/conversations/", {
    signal: init?.signal,
  });
  return unwrapArray<Conversation>(data);
}

export async function getConversationsUnreadCount(
  init?: { signal?: AbortSignal },
): Promise<UnreadCountResponse> {
  const data = await apiFetch<unknown>(
    "/messaging/conversations/unread-count/",
    { signal: init?.signal },
  );

  if (typeof data === "number") {
    return { total: data, perConversation: {} };
  }

  if (data && typeof data === "object") {
    const obj = data as {
      total_unread_count?: unknown;
      total?: unknown;
      conversations?: unknown;
      per_conversation?: unknown;
    };

    const total =
      typeof obj.total_unread_count === "number"
        ? obj.total_unread_count
        : typeof obj.total === "number"
          ? obj.total
          : 0;

    const perConversation: Record<string, number> = {};
    if (Array.isArray(obj.conversations)) {
      for (const entry of obj.conversations as UnreadByConversation[]) {
        if (entry && typeof entry.conversation_id === "number") {
          perConversation[String(entry.conversation_id)] =
            Number(entry.unread_count) || 0;
        }
      }
    } else if (obj.per_conversation && typeof obj.per_conversation === "object") {
      for (const [key, value] of Object.entries(
        obj.per_conversation as Record<string, unknown>,
      )) {
        perConversation[key] = Number(value) || 0;
      }
    }

    return { total, perConversation };
  }

  return { total: 0, perConversation: {} };
}

export async function listConversationMessages(
  conversationId: number | string,
  options: { page?: number; pageSize?: number; signal?: AbortSignal } = {},
): Promise<PaginatedMessages> {
  const { page = 1, pageSize = 30, signal } = options;
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  const data = await apiFetch<unknown>(
    `/messaging/conversations/${encodeURIComponent(String(conversationId))}/messages/?${params.toString()}`,
    { signal },
  );

  if (data && typeof data === "object" && "items" in data) {
    const obj = data as Partial<PaginatedMessages>;
    return {
      items: Array.isArray(obj.items) ? (obj.items as Message[]) : [],
      page: typeof obj.page === "number" ? obj.page : page,
      page_size: typeof obj.page_size === "number" ? obj.page_size : pageSize,
      total: typeof obj.total === "number" ? obj.total : 0,
      has_next: Boolean(obj.has_next),
      has_previous: Boolean(obj.has_previous),
    };
  }

  const items = unwrapArray<Message>(data);
  return {
    items,
    page,
    page_size: pageSize,
    total: items.length,
    has_next: false,
    has_previous: false,
  };
}

export async function sendConversationMessage(
  conversationId: number | string,
  payload: SendMessagePayload,
): Promise<Message> {
  const url = `/messaging/conversations/${encodeURIComponent(String(conversationId))}/messages/`;

  if (payload.files && payload.files.length > 0) {
    const form = new FormData();
    if (payload.content) form.append("content", payload.content);
    if (payload.metadata) {
      form.append("metadata", JSON.stringify(payload.metadata));
    }
    for (const file of payload.files) {
      form.append("files", file, file.name);
    }
    return apiFetch<Message>(url, { method: "POST", body: form });
  }

  return apiFetch<Message>(url, {
    method: "POST",
    body: JSON.stringify({
      content: payload.content || "",
      ...(payload.metadata ? { metadata: payload.metadata } : {}),
    }),
  });
}

export async function markConversationRead(
  conversationId: number | string,
): Promise<void> {
  await apiFetch(
    `/messaging/conversations/${encodeURIComponent(String(conversationId))}/read/`,
    { method: "PATCH", body: JSON.stringify({}) },
  );
}

export async function getOrCreateDirectConversation(
  recipientId: number,
): Promise<Conversation> {
  return apiFetch<Conversation>("/messaging/conversations/direct/", {
    method: "POST",
    body: JSON.stringify({ recipient_id: recipientId }),
  });
}

export async function listMessagingContacts(
  init?: { signal?: AbortSignal },
): Promise<MessagingContact[]> {
  const data = await apiFetch<unknown>("/messaging/contacts/", {
    signal: init?.signal,
  });
  return unwrapArray<MessagingContact>(data);
}

export async function getProgramConversation(
  programId: number | string,
): Promise<Conversation> {
  return apiFetch<Conversation>(
    `/messaging/conversations/programs/${encodeURIComponent(String(programId))}/`,
  );
}

export async function ensureProgramConversation(
  programId: number | string,
): Promise<Conversation> {
  return apiFetch<Conversation>(
    `/messaging/conversations/programs/${encodeURIComponent(String(programId))}/ensure/`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Pièces jointes — téléchargement authentifié (Bearer + blob)
// ────────────────────────────────────────────────────────────────────────────

export type DownloadedAttachment = {
  blob: Blob;
  filename: string | null;
  contentType: string | null;
};

/**
 * Téléchargement authentifié d'une pièce jointe — JAMAIS de lien nu vers l'URL,
 * la cible exige le Bearer.
 */
export async function downloadMessagingAttachmentBlob(
  attachmentId: number | string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<DownloadedAttachment> {
  const base = getApiBaseUrl();
  const token = getStoredAccessToken();
  const res = await fetch(
    `${base}/messaging/attachments/${encodeURIComponent(String(attachmentId))}/download/`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
    },
  );
  if (res.status === 410) {
    throw new Error(
      "Cette pièce jointe a dépassé la période de rétention (7 jours).",
    );
  }
  if (!res.ok) {
    throw new Error(`Téléchargement impossible (${res.status})`);
  }
  const blob = await res.blob();
  const filename = parseContentDispositionFilename(
    res.headers.get("Content-Disposition"),
  );
  return {
    blob,
    filename,
    contentType: res.headers.get("Content-Type"),
  };
}
